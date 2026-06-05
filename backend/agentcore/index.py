"""Real Estate Program — Bedrock AgentCore voice agent for Q&A and negotiation.

Handles bidirectional voice streaming via Nova 2 Sonic, with guardrail
enforcement, session time management, and QA analytics generation.
"""

from starlette.websockets import WebSocket, WebSocketDisconnect
from strands.experimental.bidi import BidiAgent
from strands.experimental.bidi.types.events import (
    BidiAudioInputEvent,
    BidiAudioStreamEvent,
    BidiTextInputEvent,
    BidiTranscriptStreamEvent,
    BidiInterruptionEvent,
    BidiResponseCompleteEvent,
)
from strands.experimental.bidi.types.io import BidiInput, BidiOutput, BidiOutputEvent
from strands.experimental.bidi.models import BidiNovaSonicModel
from strands.experimental.hooks.events import BidiMessageAddedEvent
from strands.hooks.registry import HookRegistry
from strands.experimental.bidi.tools import stop_conversation
from bedrock_agentcore import BedrockAgentCoreApp, RequestContext, PingStatus
from typing import Literal
from datetime import datetime, timezone
import asyncio
import boto3
import aioboto3
import os
import json
import re
import time
from collections import deque
from jinja2 import Template
from opentelemetry import baggage, context as otel_context

# ── Configuration ────────────────────────────────────────────────────
VALID_VOICES = ["matthew", "tiffany", "amy", "ambre", "florian",
                "beatrice", "lorenzo", "greta", "lennart", "lupe", "carlos"]
DEFAULT_VOICE_ID = os.getenv("VOICE_ID", "matthew")
if DEFAULT_VOICE_ID not in VALID_VOICES:
    raise ValueError(f"Invalid VOICE_ID '{DEFAULT_VOICE_ID}'. Must be one of: {VALID_VOICES}.")

REGION = os.getenv("AWS_REGION", "us-east-1")
MODEL_ID = os.getenv("MODEL_ID", "amazon.nova-2-sonic-v1:0")
QA_ANALYTICS_MODEL_ID = os.environ.get("QA_ANALYTICS_MODEL_ID", "global.amazon.nova-2-lite-v1:0")
_runtime_name = os.getenv("AGENT_RUNTIME_NAME", "")
CLOUDWATCH_LOG_GROUP = f"/aws/bedrock-agentcore/runtimes/{_runtime_name}-DEFAULT" if _runtime_name else ""
GUARDRAIL_ID = os.environ.get("BEDROCK_GUARDRAIL_ID", "")
GUARDRAIL_VERSION = os.environ.get("BEDROCK_GUARDRAIL_VERSION", "")

# Guardrail gate tuning
GUARDRAIL_SCREEN_CHAR_BUDGET = 120
GUARDRAIL_GATE_TIMEOUT_SEC = 0.8
_SENTENCE_TERMINATOR_RE = re.compile(r'[.!?]\s')

_bedrock_runtime_client = boto3.client('bedrock-runtime', region_name=REGION)


# ── Guardrail helpers ────────────────────────────────────────────────

async def apply_guardrail_to_text(text: str, source: Literal['INPUT', 'OUTPUT']) -> tuple[bool, str]:
    """Run Bedrock guardrail against transcript text. Fails open on error."""
    if not text or not text.strip() or not GUARDRAIL_ID:
        return False, text
    try:
        response = await asyncio.to_thread(
            lambda: _bedrock_runtime_client.apply_guardrail(
                guardrailIdentifier=GUARDRAIL_ID,
                guardrailVersion=GUARDRAIL_VERSION,
                source=source,
                content=[{'text': {'text': text}}],
            )
        )
    except Exception as e:
        print(f"[Guardrail] apply_guardrail({source}) failed, failing open: {e}", flush=True)
        return False, text

    if response.get('action') != 'GUARDRAIL_INTERVENED':
        return False, text

    outputs = response.get('outputs') or []
    sanitized = outputs[0]['text'] if outputs and 'text' in outputs[0] else text
    return True, sanitized


# ── System prompt builder ────────────────────────────────────────────

def build_qa_system_prompt(persona_name, persona_prompt, custom_instructions, transcript_text, session_duration):
    """Build QA system prompt from persona and presentation context."""
    qa_duration = session_duration // 60
    if qa_duration <= 0:
        qa_duration = 1

    with open("qa_system_prompt.jinja2", "r") as f:
        template_file = f.read()
    template = Template(template_file)
    prompt = template.render(
        persona_name=persona_name,
        persona_prompt=persona_prompt,
        custom_instructions=custom_instructions if custom_instructions else None,
        transcript_text=transcript_text,
        qa_limit=qa_duration,
    )
    return prompt


def build_panel_system_prompt(personas: list, transcript_text: str, session_duration: int) -> str:
    """Build a combined panel system prompt for multi-persona Q&A."""
    qa_duration = session_duration // 60
    if qa_duration <= 0:
        qa_duration = 1

    persona_descriptions = []
    for p in personas:
        persona_descriptions.append(
            f"- **{p.get('name', 'Stakeholder')}**: {p.get('personaPrompt', p.get('description', ''))}"
        )

    personas_text = "\n".join(persona_descriptions)
    persona_names = ", ".join(p.get('name', 'Stakeholder') for p in personas)

    prompt = f"""You are facilitating a panel Q&A session with multiple stakeholders evaluating a real estate development presentation. You represent ALL of the following perspectives and should alternate between them:

PANEL MEMBERS:
{personas_text}

YOUR BEHAVIOR:
1. Alternate between personas throughout the session — don't stay in one perspective too long
2. When asking a question, briefly identify which stakeholder perspective you're representing (e.g., "As your investor, I need to understand..." or "From a public policy standpoint...")
3. Ask ONE question at a time from ONE persona's perspective
4. Each persona should get roughly equal airtime
5. Keep the session to approximately {qa_duration} minutes
6. End the conversation gracefully when time is up using stop_conversation

QUESTION PRIORITIES BY PERSONA:
"""

    for p in personas:
        priorities = p.get('keyPriorities', [])
        if priorities:
            prompt += f"\n{p.get('name', 'Stakeholder')}:\n"
            for priority in priorities[:4]:
                prompt += f"  - {priority}\n"

    prompt += f"""
GUIDELINES:
- Be direct, professional, and skeptical where appropriate
- Reference specific parts of the presentation when possible
- If the presenter gives a vague answer, push for specifics from that persona's perspective
- Maintain each persona's communication style when speaking as them
- You will receive TIME CHECK messages — wrap up gracefully when time is running out

PRESENTATION TRANSCRIPT:
{transcript_text}
"""
    return prompt


# ── Nova Sonic model factory ─────────────────────────────────────────

def create_nova_sonic_model(voice_id=None):
    """Create a BidiNovaSonicModel with the given voice configuration."""
    voice = voice_id if voice_id and voice_id in VALID_VOICES else DEFAULT_VOICE_ID
    return BidiNovaSonicModel(
        model_id=MODEL_ID,
        provider_config={
            "audio": {
                "input_rate": 16000,
                "output_rate": 16000,
                "voice": voice,
                "channels": 1,
                "format": "pcm",
            }
        },
        client_config={
            "boto_session": boto3.Session(region_name=REGION),
        },
    )


# ── Session time guard ───────────────────────────────────────────────

class SessionTimeGuard:
    """Hook that monitors elapsed time and nudges the agent to wrap up."""

    def __init__(self, duration_sec: int):
        self._start = time.monotonic()
        self._duration = duration_sec
        self.time_nudge: str | None = None
        self.force_stop = False

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BidiMessageAddedEvent, self.on_message_added)

    async def on_message_added(self, event: BidiMessageAddedEvent):
        if event.message['role'] != 'user':
            return
        elapsed = time.monotonic() - self._start
        remaining = max(0, self._duration - elapsed)
        if remaining <= 0:
            self.time_nudge = (
                "TIME EXPIRED. Thank the presenter briefly and use stop_conversation immediately."
            )
            self.force_stop = True
        elif remaining <= 30:
            self.time_nudge = (
                f"TIME CHECK: Only {remaining:.0f}s remaining. "
                "This should be your last question. Wrap up and use stop_conversation soon."
            )


# ── WebSocket Input ──────────────────────────────────────────────────

class WebSocketBidiInput(BidiInput):
    """Bridge browser WebSocket audio into BidiAgent input events."""

    def __init__(self, websocket: WebSocket, time_guard: SessionTimeGuard | None = None):
        self._ws = websocket
        self._stopped = False
        self._analytics_requested = asyncio.Event()
        self._time_guard = time_guard

    async def start(self, agent: BidiAgent) -> None:
        self._stopped = False
        self._agent = agent
        await agent.send(BidiTextInputEvent(
            text="Please introduce yourself and begin the Q&A session.",
            role="user",
        ))

    async def _drain_time_nudge(self) -> None:
        if not self._time_guard or not self._time_guard.time_nudge:
            return
        nudge = self._time_guard.time_nudge
        self._time_guard.time_nudge = None
        await self._agent.send(BidiTextInputEvent(text=nudge, role="user"))
        if self._time_guard.force_stop:
            await asyncio.sleep(15)
            self._stopped = True
            raise asyncio.CancelledError("session time expired")

    async def __call__(self) -> BidiAudioInputEvent:
        while not self._stopped:
            await self._drain_time_nudge()
            try:
                msg = await self._ws.receive_json()
            except WebSocketDisconnect:
                self._stopped = True
                raise asyncio.CancelledError("client disconnected")

            action = msg.get("action", "")
            if action == "audio":
                return BidiAudioInputEvent(
                    audio=msg["data"],
                    format="pcm",
                    sample_rate=16000,
                    channels=1,
                )
            elif action == "get_analytics":
                self._analytics_requested.set()
            elif action == "end":
                self._stopped = True
                raise asyncio.CancelledError("client ended session")
        raise asyncio.CancelledError("input stopped")

    async def stop(self) -> None:
        self._stopped = True


# ── WebSocket Output (with speculative-transcript guardrail gate) ────

class WebSocketBidiOutput(BidiOutput):
    """Bridge BidiAgent output events back to the browser WebSocket."""

    def __init__(self, websocket: WebSocket):
        self._ws = websocket
        self.transcript_entries: list[dict] = []
        self._agent: BidiAgent | None = None
        self._guardrail_tasks: set[asyncio.Task] = set()
        self._gate = asyncio.Event()
        self._gate.set()
        self._pending_audio: deque[str] = deque()
        self._speculative_buffer: str = ""
        self._screened_chars: int = 0
        self._turn_blocked: bool = False
        self._screen_lock = asyncio.Lock()

    async def start(self, agent: BidiAgent) -> None:
        self._agent = agent

    def _reset_turn_state(self) -> None:
        self._gate.set()
        self._pending_audio.clear()
        self._speculative_buffer = ""
        self._screened_chars = 0
        self._turn_blocked = False

    def _should_screen_now(self) -> bool:
        suffix = self._speculative_buffer[self._screened_chars:]
        if not suffix:
            return False
        if _SENTENCE_TERMINATOR_RE.search(suffix):
            return True
        return len(suffix) >= GUARDRAIL_SCREEN_CHAR_BUDGET

    async def _screen_speculative(self) -> None:
        async with self._screen_lock:
            text_to_screen = self._speculative_buffer
            if len(text_to_screen) <= self._screened_chars:
                return
            self._gate.clear()
            try:
                intervened, sanitized = await asyncio.wait_for(
                    apply_guardrail_to_text(text_to_screen, 'OUTPUT'),
                    timeout=GUARDRAIL_GATE_TIMEOUT_SEC,
                )
            except (asyncio.TimeoutError, Exception):
                await self._release_pending_audio()
                self._screened_chars = len(text_to_screen)
                self._gate.set()
                return
            if intervened:
                await self._handle_blocked_turn(sanitized)
                return
            self._screened_chars = len(text_to_screen)
            await self._release_pending_audio()
            self._gate.set()

    async def _release_pending_audio(self) -> None:
        while self._pending_audio:
            chunk = self._pending_audio.popleft()
            try:
                await self._ws.send_json({"type": "audio", "data": chunk})
            except (WebSocketDisconnect, Exception):
                self._pending_audio.clear()
                return

    async def _handle_blocked_turn(self, sanitized: str) -> None:
        self._turn_blocked = True
        self._pending_audio.clear()
        self._gate.clear()
        try:
            await self._ws.send_json({"type": "audio_clear"})
            await self._ws.send_json({
                "type": "guardrail_intervention",
                "role": "assistant",
                "sanitized_text": sanitized,
            })
        except (WebSocketDisconnect, Exception):
            pass
        if self._agent is not None:
            try:
                await self._agent.send(BidiTextInputEvent(
                    text="SYSTEM NOTICE: Your previous response was blocked by content policy. "
                         "Ask a different question grounded in the presentation.",
                    role="user",
                ))
            except Exception:
                pass

    async def __call__(self, event: BidiOutputEvent) -> None:
        try:
            if isinstance(event, BidiAudioStreamEvent):
                if self._turn_blocked:
                    return
                if self._gate.is_set():
                    await self._ws.send_json({"type": "audio", "data": event.audio})
                else:
                    self._pending_audio.append(event.audio)

            elif isinstance(event, BidiTranscriptStreamEvent):
                await self._ws.send_json({
                    "type": "transcript",
                    "role": event.role,
                    "text": event.text,
                    "is_partial": not event.is_final,
                })
                if event.role == "assistant" and not event.is_final and not self._turn_blocked and event.text:
                    self._speculative_buffer += event.text
                    if self._should_screen_now():
                        asyncio.create_task(self._screen_speculative())
                if event.is_final and event.text and event.text.strip():
                    if event.role == "user" or not self._turn_blocked:
                        self.transcript_entries.append({"role": event.role, "text": event.text.strip()})

            elif isinstance(event, BidiInterruptionEvent):
                self._reset_turn_state()
                try:
                    await self._ws.send_json({"type": "interruption"})
                except (WebSocketDisconnect, Exception):
                    pass

            elif isinstance(event, BidiResponseCompleteEvent):
                if not self._turn_blocked and self._speculative_buffer and self._screened_chars < len(self._speculative_buffer):
                    try:
                        await self._screen_speculative()
                    except Exception:
                        pass
                self._reset_turn_state()

        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f"[Warning] Output event error: {e}", flush=True)

    async def stop(self) -> None:
        if self._guardrail_tasks:
            try:
                await asyncio.wait_for(
                    asyncio.gather(*self._guardrail_tasks, return_exceptions=True), timeout=2.0
                )
            except asyncio.TimeoutError:
                pass


# ── Data loaders ─────────────────────────────────────────────────────

async def load_persona(persona_id: str) -> dict:
    """Load persona configuration from DynamoDB."""
    table_name = os.getenv('PERSONA_TABLE_NAME')
    if not table_name:
        return {}
    try:
        session = aioboto3.Session()
        async with session.resource('dynamodb', region_name=REGION) as dynamodb:
            table = await dynamodb.Table(table_name)
            response = await table.get_item(Key={'personaID': persona_id})
            return response.get('Item', {})
    except Exception as e:
        print(f"Failed to load persona {persona_id}: {e}")
        return {}


async def load_transcript(user_id: str, session_id: str) -> str:
    """Load presentation transcript from S3."""
    bucket_name = os.getenv('UPLOADS_BUCKET')
    if not bucket_name:
        return ""
    s3_key = f"{user_id}/{session_id}/transcript.json"
    try:
        session = aioboto3.Session()
        async with session.client('s3', region_name=REGION) as s3:
            response = await s3.get_object(Bucket=bucket_name, Key=s3_key)
            content = await response['Body'].read()
            transcript_data = json.loads(content)
            if isinstance(transcript_data, list):
                return " ".join([entry.get('text', '') for entry in transcript_data])
            elif isinstance(transcript_data, dict) and 'entries' in transcript_data:
                return " ".join([entry.get('text', '') for entry in transcript_data['entries']])
            return str(transcript_data)
    except Exception as e:
        print(f"Failed to load transcript: {e}")
        return ""


# ── QA Analytics generation ──────────────────────────────────────────

async def generate_qa_analytics(transcript_entries: list[dict], persona_data: dict) -> dict:
    """Generate QA response quality summary using Bedrock."""
    if not transcript_entries:
        return {}

    persona_name = persona_data.get('name', 'Stakeholder')
    communication_style = persona_data.get('communicationStyle', 'professional')
    conversation = "\n".join(
        f"{'Question' if e['role'] == 'assistant' else 'Answer'}: {e['text']}"
        for e in transcript_entries
    )

    prompt = f"""You are evaluating a Q&A session where {persona_name} asked questions about a real estate development proposal.

Q&A Transcript:
{conversation}

Evaluate how well the presenter answered each question. Focus on:
- Clarity and directness of responses
- Depth of understanding of financial, regulatory, and market factors
- Ability to handle challenging stakeholder questions
- Confidence and composure under pressure

Use a {communication_style} tone. Be concise."""

    tool_config = {
        "tools": [{
            "toolSpec": {
                "name": "provide_qa_feedback",
                "description": "Provide structured Q&A session feedback",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "overallSummary": {"type": "string"},
                            "responseQuality": {"type": "string"},
                            "strengths": {"type": "array", "items": {"type": "string"}},
                            "improvements": {"type": "array", "items": {"type": "string"}},
                            "questionBreakdown": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "question": {"type": "string"},
                                        "rating": {"type": "string"},
                                        "note": {"type": "string"},
                                    },
                                    "required": ["question", "rating", "note"],
                                },
                            },
                        },
                        "required": ["overallSummary", "responseQuality", "strengths", "improvements", "questionBreakdown"],
                    }
                },
            }
        }],
        "toolChoice": {"tool": {"name": "provide_qa_feedback"}},
    }

    response = await asyncio.to_thread(
        lambda: _bedrock_runtime_client.converse(
            modelId=QA_ANALYTICS_MODEL_ID,
            messages=[{'role': 'user', 'content': [{'text': prompt}]}],
            toolConfig=tool_config,
        )
    )
    return response['output']['message']['content'][0]['toolUse']['input']


async def save_qa_analytics(user_id: str, session_id: str, transcript_entries: list[dict], feedback: dict):
    """Save QA transcript and analytics to S3."""
    bucket_name = os.getenv('UPLOADS_BUCKET')
    if not bucket_name:
        return
    s3_prefix = f"{user_id}/{session_id}"
    session = aioboto3.Session()
    async with session.client('s3', region_name=REGION) as s3_client:
        await s3_client.put_object(
            Bucket=bucket_name,
            Key=f"{s3_prefix}/qa_transcript.json",
            Body=json.dumps(transcript_entries, indent=2),
            ContentType='application/json',
        )
        result = {
            "status": "completed",
            "sessionId": session_id,
            "qaFeedback": feedback,
            "totalQuestions": sum(1 for e in transcript_entries if e['role'] == 'assistant'),
            "totalResponses": sum(1 for e in transcript_entries if e['role'] == 'user'),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "model": QA_ANALYTICS_MODEL_ID,
        }
        await s3_client.put_object(
            Bucket=bucket_name,
            Key=f"{s3_prefix}/qa_analytics.json",
            Body=json.dumps(result, indent=2),
            ContentType='application/json',
        )


# ── App and WebSocket handler ────────────────────────────────────────

app = BedrockAgentCoreApp()


@app.ping
def health_check():
    return PingStatus.HEALTHY


@app.websocket
async def websocket_handler(websocket, context: RequestContext):
    """WebSocket handler for Q&A and negotiation sessions.

    Client sends setup message after connection:
      {"action": "setup", "personaId": "...", "userId": "...",
       "sessionId": "...", "voiceId": "..."}
    """
    await websocket.accept()

    # Wait for setup frame
    try:
        raw = await asyncio.wait_for(websocket.receive_json(), timeout=10)
    except asyncio.TimeoutError:
        await websocket.send_json({"type": "error", "message": "Setup not received within 10s"})
        await websocket.close()
        return
    except WebSocketDisconnect:
        return

    if raw.get("action") != "setup":
        await websocket.send_json({"type": "error", "message": "First message must be {action: 'setup', ...}"})
        await websocket.close()
        return

    persona_id = raw.get("personaId", "")
    persona_ids = raw.get("personaIds", [])  # Multi-persona support
    user_id = raw.get("userId", "")
    voice_id = raw.get("voiceId", DEFAULT_VOICE_ID)
    session_id = raw.get("sessionId", "") or (context.session_id or "")

    # Support both single persona and multi-persona
    if not persona_ids and persona_id:
        persona_ids = [persona_id]
    elif isinstance(persona_ids, str):
        persona_ids = [p.strip() for p in persona_ids.split(",") if p.strip()]

    print(f"[WebSocket] Setup: user={user_id} personas={persona_ids} session={session_id}", flush=True)

    _otel_ctx = baggage.set_baggage("session.id", session_id)
    _otel_token = otel_context.attach(_otel_ctx)

    if not persona_ids or not user_id or not session_id:
        await websocket.send_json({"type": "error", "message": "Missing personaId(s), userId, or sessionId"})
        await websocket.close()
        return

    agent = None
    ws_output = None
    ws_input = None
    client_disconnected = False

    try:
        # Load all selected personas
        all_personas = []
        for pid in persona_ids:
            p = await load_persona(pid)
            if p:
                all_personas.append(p)

        if not all_personas:
            await websocket.send_json({"type": "error", "message": "No valid personas found"})
            await websocket.close()
            return

        persona_data = all_personas[0]  # Primary persona for analytics

        transcript_text = await load_transcript(user_id, session_id)
        if not transcript_text:
            transcript_text = "No presentation transcript available."

        # Average QA time limits across personas
        session_duration = int(sum(int(p.get('qaTimeLimitSec', 300)) for p in all_personas) / len(all_personas))

        # Build combined panel prompt if multiple personas
        if len(all_personas) == 1:
            system_prompt = build_qa_system_prompt(
                persona_name=persona_data.get('name', 'Stakeholder'),
                persona_prompt=persona_data.get('personaPrompt', ''),
                custom_instructions=persona_data.get('description', ''),
                transcript_text=transcript_text,
                session_duration=session_duration,
            )
        else:
            system_prompt = build_panel_system_prompt(all_personas, transcript_text, session_duration)

        model = create_nova_sonic_model(voice_id)
        time_guard = SessionTimeGuard(session_duration)
        agent = BidiAgent(
            model=model,
            tools=[stop_conversation],
            system_prompt=system_prompt,
            hooks=[time_guard],
        )

        await websocket.send_json({
            "type": "session_started",
            "persona_name": persona_data.get('name', 'Stakeholder'),
            "session_id": session_id,
        })

        ws_input = WebSocketBidiInput(websocket, time_guard=time_guard)
        ws_output = WebSocketBidiOutput(websocket)

        async def analytics_watcher():
            await ws_input._analytics_requested.wait()
            if not ws_output.transcript_entries:
                return
            try:
                feedback = await generate_qa_analytics(ws_output.transcript_entries, persona_data)
                total_q = sum(1 for e in ws_output.transcript_entries if e['role'] == 'assistant')
                total_r = sum(1 for e in ws_output.transcript_entries if e['role'] == 'user')
                await websocket.send_json({
                    "type": "qa_analytics",
                    "qaFeedback": feedback,
                    "totalQuestions": total_q,
                    "totalResponses": total_r,
                })
                await save_qa_analytics(user_id, session_id, ws_output.transcript_entries, feedback)
            except Exception as e:
                print(f"[WebSocket] Analytics error: {e}", flush=True)

        try:
            analytics_task = asyncio.create_task(analytics_watcher())
            await agent.run(inputs=[ws_input], outputs=[ws_output])
        except WebSocketDisconnect:
            client_disconnected = True
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"[WebSocket] Agent run error: {e}", flush=True)
        finally:
            analytics_task.cancel()
            try:
                await analytics_task
            except (asyncio.CancelledError, Exception):
                pass

        # Fallback analytics if not requested by client
        if not ws_input._analytics_requested.is_set() and ws_output and ws_output.transcript_entries and not client_disconnected:
            try:
                feedback = await generate_qa_analytics(ws_output.transcript_entries, persona_data)
                total_q = sum(1 for e in ws_output.transcript_entries if e['role'] == 'assistant')
                total_r = sum(1 for e in ws_output.transcript_entries if e['role'] == 'user')
                await websocket.send_json({
                    "type": "qa_analytics",
                    "qaFeedback": feedback,
                    "totalQuestions": total_q,
                    "totalResponses": total_r,
                })
                await save_qa_analytics(user_id, session_id, ws_output.transcript_entries, feedback)
            except Exception:
                pass

    except Exception as e:
        print(f"[WebSocket] Handler error: {e}", flush=True)
    finally:
        if _otel_token is not None:
            otel_context.detach(_otel_token)
        if agent:
            try:
                await agent.stop()
            except Exception:
                pass
        try:
            await websocket.send_json({"type": "session_ended", "reason": "server_complete"})
        except Exception:
            pass
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    app.run()
