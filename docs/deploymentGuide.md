# Deployment Guide — W. P. Carey Real Estate Program AI Presentation Coach

---

## Table of Contents

- [Requirements](#requirements)
- [Pre-Deployment Setup](#pre-deployment-setup)
- [Backend Deployment (CDK)](#backend-deployment-cdk)
- [AgentCore Deployment](#agentcore-deployment)
- [Frontend Deployment (Amplify)](#frontend-deployment-amplify)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Re-deploying Frontend Changes](#re-deploying-frontend-changes)
- [Teardown](#teardown)
- [Troubleshooting](#troubleshooting)

---

## Requirements

### Accounts
- [ ] **AWS Account** with sufficient permissions (see below)
- [ ] **Anam AI Account** — [https://app.anam.ai](https://app.anam.ai) — needed for avatar session tokens

### CLI Tools
- [ ] **AWS CLI v2** — [Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [ ] **Node.js 18+** — [Install](https://nodejs.org/)
- [ ] **AWS CDK v2** — `npm install -g aws-cdk`
- [ ] **Docker** — required to build the AgentCore container image
- [ ] **Python 3.13** — required for the AgentCore image and Lambda layer bundling

### AWS IAM Permissions
The deploying IAM user/role needs permissions for:
CloudFormation, Lambda, API Gateway, S3, DynamoDB, Cognito, Bedrock, ECR, Bedrock AgentCore, Amplify, IAM, CloudWatch Logs

### Bedrock Model Access
Enable the following models in your AWS account (us-east-1):
- `amazon.nova-lite-v1:0`
- `amazon.nova-2-sonic-v1:0`
- `global.amazon.nova-2-lite-v1:0` (cross-region inference profile)

---

## Pre-Deployment Setup

### 1. Clone the repository

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program
```

### 2. Configure AWS credentials

```bash
aws configure --profile <your-profile>
# Enter: Access Key ID, Secret Access Key, region (us-east-1), output (json)
```

Or if using SSO:
```bash
aws sso login --profile <your-profile>
```

### 3. Bootstrap CDK (first-time only per account/region)

```bash
cd backend
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1 --profile <your-profile>
```

### 4. Install backend dependencies

```bash
cd backend
npm install
```

### 5. Get your Anam API key

Log into [https://app.anam.ai](https://app.anam.ai) → Account Settings → API Keys → copy your key.

---

## Backend Deployment (CDK)

### 1. Set required environment variables

```bash
export ANAM_API_KEY="<your-anam-api-key>"
```

### 2. (Optional) Review the synthesized CloudFormation

```bash
cd backend
cdk synth --profile <your-profile>
```

### 3. Deploy all stacks

```bash
cd backend
cdk deploy --all --profile <your-profile>
```

When prompted, review IAM changes and type `y` to confirm.

This deploys four stacks:
- `RealEstateProgramStack-main` — core infrastructure (Cognito, S3, DynamoDB, API Gateway, Lambdas, Guardrails)
- `AgentCoreStack-main` — Bedrock AgentCore runtime
- `AmplifyHostingStack-main` — Amplify app and branch
- `FrontendConfigStack-main` — injects CDK outputs as Amplify environment variables

### 4. Note the CDK outputs

After deployment completes, you'll see outputs like:

```
RealEstateProgramStack-main.UserPoolId         = us-east-1_XXXXXXXXX
RealEstateProgramStack-main.UserPoolClientId   = XXXXXXXXXXXXXXXXXXXXXXXXXX
RealEstateProgramStack-main.IdentityPoolId     = us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
RealEstateProgramStack-main.ApiUrl             = https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/
RealEstateProgramStack-main.UploadsBucketName  = realestateuploadsbucket-main-XXXX
AgentCoreStack-main.WebSocketApiUrl            = wss://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com/prod/
```

Save these — you'll need them for the frontend configuration.

---

## AgentCore Deployment

The AgentCore stack builds and pushes the voice agent Docker image automatically during `cdk deploy --all`. If you need to redeploy the agent image separately:

```bash
cd backend/agentcore

# Build the image
docker build -t real-estate-agentcore .

# Authenticate to ECR (replace <account> and <region>)
aws ecr get-login-password --region us-east-1 --profile <your-profile> | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push
docker tag real-estate-agentcore:latest \
  <account>.dkr.ecr.us-east-1.amazonaws.com/real-estate-agentcore:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/real-estate-agentcore:latest
```

Then update the AgentCore runtime to use the new image via the AWS Console or CLI.

---

## Frontend Deployment (Amplify)

The frontend is a Next.js static export deployed as a zip to AWS Amplify. The `FrontendConfigStack` automatically injects the CDK outputs as Amplify environment variables, so the build picks them up automatically.

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Create a local env file (for local dev only — not needed for Amplify)

```bash
cat > frontend/.env.local << EOF
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId from CDK output>
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=<UserPoolClientId from CDK output>
NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID=<IdentityPoolId from CDK output>
NEXT_PUBLIC_API_BASE_URL=<ApiUrl from CDK output>
NEXT_PUBLIC_WEBSOCKET_API_URL=<WebSocketApiUrl from CDK output>
EOF
```

### 3. Build the static export

```bash
cd frontend
npm run build
# Output goes to frontend/out/
```

### 4. Package the build (index.html must be at zip root)

```bash
cd frontend/out
zip -r ../../deploy.zip .
cd ../..
```

### 5. Deploy to Amplify

```bash
# Create a deployment slot and get the upload URL
aws amplify create-deployment \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --profile <your-profile> > /tmp/deploy_response.json

# Extract job ID and upload URL
JOB_ID=$(python3 -c "import json; print(json.load(open('/tmp/deploy_response.json'))['jobId'])")
UPLOAD_URL=$(python3 -c "import json; print(json.load(open('/tmp/deploy_response.json'))['zipUploadUrl'])")

# Upload the zip
curl --request PUT --upload-file deploy.zip "$UPLOAD_URL"

# Start the deployment
aws amplify start-deployment \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --job-id "$JOB_ID" \
  --profile <your-profile>
```

The Amplify App ID is in the `AmplifyHostingStack-main` CDK outputs, or find it with:

```bash
aws amplify list-apps --profile <your-profile> \
  --query 'apps[*].{name:name,appId:appId}' --output table
```

### 6. Monitor the deployment

```bash
aws amplify get-job \
  --app-id <AMPLIFY_APP_ID> \
  --branch-name main \
  --job-id "$JOB_ID" \
  --profile <your-profile> \
  --query 'job.summary.{status:status,endTime:endTime}'
```

Status will be `SUCCEED` when live (usually under 60 seconds for a static zip deploy).

---

## Post-Deployment Configuration

### Set the Anam API key on the Lambda

The `ANAM_API_KEY` environment variable must be set on the `AnamSessionTokenLambda`. If you ran `cdk deploy` with `ANAM_API_KEY` exported, this is done automatically. To update it manually:

```bash
aws lambda update-function-configuration \
  --function-name <AnamSessionTokenLambda function name> \
  --environment '{"Variables":{"ANAM_API_KEY":"<your-key>","ALLOWED_ORIGINS":"http://localhost:3000,https://main.<amplify-id>.amplifyapp.com"}}' \
  --profile <your-profile>
```

Find the function name:
```bash
aws lambda list-functions --profile <your-profile> \
  --query 'Functions[?contains(FunctionName,`Anam`)].FunctionName' --output text
```

### Seed the Personas

The DynamoDB `PersonasTable` is empty on first deploy. You need to insert the four persona records. Use the AWS Console DynamoDB editor or a seed script. Each item requires:

```json
{
  "personaID": "<uuid>",
  "name": "Commercial Lender",
  "description": "...",
  "personaPrompt": "...",
  "timeLimitSec": 900,
  "qaTimeLimitSec": 300,
  "anamPersonaId": "26981553-4601-4799-b64b-7dfa1580de8c",
  "voiceId": "matthew",
  "bestPractices": {
    "wpm": { "min": 130, "max": 160 },
    "eyeContact": { "min": 65 },
    "fillerWords": { "max": 3 },
    "pauses": { "min": 4 }
  }
}
```

Anam persona IDs:
| Persona | Anam Persona ID |
|---------|----------------|
| Commercial Lender | `26981553-4601-4799-b64b-7dfa1580de8c` |
| Public Official | `855745e8-056d-4848-a5a0-3752e88cdecc` |
| Real Estate Agent | `36908df0-128e-48c6-b2f3-cbf007707d00` |
| Negotiation Counterparty | `19e62cdb-8c39-4b58-a96b-a8a4cc5899e0` |

---

## Re-deploying Frontend Changes

When you make frontend code changes:

```bash
# 1. Build
cd frontend && npm run build

# 2. Repackage from inside out/
cd out && zip -r ../../deploy.zip . && cd ../..

# 3. Deploy (same 3-command flow as above)
aws amplify create-deployment --app-id <ID> --branch-name main --profile <profile> > /tmp/r.json
curl --request PUT --upload-file deploy.zip "$(python3 -c "import json; print(json.load(open('/tmp/r.json'))['zipUploadUrl'])")"
aws amplify start-deployment --app-id <ID> --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/r.json'))['jobId'])")" --profile <profile>
```

---

## Teardown

To remove all AWS resources:

```bash
cd backend
cdk destroy --all --profile <your-profile>
```

> **Warning**: This deletes all DynamoDB data, S3 session recordings, and Cognito user accounts permanently. Back up anything you need before running this.

---

## Troubleshooting

### `cdk deploy` fails: "not bootstrapped"
```bash
cdk bootstrap aws://<ACCOUNT_ID>/<REGION> --profile <your-profile>
```

### `cdk deploy` fails: "Docker daemon not running"
The AgentCore stack builds a Docker image. Start Docker Desktop and retry.

### Lambda returns 500 on `/anam-session`
The `ANAM_API_KEY` is empty or invalid. Check the Lambda environment variable and confirm the key is active in the Anam dashboard.

### Amplify deploy returns 404
The zip was built from the wrong directory. `index.html` must be at the root of the zip:
```bash
# Correct — run from inside out/
cd frontend/out && zip -r ../../deploy.zip .
```

### Frontend shows "CORS error" on API calls
The Amplify app URL must be in the `ALLOWED_ORIGINS` environment variable on each Lambda. Redeploy the CDK stack with the correct `allowedOrigins` in `bin/backend.ts`.

### Voice Q&A WebSocket disconnects immediately
- Confirm `NEXT_PUBLIC_WEBSOCKET_API_URL` ends with `/` and matches the AgentCore endpoint
- Check the AgentCore runtime health in the AWS Console (Bedrock → AgentCore → Runtimes)
- Review AgentCore CloudWatch logs at `/aws/bedrock-agentcore/runtimes/<runtime-name>-DEFAULT`

### Bedrock model access denied
Enable Nova Lite and Nova 2 Sonic in the Bedrock console under **Model access** for `us-east-1`.
