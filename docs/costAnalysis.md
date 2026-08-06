# AWS Cost Analysis Report
## W. P. Carey Real Estate Program — AI Presentation Coach
**Region:** us-east-1 (N. Virginia)  
**Pricing Model:** On-Demand (pay-per-use, no reserved capacity)  
**Report Date:** August 2026  

> **Disclaimer:** All figures are estimates based on publicly available AWS list prices. Actual costs depend on usage patterns, data transfer volumes, and applicable free-tier credits. Prices are subject to change.

---

## Usage Assumptions

This report models **two scenarios** representing typical academic use cases:

| Parameter | Pilot (Small Class) | Full Program (Large Class) |
|-----------|-------------------|--------------------------|
| Students | 30 | 150 |
| Sessions per student per month | 4 | 4 |
| Total practice sessions / month | 120 | 600 |
| Avg. recording duration | 10 min | 10 min |
| Avg. Q&A sessions per student/month | 2 | 2 |
| Avg. Q&A duration | 5 min | 5 min |
| PDF uploads per student/month | 2 | 2 |
| Instructors / admins | 3 | 10 |

---

## Service-by-Service Cost Breakdown

---

### 1. Amazon Cognito — Authentication

**Pricing:** Essentials tier — $0.015 per MAU (monthly active user) after first 10,000 free MAU ([source](https://aws.amazon.com/cognito/pricing/))

| | Pilot | Full Program |
|--|-------|-------------|
| Monthly Active Users | 33 | 160 |
| Free tier covered | ✅ (< 10,000 MAU) | ✅ (< 10,000 MAU) |
| **Monthly Cost** | **$0.00** | **$0.00** |

> Free for both scenarios — the free tier covers 10,000 MAU/month indefinitely.

---

### 2. Amazon API Gateway — REST API

**Pricing:** $3.50 per million API calls (first 333M/month) ([source](https://aws.amazon.com/api-gateway/pricing/))

Each practice session triggers approximately 8–12 API calls (pre-signed URL requests, analytics polling, session manifest, persona fetch, etc.). Each Q&A session adds ~3 calls.

| | Pilot | Full Program |
|--|-------|-------------|
| API calls (practice sessions) | 120 sessions × 10 calls = 1,200 | 600 × 10 = 6,000 |
| API calls (Q&A sessions) | 60 × 3 = 180 | 300 × 3 = 900 |
| API calls (persona/admin) | ~100 | ~300 |
| Total calls/month | ~1,480 | ~7,200 |
| Cost at $3.50/million | $0.005 | $0.03 |
| **Monthly Cost** | **~$0.01** | **~$0.03** |

---

### 3. AWS Lambda — Backend Functions

**Pricing:** $0.20 per million requests + $0.0000166667 per GB-second ([source](https://aws.amazon.com/lambda/pricing/))  
**Free tier:** 1M requests + 400,000 GB-seconds/month

Five Lambda functions: `S3UrlLambda`, `PersonaCrudLambda`, `PostMeetingAnalyticsLambda`, `ContentAnalysisLambda`, `AnamSessionTokenLambda`

| | Pilot | Full Program |
|--|-------|-------------|
| Total Lambda invocations/month | ~1,500 | ~7,500 |
| Avg. duration × memory | 2s × 0.5 GB = 1 GB-second avg | same |
| Total GB-seconds | ~1,500 | ~7,500 |
| Requests cost (< 1M free) | $0.00 | $0.00 |
| Compute cost (< 400K GB-s free) | $0.00 | $0.00 |
| **Monthly Cost** | **$0.00** | **$0.00** |

> Both scenarios stay well within Lambda's permanent free tier.

---

### 4. Amazon S3 — Session Storage

**Pricing:** $0.023/GB/month storage + $0.005/1,000 PUT requests + $0.0004/1,000 GET requests ([source](https://www.cloudzero.com/blog/s3-pricing/))

Sessions expire after 14 days (lifecycle rule), so storage accumulates for ~2 weeks before rolling off.

**Per session stored:**
- Video recording (WebM, 10 min @ ~500 kbps): ~37 MB
- Transcript + analytics JSON: ~0.05 MB
- PDF slides (if uploaded): ~2 MB (avg)
- Detailed metrics, manifest: ~0.1 MB
- **Total per session: ~39 MB**

| | Pilot | Full Program |
|--|-------|-------------|
| Active sessions (14-day window, 2× monthly) | ~56 sessions | ~280 sessions |
| Storage in use at peak | 56 × 39 MB = ~2.2 GB | 280 × 39 MB = ~10.9 GB |
| Storage cost/month | 2.2 × $0.023 = $0.05 | 10.9 × $0.023 = $0.25 |
| PUT requests (uploads/month) | ~600 (video parts + JSON) | ~3,000 |
| GET requests (analytics reads) | ~250 | ~1,200 |
| Request costs | ~$0.003 | ~$0.015 |
| **Monthly Cost** | **~$0.05** | **~$0.27** |

---

### 5. Amazon DynamoDB — Personas Table

**Pricing:** $1.25 per million write request units, $0.25 per million read request units (on-demand) ([source](https://aws.amazon.com/dynamodb/pricing/on-demand/))

Persona data is mostly read (persona selection screen loads). Writes only happen when personas are updated.

| | Pilot | Full Program |
|--|-------|-------------|
| Read request units/month | ~1,000 (persona list/detail reads) | ~5,000 |
| Write request units/month | ~10 (occasional persona updates) | ~10 |
| **Monthly Cost** | **< $0.01** | **< $0.01** |

> Effectively free at this scale.

---

### 6. Amazon Transcribe Streaming — Live Transcription

**Pricing:** $0.024 per minute for the first 250,000 minutes/month ([source](https://brasstranscripts.com/blog/amazon-transcribe-pricing-2026-cost-calculator-guide))

Every practice session streams audio to Transcribe for real-time transcription.

| | Pilot | Full Program |
|--|-------|-------------|
| Transcribe minutes/month | 120 sessions × 10 min = 1,200 min | 600 × 10 = 6,000 min |
| Cost at $0.024/min | 1,200 × $0.024 = $28.80 | 6,000 × $0.024 = $144.00 |
| **Monthly Cost** | **$28.80** | **$144.00** |

> ⚠️ **This is the highest-cost service.** Transcribe streaming is billed per minute of audio, regardless of how many words are spoken.

---

### 7. Amazon Bedrock — Post-Session Analytics (Claude Haiku 4.5)

**Pricing:** $1.00/million input tokens, $5.00/million output tokens ([source](https://www.anthropic.com/news/claude-haiku-4-5))  
**Model:** `global.anthropic.claude-haiku-4-5-20251001-v1:0` (cross-region inference)

Each analytics call processes: presentation transcript (~800 tokens) + session metrics + persona prompt + system prompt ≈ ~2,500 input tokens, ~800 output tokens.

| | Pilot | Full Program |
|--|-------|-------------|
| Calls/month | 120 | 600 |
| Input tokens | 120 × 2,500 = 300,000 | 600 × 2,500 = 1,500,000 |
| Output tokens | 120 × 800 = 96,000 | 600 × 800 = 480,000 |
| Input cost | 0.3M × $1.00/M = $0.30 | 1.5M × $1.00/M = $1.50 |
| Output cost | 0.096M × $5.00/M = $0.48 | 0.48M × $5.00/M = $2.40 |
| **Monthly Cost** | **$0.78** | **$3.90** |

---

### 8. Amazon Bedrock — Content Analysis (Claude 3.5 Haiku)

**Pricing:** ~$0.80/million input tokens, ~$4.00/million output tokens (Claude 3.5 Haiku on Bedrock, regional inference)

Content analysis runs when a PDF is uploaded. Processes the PDF text + persona context → generates summary and questions. Approx. ~3,000 input tokens, ~500 output tokens per call.

| | Pilot | Full Program |
|--|-------|-------------|
| Calls/month | 60 (2 uploads × 30 students) | 300 (2 × 150 students) |
| Input tokens | 60 × 3,000 = 180,000 | 300 × 3,000 = 900,000 |
| Output tokens | 60 × 500 = 30,000 | 300 × 500 = 150,000 |
| Input cost | 0.18M × $0.80/M = $0.14 | 0.9M × $0.80/M = $0.72 |
| Output cost | 0.03M × $4.00/M = $0.12 | 0.15M × $4.00/M = $0.60 |
| **Monthly Cost** | **$0.26** | **$1.32** |

---

### 9. Amazon Bedrock — Voice Q&A (Nova 2 Sonic)

**Pricing:** $3.00/million speech input tokens, $12.00/million speech output tokens  
*(Approx. ~150 tokens/second of audio for both input and output)*  
([source](https://rywalker.com/research/aws-nova-2-sonic))

Each Q&A session = 5 minutes = 300 seconds of bidirectional audio.

| | Pilot | Full Program |
|--|-------|-------------|
| Q&A sessions/month | 60 (2 per student × 30) | 300 (2 × 150) |
| Audio seconds (input) | 60 × 300s = 18,000s | 300 × 300s = 90,000s |
| Audio tokens (input, ~150 tok/s) | ~2.7M tokens | ~13.5M tokens |
| Audio tokens (output, ~75 tok/s) | ~1.35M tokens | ~6.75M tokens |
| Input cost | 2.7M × $3.00/M = $8.10 | 13.5M × $3.00/M = $40.50 |
| Output cost | 1.35M × $12.00/M = $16.20 | 6.75M × $12.00/M = $81.00 |
| **Monthly Cost** | **$24.30** | **$121.50** |

---

### 10. Amazon Bedrock AgentCore — Voice Agent Runtime

**Pricing:** Consumption-based — charged per CPU-second and GB-memory-second of active container execution during Q&A sessions. Billing at per-second granularity; no charge during I/O wait time.  
([source](https://aws.amazon.com/bedrock/agentcore/pricing/))

The AgentCore Runtime spins up a microVM per session. Exact per-vCPU-second rates are not publicly listed in a simple table, but are comparable to AWS Fargate spot pricing (~$0.01/vCPU-hour, $0.001/GB-hour). Estimated at ~$0.003 per session-minute for a lightweight agent container.

| | Pilot | Full Program |
|--|-------|-------------|
| Q&A session-minutes/month | 60 × 5 min = 300 min | 300 × 5 = 1,500 min |
| Estimated cost at ~$0.003/min | $0.90 | $4.50 |
| **Monthly Cost (est.)** | **~$1.00** | **~$5.00** |

> ⚠️ AgentCore Runtime pricing is consumption-based and varies with actual CPU activity. This is an estimate; consult the [AgentCore pricing page](https://aws.amazon.com/bedrock/agentcore/pricing/) for confirmed rates.

---

### 11. AWS Amplify Hosting — Frontend

**Pricing:** Amplify manual zip deployments — $0.01 per build minute + $0.023/GB/month for hosting  
([source](https://aws.amazon.com/amplify/pricing/))

Static export (Next.js `output: 'export'`), ~5 MB zip. Build time for a zip deploy is typically < 30 seconds.

| | Pilot | Full Program |
|--|-------|-------------|
| Hosted build size | ~5 MB | ~5 MB |
| Deployments/month | ~2 | ~2 |
| Storage cost | 0.005 GB × $0.023 = $0.0001 | same |
| Build cost | negligible | negligible |
| **Monthly Cost** | **~$0.00** | **~$0.00** |

---

### 12. Amazon CloudWatch — Logs & Monitoring

**Pricing:** $0.50/GB ingested, $0.03/GB stored/month  
Lambda functions and API Gateway push logs automatically.

| | Pilot | Full Program |
|--|-------|-------------|
| Estimated log volume/month | ~0.1 GB | ~0.5 GB |
| Ingestion cost | $0.05 | $0.25 |
| Storage (30-day retention) | ~$0.003 | ~$0.015 |
| **Monthly Cost** | **~$0.05** | **~$0.27** |

---

## Monthly Cost Summary

| Service | Pilot (30 students) | Full Program (150 students) |
|---------|--------------------|-----------------------------|
| Amazon Cognito | $0.00 | $0.00 |
| API Gateway (REST) | $0.01 | $0.03 |
| AWS Lambda | $0.00 | $0.00 |
| Amazon S3 | $0.05 | $0.27 |
| Amazon DynamoDB | < $0.01 | < $0.01 |
| Amazon Transcribe Streaming | **$28.80** | **$144.00** |
| Bedrock — Claude Haiku 4.5 (analytics) | $0.78 | $3.90 |
| Bedrock — Claude 3.5 Haiku (content) | $0.26 | $1.32 |
| Bedrock — Nova 2 Sonic (Q&A voice) | **$24.30** | **$121.50** |
| Bedrock AgentCore Runtime | ~$1.00 | ~$5.00 |
| Amplify Hosting | ~$0.00 | ~$0.00 |
| CloudWatch | $0.05 | $0.27 |
| **TOTAL (est.)** | **~$55.25/month** | **~$276.29/month** |

---

## Cost Per Student

| Scenario | Total/Month | Students | Cost/Student/Month |
|----------|------------|----------|-------------------|
| Pilot | ~$55 | 30 | **~$1.84** |
| Full Program | ~$276 | 150 | **~$1.84** |

The per-student cost is essentially linear — the architecture scales without fixed overhead.

---

## Cost Driver Analysis

```
Pilot ($55/month)
─────────────────────────────────────────────
Amazon Transcribe Streaming     $28.80  52.1%  ████████████████████████████
Nova 2 Sonic (voice Q&A)        $24.30  44.0%  ██████████████████████████
Bedrock Analytics (Claude)      $1.04    1.9%  █
AgentCore Runtime               $1.00    1.8%  █
S3 + CloudWatch                 $0.10    0.2%  
─────────────────────────────────────────────
```

**Two services account for 96% of all costs:**
1. **Amazon Transcribe Streaming** (~52%) — billed per minute of audio, runs for the full duration of every practice session
2. **Nova 2 Sonic via Bedrock** (~44%) — speech-to-speech token pricing for live Q&A sessions

---

## Cost Optimization Opportunities

### High Impact

**1. Limit Q&A session length**  
Nova 2 Sonic is the second-largest cost driver. Reducing the default Q&A time limit from 5 minutes to 3 minutes reduces voice Q&A costs by ~40%.  
*Savings: ~$10/month (pilot) / ~$49/month (full)*

**2. Make Q&A sessions opt-in**  
Not every student needs a Q&A session after every practice run. If only 50% of sessions include Q&A, voice costs halve.  
*Savings: ~$12/month (pilot) / ~$61/month (full)*

**3. Transcribe: Use batch mode for playback transcription**  
Transcribe Streaming is used for real-time feedback during recording. If real-time transcription is not essential (only used for post-session review), batch transcription costs $0.0004/second instead of $0.024/minute — an ~83% reduction.  
*Savings: ~$24/month (pilot) / ~$120/month (full)*  
⚠️ Trade-off: live filler-word detection would no longer work in real time.

**4. Session recording: Compress video**  
WebM recordings at 640×480 average ~37 MB per 10-minute session. Lowering bitrate to 250 kbps (still watchable quality) reduces to ~19 MB — cutting S3 storage and transfer costs roughly in half. Change `CHUNK_INTERVAL_MS` and bitrate settings in `config.ts`.

### Medium Impact

**5. Move analytics Lambda to Claude 3.5 Haiku from Haiku 4.5**  
The post-meeting analytics Lambda currently uses `claude-haiku-4-5` ($1.00/$5.00 per M tokens). Downgrading to `claude-3-5-haiku` (~$0.80/$4.00) saves ~20% on analytics costs. Quality difference for structured output (tool use) is minimal.

**6. Implement response caching for persona reads**  
DynamoDB costs are already negligible, but API Gateway caching ($0.02/hour for a small cache) can reduce Lambda invocations for the frequently-read `/personas` endpoint.

### Low Impact / Future Considerations

**7. Transcribe: Reserved capacity**  
If usage grows beyond 250,000 minutes/month, Transcribe pricing drops to $0.015/min (tier 2) automatically.

**8. S3 lifecycle tuning**  
The current 14-day expiration is appropriate for the POC. Production deployments might extend to 30–90 days for academic record keeping — budget accordingly (~$0.23/GB/month per 30 days for 600 sessions).

---

## Academic Semester Estimate

Assuming a 16-week semester with a 4-week break:

| Scenario | Monthly Cost | Active Months | Semester Total |
|----------|-------------|---------------|----------------|
| Pilot (30 students) | ~$55 | 4 (active) | **~$220/semester** |
| Full Program (150 students) | ~$276 | 4 (active) | **~$1,104/semester** |

With break periods (no active usage), annual cost is approximately:

| Scenario | Annual Estimate |
|----------|----------------|
| Pilot | **~$440/year** (2 semesters) |
| Full Program | **~$2,208/year** (2 semesters) |

---

## Excluded from This Analysis

The following costs are not included in this report:

| Item | Reason |
|------|--------|
| **Anam AI avatar service** | Third-party; pricing dependent on Anam account plan |
| **Data transfer costs** | Video uploads use pre-signed S3 URLs (client → S3 direct, no API Gateway data transfer) |
| **AWS Free Tier credits** | New accounts receive 12-month free tier that covers Lambda, DynamoDB, and Cognito at this scale |
| **Developer / operational labor** | Human cost of maintaining the platform |
| **CDK bootstrap S3 bucket** | Negligible (<$0.01/month for the CDK toolkit bucket) |
| **Bedrock Guardrails** | Currently no additional charge for Bedrock Guardrails applied within Bedrock model invocations |
| **ECR storage** | AgentCore container image (~1–2 GB in ECR) — ~$0.10/month |

---

## Key Takeaways

1. **The platform is extremely cost-effective** — approximately **$1.84 per student per month** at both small and large scale.

2. **Amazon Transcribe is the dominant cost** at ~52% of total spend. Any cost reduction strategy should target this first.

3. **Nova 2 Sonic (live Q&A)** is the second-largest cost. Making Q&A opt-in or reducing session length has immediate impact.

4. **The infrastructure baseline (Cognito, Lambda, DynamoDB, API Gateway)** costs near zero at this scale — all within free tiers.

5. **An academic program running 2 semesters/year** with 150 students can expect approximately **~$2,200/year in AWS costs** — less than $15 per student per year.

---

## References

- [AWS Lambda Pricing](https://aws.amazon.com/lambda/pricing/)
- [Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [Amazon Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)
- [Amazon Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Amazon Nova Pricing](https://aws.amazon.com/nova/pricing/)
- [Amazon Bedrock AgentCore Pricing](https://aws.amazon.com/bedrock/agentcore/pricing/)
- [Amazon API Gateway Pricing](https://aws.amazon.com/api-gateway/pricing/)
- [Amazon Cognito Pricing](https://aws.amazon.com/cognito/pricing/)
- [Amazon DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [AWS Amplify Pricing](https://aws.amazon.com/amplify/pricing/)
- [Claude Haiku 4.5 Pricing — Anthropic](https://www.anthropic.com/news/claude-haiku-4-5)
