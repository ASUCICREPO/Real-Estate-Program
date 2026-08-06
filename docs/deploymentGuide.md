# Deployment Guide — W. P. Carey Real Estate Program

Three ways to deploy. All of them end with a fully deployed backend, frontend, and live Q&A agent.

---

## Option 1 — GitHub CI/CD (recommended for ongoing development)

Every push to `main` triggers an Amplify build automatically.

1. Open **AWS CloudShell** in the target account (click the CloudShell icon in the AWS Console top bar).
2. Clone the repo and run the deploy script:

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program
bash deploy.sh
```

3. Follow the prompts — you'll be asked for:
   - GitHub repository (auto-detected from the clone URL)
   - Branch name (auto-detected)
   - **Anam AI API key** (required — get one at [app.anam.ai](https://app.anam.ai) → Account Settings → API Keys)
   - GitHub Personal Access Token (enables Amplify CI/CD and private repo access)

The script creates a CodeBuild project and starts the deployment. A link to the build logs is printed at the end. Total time: ~15–20 minutes.

---

## Option 2 — Bare mode (no GitHub token)

Same as Option 1 but press Enter when prompted for the GitHub token. CodeBuild builds and deploys the frontend itself instead of wiring up Amplify CI/CD.

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program
bash deploy.sh
```

Skip the GitHub token prompt. Everything else is the same.

---

## Option 3 — Manual CDK (local machine)

Requires Node.js 18+, AWS CDK v2, AWS CLI v2, and Docker.

```bash
git clone https://github.com/ASUCICREPO/Real-Estate-Program.git
cd Real-Estate-Program/backend
npm install

# Bootstrap once per account/region
cdk bootstrap --profile <your-profile>

# Deploy all stacks
cdk deploy --all -c branchName=main --profile <your-profile>
```

After CDK finishes, inject the Anam API key into the session token Lambda:

```bash
ANAM_LAMBDA=$(aws lambda list-functions \
  --query "Functions[?contains(FunctionName,'AnamSessionToken')].FunctionName" \
  --output text --profile <your-profile>)

aws lambda update-function-configuration \
  --function-name "$ANAM_LAMBDA" \
  --environment "Variables={ANAM_API_KEY=<your-key>}" \
  --profile <your-profile>
```

Then build and deploy the frontend manually:

```bash
cd ../frontend
npm ci && npm run build

AMPLIFY_APP_ID=$(aws amplify list-apps \
  --query "apps[?contains(name,'real-estate-program-main')].appId" \
  --output text --profile <your-profile>)

cd out && zip -r ../../deploy.zip . && cd ../..

aws amplify create-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --profile <your-profile> > /tmp/deploy.json

curl -s -X PUT -T deploy.zip \
  "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['zipUploadUrl'])")"

aws amplify start-deployment \
  --app-id $AMPLIFY_APP_ID --branch-name main \
  --job-id "$(python3 -c "import json; print(json.load(open('/tmp/deploy.json'))['jobId'])")" \
  --profile <your-profile>
```

---

## Prerequisites

Before deploying, enable these Bedrock models in **us-east-1** ([open console](https://us-east-1.console.aws.amazon.com/bedrock/home#/modelaccess)):
- `Amazon Nova Lite`
- `Amazon Nova 2 Sonic`

---

## Seed Personas (first deploy only)

The DynamoDB PersonasTable is empty after first deploy. There is no in-app admin UI — add personas directly via the AWS Console or CLI.

**AWS Console:** DynamoDB → Tables → `PersonasTable` → Explore items → Create item (JSON view).

**AWS CLI example:**
```bash
PERSONAS_TABLE=$(aws cloudformation describe-stacks \
  --stack-name RealEstateProgramStack-main \
  --query "Stacks[0].Outputs[?OutputKey=='PersonasTableName'].OutputValue" \
  --output text)

aws dynamodb put-item --table-name "$PERSONAS_TABLE" --item '{
  "personaID":          {"S": "19e62cdb-8c39-4b58-a96b-a8a4cc5899e0"},
  "name":               {"S": "Negotiation Counterparty"},
  "description":        {"S": "..."},
  "personaPrompt":      {"S": "You are negotiating the terms of a real estate deal..."},
  "expertise":          {"S": "intermediate"},
  "keyPriorities":      {"L": [{"S": "deal terms"}, {"S": "leverage"}]},
  "presentationTime":   {"S": "15 minutes"},
  "communicationStyle": {"S": "competitive"},
  "timeLimitSec":       {"N": "900"},
  "qaTimeLimitSec":     {"N": "300"},
  "voiceId":            {"S": "matthew"},
  "anamPersonaId":      {"S": "19e62cdb-8c39-4b58-a96b-a8a4cc5899e0"},
  "icon":               {"S": "people"}
}'
```

Anam persona IDs for the four pre-configured stakeholders:

| Persona | Anam Persona ID |
|---------|----------------|
| Commercial Lender | `26981553-4601-4799-b64b-7dfa1580de8c` |
| Public Official | `855745e8-056d-4848-a5a0-3752e88cdecc` |
| Real Estate Agent | `36908df0-128e-48c6-b2f3-cbf007707d00` |
| Negotiation Counterparty | `19e62cdb-8c39-4b58-a96b-a8a4cc5899e0` |

See the [Modification Guide](./modificationGuide.md#add-or-modify-a-persona) for the full field schema.

---

## Teardown

```bash
cd backend
cdk destroy --all -c branchName=main --profile <your-profile>
```

> **Warning**: Destroys all S3 data, DynamoDB personas, and Cognito user accounts permanently.
