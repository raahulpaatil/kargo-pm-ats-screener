# PM / SPM Resume Screener

Internal ATS tool that scores PM and Senior PM resumes against Kargo's
5-metric shortlisting rubric using Gemini 2.5 Flash, stores results in Neon
Postgres, and supports both single-resume and batch/ranked workflows.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in real values (Gemini API
   key, Neon connection string, Vercel Blob token, an app password, and a
   random session secret).
3. Apply the database schema: `npx dotenv -e .env.local -- npx tsx scripts/migrate.ts`
4. `npm run dev`

## Testing

`npx dotenv -e .env.local -- npm run test`

## Design & implementation docs

- `docs/superpowers/specs/2026-09-28-pm-spm-ats-screener-design.md`
- `docs/superpowers/plans/2026-09-28-pm-spm-ats-screener.md`
- `docs/rubric/PM_SPM_Shortlist_Rubric.txt`
