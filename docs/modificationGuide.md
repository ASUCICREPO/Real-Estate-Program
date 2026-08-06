# Modification Guide — W. P. Carey Real Estate Program AI Presentation Coach

This guide is for developers who want to extend, customize, or adapt the platform.

---

## Project Structure

```
├── backend/
│   ├── bin/backend.ts                  # CDK app entry — instantiates all stacks
│   ├── lib/
│   │   ├── backend-stack.ts            # Core infrastructure (Cognito, S3, DynamoDB, API GW, Lambdas, Guardrails)
│   │   ├── agentcore-stack.ts          # Bedrock AgentCore voice agent runtime
│   │   ├── amplify-hosting-stack.ts    # Amplify app + optional GitHub source
│   │   └── frontend-config-stack.ts   # Injects CDK outputs as Amplify env vars
│   ├── lambda/
│   │   ├── s3-presigned-url-gen/       # Pre-signed URL generator
│   │   ├── persona-crud/               # Persona CRUD (DynamoDB)
│   │   ├── post-meeting-analytics/     # AI feedback via Bedrock Nova Lite
│   │   ├── content-analysis/           # PDF content analysis + question generation
│   │   ├── anam-session-token/         # Anam AI avatar session token exchange
│   │   └── layers/boto3-latest/        # Shared boto3 Lambda layer
│   └── agentcore/
│       ├── index.py                    # Voice agent (Nova 2 Sonic via Strands BidiAgent)
│       ├── qa_system_prompt.jinja2     # Persona Q&A system prompt template
│       ├── Dockerfile                  # Container image for AgentCore runtime
│       └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── components/                 # React UI components
│   │   │   └── practice/               # Practice session sub-components
│   │   ├── hooks/                      # Custom hooks (audio, video, gaze, analytics)
│   │   ├── services/
│   │   │   ├── api.ts                  # REST API service layer
│   │   │   └── websocket.ts            # AgentCore WebSocket client
│   │   └── config/config.ts            # Centralized configuration and constants
│   └── public/
├── deploy.sh                           # One-command CloudShell deployment script
├── buildspec-deploy.yml                # CodeBuild deployment spec
└── docs/
```

---

## Common Modifications

### Add or Modify a Persona

Personas live in DynamoDB and are managed through the app's Admin panel (sign in as Admin → Personas). No code change needed.

To change what fields a persona can have, update the `Persona` interface in `frontend/app/config/config.ts` and the DynamoDB read/write logic in `backend/lambda/persona-crud/index.py`.

---

### Change Delivery Metric Targets

Default best-practice thresholds are in `frontend/app/config/config.ts`:

```typescript
export const DEFAULT_BEST_PRACTICES: PersonaBestPractices = {
  wpm: { min: 140, max: 160 },
  eyeContact: { min: 60 },
  fillerWords: { max: 3 },
  pauses: { min: 4 },
};
```

Per-persona overrides are stored in each persona's DynamoDB record under `bestPractices`. The frontend merges them: `DEFAULT_BEST_PRACTICES ← persona.bestPractices ← per-session override`.

---

### Add a New Filler Word

Edit `FILLER_WORDS` in `frontend/app/config/config.ts`:

```typescript
FILLER_WORDS: ['um', 'uh', 'like', 'actually', 'you know', 'basically', 'so', 'right', 'well'],
```

---

### Modify the AI Feedback Prompt

The post-session analytics prompt is built in `backend/lambda/post-meeting-analytics/index.py`. Look for the `build_analysis_prompt()` function and adjust the persona framing, scoring criteria, or output schema as needed.

The Bedrock model is configured via the `QA_ANALYTICS_MODEL_ID` Lambda environment variable (default: `global.amazon.nova-2-lite-v1:0`). Change it to any model ID supported by your account.

---

### Modify the Voice Q&A System Prompt

Edit `backend/agentcore/qa_system_prompt.jinja2`. The template receives:
- `persona_name` — the persona's display name
- `persona_prompt` — the persona's coaching prompt from DynamoDB
- `custom_instructions` — student-provided custom notes
- `transcript_text` — the presentation transcript
- `qa_limit` — Q&A duration in minutes

After editing, redeploy the AgentCore container:

```bash
cd backend
cdk deploy AgentCoreStack-main -c branchName=main
```

---

### Change the Q&A Voice

Each persona record in DynamoDB has a `voiceId` field. Valid values:
`matthew`, `tiffany`, `amy`, `ambre`, `florian`, `beatrice`, `lorenzo`, `greta`, `lennart`, `lupe`, `carlos`

Update the persona's `voiceId` via the Admin panel. No deployment needed.

---

### Add a New Lambda Endpoint

1. Create `backend/lambda/<your-function>/index.py`
2. Add the Lambda and API Gateway route in `backend/lib/backend-stack.ts`:

```typescript
const myLambda = new lambda.Function(this, 'MyLambda', {
  runtime: lambda.Runtime.PYTHON_3_13,
  handler: 'index.lambda_handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda', 'my-function')),
  timeout: cdk.Duration.seconds(30),
  environment: { 'UPLOADS_BUCKET': uploadsBucket.bucketName },
});

const myResource = api.root.addResource('my-endpoint');
myResource.addMethod('POST', new apigateway.LambdaIntegration(myLambda), {
  authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

3. Add the corresponding API call in `frontend/app/services/api.ts`
4. Redeploy: `cdk deploy RealEstateProgramStack-main -c branchName=main`

---

### Modify the Practice Session Layout

The main recording view is in `frontend/app/components/PracticeSession.tsx`. Sub-components are in `frontend/app/components/practice/`:

| Component | Purpose |
|-----------|---------|
| `PracticeSessionHeader.tsx` | Header with back button and timer |
| `CompactMetricsBar.tsx` | Horizontal delivery metrics cards at the top |
| `CameraView.tsx` | Webcam feed, recording badge, and controls |
| `PdfViewer.tsx` | PDF iframe with toolbar suppressed |
| `PdfPlaceholder.tsx` | Empty state when no PDF is uploaded |
| `CalibrationPanel.tsx` | Face mesh + gaze calibration step |
| `MicCheckCard.tsx` | Microphone level check |
| `RealTimeFeedbackPanel.tsx` | Sidebar metrics panel (used in older layout) |
| `TranscriptionPanel.tsx` | Live transcript display |

The current layout uses a **40/60 grid split**: camera on the left (`lg:col-span-2`) and PDF on the right (`lg:col-span-3`) within a `lg:grid-cols-5` grid.

---

### Change the Transcription Provider

Edit `TRANSCRIPTION.PROVIDER` in `frontend/app/config/config.ts`:

```typescript
PROVIDER: 'aws-transcribe' as 'web-speech' | 'aws-transcribe',
```

- `'aws-transcribe'` — Amazon Transcribe Streaming (recommended; captures filler words)
- `'web-speech'` — Browser Web Speech API (free but suppresses disfluencies like "um")

---

### Adjust Video Recording Chunk Size

Video is uploaded in 90-second multipart chunks. Change `CHUNK_INTERVAL_MS` in `frontend/app/config/config.ts`:

```typescript
CHUNK_INTERVAL_MS: 90_000,  // 90 seconds per chunk
```

S3 requires a minimum 5 MB per multipart part (except the last). At 640×480 at ~500 kbps, 90 seconds produces ~5.6 MB — safe margin. Don't go below 60 seconds.

---

### Update Bedrock Guardrail Filters

Edit the `ContentGuardrail` resource in `backend/lib/backend-stack.ts`. Current filters:

```typescript
contentPolicyConfig: {
  filtersConfig: [
    { type: 'HATE', inputStrength: 'HIGH', outputStrength: 'MEDIUM' },
    { type: 'SEXUAL', inputStrength: 'HIGH', outputStrength: 'HIGH' },
    { type: 'PROMPT_ATTACK', inputStrength: 'HIGH', outputStrength: 'NONE' },
    // ...
  ],
},
```

After changing, redeploy the backend stack: `cdk deploy RealEstateProgramStack-main -c branchName=main`.

---

### Add GitHub Actions CI/CD

The `deploy.sh` script supports GitHub mode — Amplify auto-builds on every push to `main`:

```bash
bash deploy.sh
# When prompted for GitHub token, provide a PAT with repo + admin:repo_hook scopes
```

Alternatively, pass context flags directly:

```bash
cdk deploy --all -c branchName=main \
  -c githubOwner=ASUCICREPO \
  -c githubRepo=Real-Estate-Program \
  -c githubToken=<pat>
```

---

### Local Development

```bash
# Backend — synthesize CDK to check for errors
cd backend && npm install && cdk synth -c branchName=main

# Frontend — run dev server against deployed backend
cd frontend
# Create .env.local with your deployed stack values (see deploymentGuide.md)
npm install && npm run dev
# App runs at http://localhost:3000
```

---

## Deployment After Changes

**Frontend only** — no CDK needed:
```bash
cd frontend && npm run build
cd out && zip -r ../../deploy.zip . && cd ../..
# Then run the Amplify create-deployment + start-deployment commands from deploymentGuide.md
```

**Backend changes:**
```bash
cd backend
cdk deploy RealEstateProgramStack-main -c branchName=main  # API, Lambdas, auth
# or
cdk deploy AgentCoreStack-main -c branchName=main           # Voice agent only
# or
cdk deploy --all -c branchName=main                         # Everything
```

**AgentCore code changes** (index.py, qa_system_prompt.jinja2, Dockerfile):
```bash
cd backend
cdk deploy AgentCoreStack-main -c branchName=main
# CDK rebuilds and pushes the Docker image, then updates the runtime
```
