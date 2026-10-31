# Meta Global AI Developer Hackathon

Trade Receipts is built for this hackathon. Summarized from the event page, the Official Rules, the Participant Guide and the kickoff livestream (Oct 26, 2026). How the product maps to the rubric is in `SPEC.md` section 2, "How this scores".

## Our entry

- **Track:** Indie Developer (individual builders and students, teams of up to 4). We're solo.
- **Theme:** "Build for Your World": bring Meta's models into a domain you know firsthand and make something possible that wasn't before.
- **Indie track judging focus:** creativity, technical ambition, and whether it works.

## Key dates (Eastern Time)

| Date | What |
|---|---|
| Oct 27 – Nov 4 | Building period |
| Weekdays, 10–11 AM | Office hours with the Meta team in Discord #office-hours (text only) |
| Tue Nov 3 | Last full day for submission questions and troubleshooting |
| **Wed Nov 4, 9:00 PM** | **Submissions due** on the Cerebral Valley portal: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit. Late submissions aren't considered |
| Thu Nov 5 – Sun Nov 8 | Judging |
| Mon Nov 9, 12:00 PM | Closing ceremony: top 5 per track announced, live final round, winners revealed, community vote opens |
| ~Nov 10 | Bonus prizes announced |
| Mon Nov 16 | Community vote winner announced on Discord |

## Rules

- **Public repo.** The repository must be public.
- **New work only.** Everything presented must have been built during the event, and the submission must make that clear.
- **The demo shows only what was built during the hackathon.** Judges must be able to tell clearly what was created during the event. Failing to identify original contributions means disqualification.
- **Meta's models are required.** Options:
  - Through the Meta Model API: Muse Spark, Muse Wonder, Muse Image, Muse Voice Transcribe, SAM 3.1.
  - Open weights: Muse Glimmer, Muse Spark Open.
  - Muse Code, as a coding agent.
- **Disqualified:** projects that break legal, ethical or platform policies, or that use code, data or assets without the rights to them.

## Banned project types ("anti-projects")

Not exhaustive. These are generic or break platform policy:
- AI that gives medical advice (mental health advisors, skin blemish detectors and the like).
- Basic RAG apps.
- Simple image analyzers.
- Simple "AI for education" chatbots.
- AI job application screeners.
- AI nutrition coaches.
- Personality analyzers.
- Sports analyzers or coaches.
- Anything political or involving war.

The kickoff livestream slides add two more: **Streamlit apps** and **dashboards as the main feature**.

## Submission

- Submit one project on the Cerebral Valley portal, with everyone who worked on it listed.
- A **3-minute demo video** is required. It shows the features, code and functionality built during the hackathon.
- The video, the code and the **live product** are the main things judges use.
- Before submitting, check that the repo is public and the video link opens.

## Judging

1. **Stage one, pass/fail:** does the project reasonably fit the theme, and did it reasonably use the Meta Model API and/or Meta's open-weight models during the hackathon?
2. **Stage two, scored 0–10 on the rubric:**

| Criterion | Weight | What judges look for |
|---|---|---|
| Impact | 30% | Real-world potential, who benefits and how much it matters, whether people could actually use it, and fit with a problem statement |
| Use of Meta AI tooling | 25% | How creatively Meta's tooling is used, going beyond a basic integration, and surfacing unexpected capabilities |
| Technical depth and execution | 20% | Sound, thoughtfully refined engineering that shows real craft |
| Demo | 25% | A working, impressive demo that holds up live, and the quality of the demo video |

3. **Stage three:** the top 5 projects per track go to a final round, where judges **watch the demo videos live** and rank them with the same rubric. The video is effectively the final exam.

## Prizes

- **Indie Developer track ($400,000):** 1st $150,000 · 2nd $100,000 · 3rd $75,000 · 4th $50,000 · 5th $25,000.
- **Bonus prizes (up to $50,000):** for example, a community vote award or a most viral project award.

## Credits and resources

- **Meta Model API ($150 per participant):**
  - Claim by Nov 4, 9 PM.
  - **Using the credits needs a credit card on file:** adding one triggers a temporary hold that's released within a few days.
  - Set a spend limit on the Billing page to stay within $150.
- **Modal ($100, first 1,000 participants):** GPUs, endpoints for Meta's open-weight models, and LLM training tools. We have these credits.
- **Baseten ($100 and a 2M tokens-per-minute limit, by request):** hosted Muse Spark Open. For the hackathon, use the model id `meta-models/muse-spark-open-1026`.
- **Fireworks ($100, shortlisted teams):** open-weight models, including training. The Oct 30 workshop covered training Muse open models.
- **Docs:** https://dev.meta.ai/docs/overview · cookbook: https://github.com/meta-models/meta-model-cookbook · open-weight cookbook: https://github.com/meta-models/meta-oss-cookbook
