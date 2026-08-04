# Architecture Deep Dive — W. P. Carey Real Estate Program AI Presentation Coach

---

## Architecture Diagram

![Architecture Diagram](./media/architecture.png)

---

## System Overview

The platform is a fully serverless AWS application. There are no EC2 instances or containers in the critical path — the only long-running compute is the Bedrock AgentCore runtime, which runs as a managed container for the live voice Q&A feature.

---

## End-to-End Request Flow

### 1. Authentication
Students and faculty sign in via Amazon Cognito (email + password). The Cognito Identity Pool issues temporary AWS credentials used directly by the browser for two operations: signing Amazon Transcribe WebSocket connections and uploading files to S3 via pre-signed URLs.

### 2. Persona Selection
The frontend calls `GET /personas` (API Gateway → Lambda → DynamoDB) to load the list of stakeholder personas. Each persona record includes the role name, description, coaching prompt, time limits, best-practice thresholds (target WPM, eye contact %, filler word ceiling, pause targets), Anam avatar persona ID, and Nova Sonic voice ID.

### 3. Session Setup
Before recording, the student can upload a PDF presentation (`POST /s3_urls` → pre-signed PUT → S3) and optionally add custom persona notes. These are stored under `{userId}/{sessionId}/` in S3.

### 4. Camera Calibration
The browser activates the webcam/microphone stream. MediaPipe Face Landmarker runs locally (WASM) at up to 30 fps to detect face position and eye gaze blendshapes. A mic volume meter (AudioWorklet) confirms audio is audible before recording starts.

### 5. Practice Recording
Once recording starts, three parallel processes run client-side:

- **Video recording**: `MediaRecorder` chunks the webcam stream into WebM segments (90-second intervals). Each chunk is uploaded to S3 as a multipart upload part via a pre-signed URL.
- **Live transcription**: Raw PCM audio is streamed to Amazon Transcribe Streaming over a SigV4-signed WebSocket. Partial and final transcripts appear in the UI in real time. Filler word detection, speaking pace (30-second rolling window), and pause detection run on the transcript stream.
- **Gaze analysis**: The MediaPipe rAF loop runs continuously, computing eye blendshape scores and setting a debounced "distracted" flag after 3 seconds of sustained look-away. An audio alert plays if the student looks away too long.

Delivery metrics (WPM, volume %, eye contact, filler words, pauses, monotone level from pitch variance) are sampled once per second and displayed in the compact metrics bar at the top of the practice view. Per-second snapshots are batched and uploaded to S3 as `detailed_metrics.json`.

### 6. Session Completion
When the student stops recording, the browser:
1. Finalises the multipart video upload
2. Uploads `session_analytics.json`, `transcript.json`, `detailed_metrics.json`, and a `manifest.json` coordination file to S3
3. Calls `GET /analytics?sessionId=...` which polls the Post-Meeting Analytics Lambda until analysis is ready

The analytics Lambda reads the session files from S3, constructs a structured prompt with persona context and delivery metrics, and invokes Amazon Bedrock (Nova Lite via cross-region inference profile) using structured output (tool use) to produce role-specific written feedback. Results are saved back to S3 and returned to the client.

### 7. Live Voice Q&A (Optional)
After reviewing written feedback, the student can start a live Q&A session. The browser:
1. Calls `POST /anam-session` to exchange a session token with Anam AI (for the avatar face)
2. Connects via WebSocket to the Bedrock AgentCore runtime
3. Sends a `setup` frame with `personaId`, `userId`, `sessionId`, and `voiceId`

The AgentCore container loads the persona from DynamoDB, retrieves the presentation transcript from S3, builds a Jinja2 system prompt, and runs a `BidiAgent` (Nova 2 Sonic) with:
- **Bidirectional audio streaming**: raw PCM in at 16 kHz, PCM audio out
- **Guardrail gate**: a speculative transcript buffer screens agent output against Bedrock Guardrails before audio is released to the client, with a 120-character / sentence-boundary trigger
- **Session time guard**: a hook monitors elapsed time and injects wrap-up nudges at 30s remaining, then forces `stop_conversation`
- **QA analytics**: at session end, Bedrock (Nova Lite) generates a structured Q&A quality summary and saves it to S3

---

## Technology Stack

### Frontend
- **Next.js 16** (App Router, static export `output: 'export'`)
- **React 19**, **TypeScript**, **Tailwind CSS**
- **MediaPipe Face Landmarker** — client-side gaze detection (WASM)
- **Amazon Transcribe Streaming SDK** — real-time speech-to-text over WebSocket
- **AWS Amplify JS SDK** — Cognito auth, S3 transfers
- **Anam AI SDK** (`@anam-ai/js-sdk`) — avatar rendering and audio sync
- **Zustand** — client state management
- **Sonner** — toast notifications

### Backend Infrastructure (AWS CDK — TypeScript)
- **Amazon Cognito** — User Pool (email sign-up, email MFA recovery) + Identity Pool (temporary credentials for Transcribe and S3)
- **Amazon API Gateway (REST)** — Cognito-authorised, CloudWatch access logs, CORS
- **AWS Lambda (Python 3.13)** — five functions (see below)
- **Amazon DynamoDB (on-demand)** — single `PersonasTable` with `personaID` partition key
- **Amazon S3** — `RealEstateUploads` bucket; 14-day lifecycle, CORS, multipart abort after 1 day
- **Amazon Bedrock** — Nova Lite (post-session analytics), Nova 2 Sonic (live Q&A), Bedrock Guardrails (content safety + PII)
- **Bedrock AgentCore** — managed container runtime for the voice agent
- **AWS Amplify Hosting** — static site hosting (manual zip deployment)

### Lambda Functions

| Function | Runtime | Timeout | Purpose |
|----------|---------|---------|---------|
| `S3UrlLambda` | Python 3.13 | 20s | Generates pre-signed S3 URLs for all upload types (PDF, recording parts, JSON, manifest) |
| `PersonaCrudLambda` | Python 3.13 | 20s | Full CRUD on DynamoDB personas table |
| `PostMeetingAnalyticsLambda` | Python 3.13 | 120s | Reads session files from S3, invokes Bedrock Nova Lite for structured written feedback |
| `ContentAnalysisLambda` | Python 3.13 | 120s | Analyses uploaded PDF content and generates persona-specific questions |
| `AnamSessionTokenLambda` | Python 3.13 | 15s | Exchanges Anam API key for a short-lived session token |

### Bedrock Guardrail Configuration
- **Input filters**: HATE (HIGH), SEXUAL (HIGH), PROMPT_ATTACK (HIGH)
- **Output filters**: HATE (MEDIUM), SEXUAL (HIGH)
- **PII anonymisation**: email, phone, address, name
- **PII blocking**: credit card numbers, SSNs

---

## Security Design

- **Authentication**: All API routes require a valid Cognito JWT (Cognito Authorizer on API Gateway)
- **Authorisation**: Cognito Identity Pool issues scoped temporary credentials — authenticated users can only `transcribe:StartStreamTranscriptionWebSocket` and access their own S3 paths via pre-signed URLs
- **Data isolation**: S3 keys are prefixed `{userId}/{sessionId}/` — the pre-signed URL Lambda validates the requesting user's identity before generating URLs
- **Secrets**: `ANAM_API_KEY` is stored as a Lambda environment variable (not in source code). In production, migrate to AWS Secrets Manager
- **Content safety**: All AI interactions (both written analytics and live voice Q&A) pass through Bedrock Guardrails. The voice agent uses a speculative transcript buffer to screen output before audio reaches the client
- **Transport**: HTTPS enforced on Amplify, SSL enforced on S3 bucket, CloudWatch access logs on API Gateway
- **cdk-nag**: AwsSolutionsChecks applied at synth time; all suppressions are documented with ADR-format reasons

---

## Infrastructure as Code

```
backend/
├── bin/backend.ts              # CDK app entry — instantiates all stacks
├── lib/
│   ├── backend-stack.ts        # Core stack: Cognito, S3, DynamoDB, API GW, Lambdas, Guardrails
│   ├── agentcore-stack.ts      # AgentCore runtime stack
│   ├── amplify-stack.ts        # Amplify hosting stack
│   └── frontend-config-stack.ts # Writes CDK outputs as Amplify env vars
└── lambda/
    ├── s3-presigned-url-gen/
    ├── persona-crud/
    ├── post-meeting-analytics/
    ├── content-analysis/
    ├── anam-session-token/
    └── layers/boto3-latest/     # Pinned boto3 layer for Bedrock structured output support
```

---

## Key Architectural Decisions

### Decision 1: Client-Side Gaze Detection

**Date**: 2026-05  
**Status**: Accepted

**Context**: Eye contact tracking is a core delivery metric. Options were server-side frame analysis (high latency, cost), a third-party SDK, or in-browser ML.

**Decision**: MediaPipe Face Landmarker runs entirely in the browser via WebAssembly.

**Rationale**: Zero server cost, sub-30ms latency, no video frames leave the device (privacy), works offline. Accuracy is sufficient for the coaching use case (detecting sustained look-away, not precise gaze coordinates).

**Tradeoff**: Initial WASM download (~8 MB), not available in environments without WebGL.

---

### Decision 2: Amazon Transcribe Streaming Over Web Speech API

**Date**: 2026-05  
**Status**: Accepted

**Context**: Filler word detection (`um`, `uh`, `like`) requires a transcription engine that does not suppress disfluencies. The browser Web Speech API (Google backend) filters them out.

**Decision**: Stream raw PCM audio to Amazon Transcribe Streaming over a SigV4-signed WebSocket, using Cognito Identity Pool temporary credentials.

**Rationale**: Amazon Transcribe reliably captures disfluencies; Cognito credentials avoid exposing AWS keys in the browser; partial results arrive with ~300ms latency, enabling real-time display.

**Tradeoff**: Requires Cognito Identity Pool setup; incurs per-minute Transcribe cost.

---

### Decision 3: Nova 2 Sonic via Bedrock AgentCore for Voice Q&A

**Date**: 2026-06  
**Status**: Accepted

**Context**: Live bidirectional voice Q&A with a persona requires a model that can handle interruption, turn-taking, and tool use simultaneously.

**Decision**: Use Amazon Nova 2 Sonic via the Strands `BidiAgent` abstraction, deployed on Bedrock AgentCore as a managed container.

**Rationale**: Nova 2 Sonic is a native multimodal model that handles audio input/output without a separate TTS/STT pipeline. AgentCore manages WebSocket lifecycle, session routing, and scaling. The `stop_conversation` tool gives the agent a clean way to end sessions.

**Tradeoff**: AgentCore adds deployment complexity (Docker, ECR); Nova 2 Sonic is region-specific (us-east-1).

---

### Decision 4: Speculative Transcript Guardrail Gate

**Date**: 2026-06  
**Status**: Accepted

**Context**: Bedrock Guardrails can block AI-generated audio after it has already been sent to the client, creating an inconsistent user experience.

**Decision**: Buffer audio chunks and screen the speculative transcript against the guardrail at sentence boundaries (or every 120 characters), releasing audio only after the screen passes.

**Rationale**: Prevents objectionable audio from reaching the browser. The sentence-boundary trigger minimises added latency. Guardrail calls time out after 0.8s to avoid stalling the audio stream.

**Tradeoff**: Adds 0–800ms latency per guardrail check; the timeout means the guardrail "fails open" under high latency conditions.

---

### Decision 5: Static Export + Manual Amplify Zip Deployment

**Date**: 2026-07  
**Status**: Accepted

**Context**: The frontend has no server-side rendering requirements. CI/CD via GitHub is not connected to this Amplify app.

**Decision**: `next build` with `output: 'export'` produces a static `out/` directory. Deployment is a manual zip upload via `aws amplify create-deployment` + `start-deployment`.

**Rationale**: No server needed, lowest hosting cost, simple deployment script. Re-deployment takes under 2 minutes.

**Tradeoff**: No incremental builds; every deploy re-uploads all static assets. Connect Amplify to GitHub for automatic deploys when the team is ready.
