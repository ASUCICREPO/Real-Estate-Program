# API Documentation — W. P. Carey Real Estate Program AI Presentation Coach

---

## Overview

The backend exposes a REST API through Amazon API Gateway and a WebSocket endpoint through Bedrock AgentCore. All REST routes require a valid Amazon Cognito JWT passed in the `Authorization` header.

---

## Base URL

```
https://<api-id>.execute-api.us-east-1.amazonaws.com/prod/
```

Found in CDK outputs as `RealEstateProgramStack-main.ApiUrl`.

---

## Authentication

All REST endpoints use **Cognito User Pool authorization**. Include the ID token from Cognito in every request:

```
Authorization: <CognitoIdToken>
```

Obtain the token via the Amplify Auth SDK:

```typescript
import { fetchAuthSession } from 'aws-amplify/auth';

const session = await fetchAuthSession();
const token = session.tokens?.idToken?.toString();
```

The WebSocket endpoint uses **IAM SigV4 signing** with credentials from the Cognito Identity Pool.

---

## REST Endpoints

---

### S3 Pre-signed URLs

#### `GET /s3_urls` — Get download URL

Returns a pre-signed GET URL to read a session file from S3.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Session identifier (e.g. `session_1234567890`) |
| `type` | string | Yes | File type: `session`, `transcript`, `session_analytics`, `detailed_metrics`, `manifest` |

**Response:**
```json
{
  "url": "https://s3.amazonaws.com/bucket/path?X-Amz-..."
}
```

---

#### `POST /s3_urls` — Get upload URL(s)

Returns pre-signed PUT URLs for uploading session files.

**Request body:**
```json
{
  "sessionId": "session_1234567890",
  "type": "ppt | session | metric_chunk | persona_customization | transcript | session_analytics | detailed_metrics | manifest",
  "partNumber": 1,
  "uploadId": "abc123"
}
```

- `type: "ppt"` — returns a URL to upload a PDF presentation
- `type: "session"` — initiates or continues a multipart video upload; requires `partNumber` and `uploadId`
- `type: "manifest"` — returns a URL to write the session coordination manifest

**Response (single file upload):**
```json
{
  "url": "https://s3.amazonaws.com/bucket/path?X-Amz-..."
}
```

**Response (multipart initiation):**
```json
{
  "uploadId": "abc123",
  "url": "https://s3.amazonaws.com/bucket/path?partNumber=1&uploadId=abc123&X-Amz-..."
}
```

---

### Personas

#### `GET /personas` — List all personas

Returns all persona records from DynamoDB.

**Response:**
```json
{
  "items": [
    {
      "personaID": "uuid",
      "name": "Commercial Lender",
      "description": "...",
      "personaPrompt": "...",
      "expertise": "intermediate",
      "keyPriorities": ["debt service coverage", "loan-to-value ratio"],
      "presentationTime": "15 minutes",
      "communicationStyle": "analytical",
      "timeLimitSec": 900,
      "qaTimeLimitSec": 300,
      "voiceId": "matthew",
      "anamPersonaId": "26981553-4601-4799-b64b-7dfa1580de8c",
      "bestPractices": {
        "wpm": { "min": 130, "max": 160 },
        "eyeContact": { "min": 65 },
        "fillerWords": { "max": 3 },
        "pauses": { "min": 4 }
      }
    }
  ],
  "nextToken": null
}
```

---

#### `POST /personas` — Create a persona

**Request body:**
```json
{
  "name": "Commercial Lender",
  "description": "...",
  "personaPrompt": "You are a commercial lender evaluating...",
  "expertise": "intermediate",
  "keyPriorities": ["debt service coverage", "loan-to-value ratio"],
  "presentationTime": "15 minutes",
  "communicationStyle": "analytical",
  "timeLimitSec": 900,
  "qaTimeLimitSec": 300,
  "voiceId": "matthew",
  "anamPersonaId": "26981553-4601-4799-b64b-7dfa1580de8c",
  "icon": "briefcase",
  "bestPractices": {
    "wpm": { "min": 130, "max": 160 },
    "eyeContact": { "min": 65 },
    "fillerWords": { "max": 3 },
    "pauses": { "min": 4 }
  },
  "scoringWeights": {
    "pace": 0.25,
    "eyeContact": 0.30,
    "fillerWords": 0.20,
    "pauses": 0.25
  }
}
```

**Response:** `201 Created` with the created persona object including the generated `personaID`.

---

#### `GET /personas/{personaID}` — Get a single persona

**Response:** Single persona object (same shape as items above).

---

#### `PUT /personas/{personaID}` — Update a persona

**Request body:** Any subset of the persona fields to update.

**Response:** Updated persona object.

---

#### `DELETE /personas/{personaID}` — Delete a persona

**Response:**
```json
{ "message": "Persona deleted successfully" }
```

---

### Analytics

#### `GET /analytics` — Get post-session AI feedback

Polls for AI analysis results. The analysis Lambda runs asynchronously after the manifest is completed; this endpoint returns the results once ready.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | Session identifier |

**Response (ready):**
```json
{
  "status": "completed",
  "sessionId": "session_1234567890",
  "overallScore": 78,
  "deliverySummary": "...",
  "strengths": ["Strong eye contact throughout", "Well-paced delivery"],
  "improvements": ["Reduce filler words", "Add more strategic pauses"],
  "personaFeedback": "From a commercial lender's perspective...",
  "metricBreakdown": {
    "pace": { "score": 82, "average": 145, "target": "130-160 wpm" },
    "eyeContact": { "score": 90, "percentage": 78, "target": "≥65%" },
    "fillerWords": { "score": 65, "count": 12, "target": "≤3 per 30s" },
    "pauses": { "score": 70, "count": 18, "target": "≥4 per 30s" }
  }
}
```

**Response (processing):**
```json
{ "status": "processing" }
```

The frontend polls this endpoint every 3 seconds until `status` is `"completed"`.

---

### Content Analysis

#### `POST /content` — Analyse uploaded PDF

Triggers content analysis of an uploaded PDF and generates persona-specific questions.

**Request body:**
```json
{
  "sessionId": "session_1234567890",
  "personaId": "uuid"
}
```

**Response:**
```json
{
  "summary": "The presentation covers a mixed-use development in Tempe...",
  "questions": [
    "What is the projected debt service coverage ratio in year 1?",
    "How does the proposed LTV compare to current market standards?"
  ]
}
```

---

### Anam Session Token

#### `POST /anam-session` — Get Anam AI avatar session token

Exchanges the backend Anam API key for a short-lived client session token used to initialize the Anam avatar.

**Request body:**
```json
{
  "anamPersonaId": "26981553-4601-4799-b64b-7dfa1580de8c"
}
```

**Response:**
```json
{
  "sessionToken": "eyJ..."
}
```

**Error responses:**
- `400` — missing `anamPersonaId`
- `500` — `ANAM_API_KEY` not configured on the Lambda
- `502` — Anam API returned an error (check API key validity)

---

## WebSocket — Live Voice Q&A

The WebSocket endpoint connects to the Bedrock AgentCore runtime for bidirectional voice streaming.

**URL:** `wss://bedrock-agentcore.<region>.amazonaws.com/runtimes/<runtime-arn>/ws`

Found in CDK outputs as `AgentCoreStack-main.AgentCoreWebSocketUrl`.

**Auth:** IAM SigV4 signed WebSocket connection using Cognito Identity Pool credentials.

---

### Connection Flow

**1. Client connects** (SigV4 signed WebSocket URL)

**2. Client sends setup frame:**
```json
{
  "action": "setup",
  "personaId": "uuid",
  "userId": "cognito-sub-uuid",
  "sessionId": "session_1234567890",
  "voiceId": "matthew",
  "qaTimeLimitSec": 300,
  "previousContext": "optional: Q&A summary from prior persona sessions"
}
```

**3. Server responds with session_started:**
```json
{
  "type": "session_started",
  "persona_name": "Commercial Lender",
  "session_id": "session_1234567890"
}
```

---

### Client → Server Messages

| Action | Description |
|--------|-------------|
| `{"action": "audio", "data": "<base64-pcm>"}` | Send raw PCM audio chunk (16 kHz, mono, 16-bit) |
| `{"action": "get_analytics"}` | Request Q&A analytics generation |
| `{"action": "end"}` | End the session gracefully |

---

### Server → Client Messages

| Type | Description |
|------|-------------|
| `{"type": "audio", "data": "<base64-pcm>"}` | PCM audio from the persona (16 kHz, mono) |
| `{"type": "audio_clear"}` | Clear buffered audio (guardrail intervention) |
| `{"type": "transcript", "role": "user\|assistant", "text": "...", "is_partial": true\|false}` | Transcript segment |
| `{"type": "interruption"}` | User interrupted the persona |
| `{"type": "guardrail_intervention", "sanitized_text": "..."}` | Content blocked by guardrails |
| `{"type": "qa_analytics", "qaFeedback": {...}, "totalQuestions": N, "totalResponses": N}` | Q&A session analytics |
| `{"type": "session_ended", "reason": "server_complete"}` | Session finished |
| `{"type": "error", "message": "..."}` | Setup or runtime error |

---

### Q&A Analytics Response Shape

```json
{
  "type": "qa_analytics",
  "totalQuestions": 4,
  "totalResponses": 4,
  "qaFeedback": {
    "overallSummary": "The presenter demonstrated solid knowledge...",
    "responseQuality": "Good",
    "strengths": ["Direct answers", "Used specific numbers"],
    "improvements": ["Acknowledge risk more proactively"],
    "questionBreakdown": [
      {
        "question": "What is your projected DSCR in year 1?",
        "rating": "Strong",
        "note": "Answered with specific figure and explained assumptions"
      }
    ]
  }
}
```

---

## Error Codes

| HTTP Code | Meaning |
|-----------|---------|
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — missing or expired Cognito token |
| `403` | Forbidden — valid token but insufficient permissions |
| `404` | Not found — session or persona doesn't exist |
| `500` | Internal server error — check CloudWatch logs |
| `502` | Bad gateway — upstream service (Anam, Bedrock) returned an error |

---

## S3 Object Paths

All session files are stored under `{userId}/{sessionId}/`:

| File | Description |
|------|-------------|
| `presentation.pdf` | Uploaded PDF slides |
| `recording.webm` | Multipart video recording |
| `transcript.json` | Full presentation transcript |
| `session_analytics.json` | Per-second delivery metrics summary |
| `detailed_metrics.json` | Per-second metric snapshots |
| `manifest.json` | Session coordination metadata |
| `CUSTOM_PERSONA_INSTRUCTION.txt` | Custom persona notes |
| `qa_transcript.json` | Q&A session transcript |
| `qa_analytics.json` | Q&A session AI feedback |

Files expire automatically after **14 days** via S3 lifecycle rules.
