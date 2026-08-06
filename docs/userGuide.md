# User Guide — W. P. Carey Real Estate Program AI Presentation Coach

**Live App:** [https://main.d2v1f9m26bi3az.amplifyapp.com](https://main.d2v1f9m26bi3az.amplifyapp.com)

---

## What This Tool Does

The AI Presentation Coach helps W. P. Carey students practice real estate development presentations by simulating four different stakeholder audiences. You record yourself presenting, see real-time delivery metrics, get AI-written feedback afterward, and can run a live voice Q&A with an AI persona that asks tough stakeholder questions.

---

## Getting Started

### Step 1 — Sign In

Navigate to the app and sign in with your university email. First-time users can self-register with a university email address — you'll receive a verification code by email.

### Step 2 — Select a Persona

After signing in you'll see the persona selection screen. Choose the stakeholder you want to practice with:

| Persona | Focus |
|---------|-------|
| **Commercial Lender** | Financials, debt service coverage, risk, loan structure |
| **Public Official** | Zoning, community impact, permitting, regulatory compliance |
| **Real Estate Agent** | Market comparables, listing strategy, buyer/seller dynamics |
| **Negotiation Counterparty** | Deal terms, leverage, concessions, counter-offers |

Each persona has a different communication style, different time limits, and different delivery benchmarks — your metrics targets adjust accordingly.

### Step 3 — Configure the Session

Before starting you can:

- **Upload a PDF presentation** — your slides will appear side-by-side with your camera feed during recording
- **Add custom notes** (up to 500 words) — give the persona specific context about your deal, property, or scenario
- **Toggle real-time feedback** — choose whether to see live metrics during the session or practice without them

### Step 4 — Camera & Mic Calibration

Click **Turn On Camera & Calibrate**. A calibration panel appears showing:
- Your live camera feed with a face mesh overlay
- Eye contact status (center your face and look at the camera)
- A mic check to confirm your audio level is sufficient

Click **Continue to Mic Calibration** then **Everything Looks Good** when both are ready.

### Step 5 — Practice Session

The main recording view has three sections:

**Top — Delivery Metrics Bar**
Six live metrics update every second while you record:

| Metric | What It Measures | Typical Target |
|--------|-----------------|----------------|
| Speaking Pace | Words per minute (30s rolling window) | 130–160 wpm |
| Volume | Microphone input level | Consistent, avoid sudden drops |
| Eye Contact | Whether you're looking at the camera | ≥ 65% of the time |
| Filler Words | "um", "uh", "like", "basically", etc. | ≤ 3 per 30 seconds |
| Pauses | Deliberate silences > 3 seconds | ≥ 4 per 30 seconds |
| Monotone Level | Pitch and volume variation | Lower is better |

**Middle — Camera + Slides (side-by-side)**
- Left: your live camera feed with recording badge
- Right: your uploaded PDF (or a placeholder if none was uploaded)

**Bottom — Live Transcription**
Words appear as you speak, with partial results showing in real time.

Use **Pause** to take a break mid-session (metrics stop collecting). Click **Finish Recording** when done.

### Step 6 — Review Your Analytics

After finishing, the app processes your session (takes 15–30 seconds). You'll see:

- **Delivery Summary** — overall scores for pace, eye contact, filler words, and pauses with trend charts
- **Written AI Feedback** — role-specific commentary from the persona's perspective: what you did well, what to improve, how your delivery would land with that stakeholder
- **Transcript** — full text of your presentation with filler words highlighted
- **Per-second metric charts** — timeline graphs of each metric across the session

### Step 7 — Live Voice Q&A (Optional)

After reviewing analytics, click **Start Q&A Session** to practice answering live questions from the persona.

The persona avatar will:
1. Introduce itself and begin asking questions based on your presentation
2. React to your answers and ask follow-ups
3. Wrap up after the allotted Q&A time (typically 5 minutes)

After the Q&A ends, you receive a second round of AI feedback specifically about your Q&A responses — clarity, depth, handling of tough questions, composure.

---

## Tips for Best Results

- **Look directly at your webcam**, not at your screen — the gaze tracker reads your eye position relative to the camera lens
- **Speak at a natural pace** — the 130–160 wpm target is conversational; don't rush or artificially slow down
- **Use deliberate pauses** after key points — the pause counter rewards strategic silence, not just talking faster
- **Upload your actual slides** — the side-by-side view helps you practice natural transitions between slides while maintaining eye contact
- **Use the custom notes field** to give the persona specific deal details — the more context you provide, the more targeted the Q&A questions will be
- **Practice the same persona multiple times** — each session is independent, so you can track your improvement over multiple attempts

---

## For Faculty / Admins

Personas are pre-configured at deployment time and stored in DynamoDB. To add or modify a persona, update the record directly in the DynamoDB table via the AWS Console (DynamoDB → Tables → select the PersonasTable → Explore items) or using the AWS CLI with `aws dynamodb put-item`.

Each persona record supports: name, description, coaching prompt, time limits, best-practice thresholds, Anam avatar persona ID, and voice ID. See the [Modification Guide](./docs/modificationGuide.md#add-or-modify-a-persona) for the full field reference.

---

## Frequently Asked Questions

**Q: My camera is black after clicking "Turn On Camera".**
Make sure the browser has camera permission for this site (look for the camera icon in the address bar). HTTPS is required — this works on the Amplify URL but not over plain HTTP.

**Q: The transcript isn't capturing my words accurately.**
Amazon Transcribe works best in a quiet environment with a close-proximity microphone. Reduce background noise and speak clearly toward your device's mic.

**Q: The filler word count seems off.**
Filler detection relies on Amazon Transcribe — it uses a 30-second rolling window so the count resets every 30 seconds rather than accumulating for the whole session.

**Q: The Q&A avatar isn't showing / Anam fails.**
The Anam AI API key may be missing or expired. Contact your administrator to verify the `ANAM_API_KEY` is set on the backend Lambda.

**Q: Can I re-do a session?**
Yes — each session gets a unique ID. Previous sessions aren't overwritten; they expire from S3 after 14 days.

**Q: Where is my data stored?**
All session data (video, transcripts, analytics) is stored in an S3 bucket in your institution's AWS account. Nothing is shared externally. Data expires after 14 days.
