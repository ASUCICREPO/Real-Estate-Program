# Deployment Guide — W. P. Carey Real Estate Program AI Presentation Coach

Everything deploys with a single CDK command. The four stacks wire themselves together automatically — Amplify app, backend API, AgentCore voice runtime, and frontend environment variables.

---

## Prerequisites

Install these once:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| AWS CDK | v2 | `npm install -g aws-cdk` |
| AWS CLI | v2 | [docs](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Docker | any | [docker.com](https://www.docker.com/) — needed to build the AgentCore image |

You also need:
- An AWS account with access to **us-east-1**
- Amazon Bedrock model access enabled for `amazon.nova-lite-v1`, `amazon.nova-2-sonic-v1`, and `global.amazon.nova-2-lite-v1` in us-east-1 ([enable here](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess))
- An Anam AI API key from [app.anam.ai](https://app.anam.ai) → Account Settings → API Keys

---

## Deploy

### 1. Clone and install

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program/backend
npm install
```

### 2. Bootstrap CDK (first time only)

```bash
cdk bootstrap --profile <your-aws-profile>
```

### 3. Deploy everything

```bash
ANAM_API_KEY=<your-anam-api-key> \
cdk deploy --all -c branchName=main --profile <your-aws-profile>
```

Type `y` when prompted to confirm IAM changes. Deployment takes ~10–15 minutes.

This single command deploys all four stacks:
- **AmplifyHostingStack** — creates the Amplify app and hosting domain
- **RealEstateProgramStack** — Cognito, S3, DynamoDB, API Gateway, Lambda functions, Bedrock Guardrails
- **AgentCoreStack** — builds and deploys the Nova 2 Sonic voice agent container
- **FrontendConfigStack** — wires all CDK outputs as environment variables into the Amplify app

### 4. Deploy the frontend

After CDK completes, build and ship the frontend:

```bash
cd ../frontend
npm install
npm run build

# Package and deploy to Amplify
cd out
zip -r ../../deploy.zip .
cd ../..

AMPLIFY_APP_ID=$(aws amplify list-apps --profile <your-aws-profile> \
  --query "apps[?contains(name,'real-estate-program-main')].appId" \
  --output text)

aws amplify create-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --profile <your-aws-profile> > /tmp/deploy.json

curl -s --request PUT --upload-file deploy.zip \
  "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['zipUploadUrl'])")"

aws amplify start-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['jobId'])")" \
  --profile <your-aws-profile>
```

Your app is live at the URL printed in the CDK outputs:
```
FrontendConfigStack-main.AmplifyAppUrl = https://main.d2v1f9m26bi3az.amplifyapp.com
```

---

## Seed Personas (first deploy only)

The DynamoDB table is empty after first deploy. Add the four personas via the app's Admin panel (sign in → Admin → Personas → New Persona) or directly in the AWS Console DynamoDB editor.

Required Anam persona IDs:

| Persona | Anam Persona ID |
|---------|----------------|
| Commercial Lender | `26981553-4601-4799-b64b-7dfa1580de8c` |
| Public Official | `855745e8-056d-4848-a5a0-3752e88cdecc` |
| Real Estate Agent | `36908df0-128e-48c6-b2f3-cbf007707d00` |
| Negotiation Counterparty | `19e62cdb-8c39-4b58-a96b-a8a4cc5899e0` |

---

## Re-deploy Frontend Changes Only

When you only change frontend code (no backend changes), skip `cdk deploy` entirely:

```bash
cd frontend
npm run build
cd out && zip -r ../../deploy.zip . && cd ../..

AMPLIFY_APP_ID=<your-amplify-app-id>

aws amplify create-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --profile <your-aws-profile> > /tmp/deploy.json

curl -s --request PUT --upload-file deploy.zip \
  "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['zipUploadUrl'])")"

aws amplify start-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['jobId'])")" \
  --profile <your-aws-profile>
```

---

## Optional: Auto-deploy via GitHub

To connect the Amplify app to GitHub so every push to `main` auto-deploys, add three extra context flags to the CDK deploy command:

```bash
ANAM_API_KEY=<key> \
cdk deploy --all -c branchName=main \
  -c githubOwner=ASUCICREPO \
  -c githubRepo=Real-Estate-Program \
  -c githubToken=<github-personal-access-token> \
  --profile <your-aws-profile>
```

After this, every push to the `main` branch triggers an Amplify build automatically — no manual zip deploy needed.

---

## Teardown

```bash
cd backend
cdk destroy --all -c branchName=main --profile <your-aws-profile>
```

> **Warning**: Destroys all S3 data, DynamoDB personas, and Cognito user accounts permanently.

---

## Troubleshooting

**CDK bootstrap error** — run `cdk bootstrap --profile <profile>` once per account/region before deploying.

**Docker not running** — AgentCore stack builds a Docker image. Start Docker Desktop and retry.

**Anam 401 error** — the `ANAM_API_KEY` Lambda env var is wrong or empty. Update it:
```bash
aws lambda update-function-configuration \
  --function-name $(aws lambda list-functions --profile <profile> \
    --query 'Functions[?contains(FunctionName,`Anam`)].FunctionName' --output text) \
  --environment '{"Variables":{"ANAM_API_KEY":"<key>","ALLOWED_ORIGINS":"http://localhost:3000,https://main.<app-id>.amplifyapp.com"}}' \
  --profile <profile>
```

**Amplify 404** — the zip must be built from inside `out/` so `index.html` is at the root. Always `cd out && zip -r ../../deploy.zip .`.

**Bedrock access denied** — enable Nova Lite and Nova 2 Sonic in [Bedrock Model Access](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess) for us-east-1.
