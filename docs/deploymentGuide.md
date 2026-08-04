# Deployment Guide — W. P. Carey Real Estate Program AI Presentation Coach

Everything deploys with a single CDK command. The four stacks wire themselves together automatically — Amplify hosting, backend API, AgentCore voice runtime, and frontend environment variables.

Choose your deployment path:

- **[Option A — CloudShell](#option-a--cloudshell-no-local-setup-required)** ← recommended for customer environments
- **[Option B — Local machine](#option-b--local-machine)**

---

## Prerequisites (both options)

Before deploying, enable these Bedrock models in **us-east-1** ([open console](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess)):
- `Amazon Nova Lite`
- `Amazon Nova 2 Sonic`

You also need an **Anam AI API key** from [app.anam.ai](https://app.anam.ai) → Account Settings → API Keys.

---

## Option A — CloudShell (no local setup required)

AWS CloudShell runs inside the customer's AWS account with credentials already active. No AWS CLI configuration, no Docker install, no local dependencies.

The only limitation: CloudShell has no Docker daemon, so the AgentCore image must be built once from a machine that has Docker (or by a CI pipeline) and pushed to the customer's ECR. After that first image push, all future deployments — including the customer's first full deploy — run entirely from CloudShell.

### Step 1 — Push the AgentCore image (done once, from any machine with Docker)

```bash
# From the project root on a machine with Docker:
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text --profile <profile>)
REGION=us-east-1

# Create an ECR repo in the customer account (skip if it already exists)
aws ecr create-repository \
  --repository-name real-estate-agentcore \
  --region $REGION --profile <profile>

# Build, tag, and push
aws ecr get-login-password --region $REGION --profile <profile> | \
  docker login --username AWS \
  --password-stdin $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com

docker build --platform linux/arm64 \
  -t $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/real-estate-agentcore:latest \
  backend/agentcore

docker push $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/real-estate-agentcore:latest
```

Note the full image URI — you'll paste it in Step 3.

---

### Step 2 — Open CloudShell in the customer account

In the AWS Console, click the **CloudShell** icon (top navigation bar). Wait for the terminal to load — it opens pre-authenticated with the current account's IAM role.

---

### Step 3 — Run the deploy script

Paste this entire block into CloudShell (replace the two values at the top):

```bash
# ── Configure these two values ──────────────────────────────
ANAM_API_KEY="<your-anam-api-key>"
AGENTCORE_IMAGE_URI="<account>.dkr.ecr.us-east-1.amazonaws.com/real-estate-agentcore:latest"
# ────────────────────────────────────────────────────────────

# Install Node.js 20 (CloudShell ships with an older version)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install CDK
npm install -g aws-cdk

# Clone the repo
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program/backend

# Install dependencies
npm install

# Bootstrap CDK (safe to run even if already bootstrapped)
cdk bootstrap

# Deploy all stacks — no Docker needed, uses the pre-built image
ANAM_API_KEY=$ANAM_API_KEY \
cdk deploy --all \
  -c branchName=main \
  -c agentCoreImageUri=$AGENTCORE_IMAGE_URI \
  --require-approval never

echo "✅ Backend deployed"
```

Type `y` if prompted for IAM confirmation (the `--require-approval never` flag skips this, but first-time deploys may still ask). Total time: ~10–15 minutes.

---

### Step 4 — Deploy the frontend from CloudShell

```bash
# Still inside Real-Estate-Program/
cd ../frontend
npm install
npm run build

# Get the Amplify app ID that CDK just created
AMPLIFY_APP_ID=$(aws amplify list-apps \
  --query "apps[?contains(name,'real-estate-program-main')].appId" \
  --output text)

# Package (index.html must be at zip root)
cd out && zip -r ../../deploy.zip . && cd ../..

# Create deployment, upload, and start
aws amplify create-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  > /tmp/deploy.json

curl -s --request PUT --upload-file deploy.zip \
  "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['zipUploadUrl'])")"

aws amplify start-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['jobId'])")"

echo "✅ Frontend deployed"
```

---

### Step 5 — Seed personas

Open the live app URL (printed in CDK outputs as `FrontendConfigStack-main.AmplifyAppUrl`), sign in as admin, and add the four personas with these Anam persona IDs:

| Persona | Anam Persona ID |
|---------|----------------|
| Commercial Lender | `26981553-4601-4799-b64b-7dfa1580de8c` |
| Public Official | `855745e8-056d-4848-a5a0-3752e88cdecc` |
| Real Estate Agent | `36908df0-128e-48c6-b2f3-cbf007707d00` |
| Negotiation Counterparty | `19e62cdb-8c39-4b58-a96b-a8a4cc5899e0` |

---

## Option B — Local Machine

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) |
| AWS CDK | v2 | `npm install -g aws-cdk` |
| AWS CLI | v2 | [docs](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| Docker | any | [docker.com](https://www.docker.com/) |

### Deploy

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program/backend
npm install

# Bootstrap (first time only)
cdk bootstrap --profile <your-profile>

# Deploy everything — Docker builds the AgentCore image automatically
ANAM_API_KEY=<your-anam-api-key> \
cdk deploy --all -c branchName=main --profile <your-profile>
```

Then follow Steps 4 and 5 from Option A (frontend deploy and persona seeding), adding `--profile <your-profile>` to the AWS CLI commands.

---

## Re-deploy Frontend Changes Only

No CDK needed — just rebuild and re-upload:

```bash
cd frontend
npm run build
cd out && zip -r ../../deploy.zip . && cd ../..

AMPLIFY_APP_ID=<your-amplify-app-id>

aws amplify create-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main > /tmp/deploy.json

curl -s --request PUT --upload-file deploy.zip \
  "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['zipUploadUrl'])")"

aws amplify start-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['jobId'])")"
```

---

## Optional: Auto-deploy via GitHub

Connect Amplify to GitHub so every push to `main` triggers a build automatically:

```bash
ANAM_API_KEY=<key> \
cdk deploy --all -c branchName=main \
  -c githubOwner=ASUCICREPO \
  -c githubRepo=Real-Estate-Program \
  -c githubToken=<github-personal-access-token> \
  --profile <your-profile>
```

---

## Teardown

```bash
cd backend
cdk destroy --all -c branchName=main --profile <your-profile>
```

> **Warning**: Destroys all S3 data, DynamoDB personas, and Cognito user accounts permanently.

---

## Troubleshooting

**CDK bootstrap error** — run `cdk bootstrap --profile <profile>` once per account/region.

**Docker not available (CloudShell)** — use Option A and pass `-c agentCoreImageUri=<uri>`. The pre-built image must be in an ECR repo in the same account and region.

**Anam 401 error** — `ANAM_API_KEY` is wrong or empty. Update it:
```bash
aws lambda update-function-configuration \
  --function-name $(aws lambda list-functions \
    --query 'Functions[?contains(FunctionName,`Anam`)].FunctionName' --output text) \
  --environment '{"Variables":{"ANAM_API_KEY":"<key>","ALLOWED_ORIGINS":"http://localhost:3000,https://main.<app-id>.amplifyapp.com"}}'
```

**Amplify 404** — zip was built from the wrong folder. Always `cd frontend/out && zip -r ../../deploy.zip .`

**Bedrock access denied** — enable Nova Lite and Nova 2 Sonic in [Bedrock Model Access](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess).

**CloudShell storage limit** — CloudShell has 1 GB. If `npm install` fails, clear the cache first: `npm cache clean --force`.
