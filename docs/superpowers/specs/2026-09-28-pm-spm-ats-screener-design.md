# PM/SPM ATS Resume Screener — Design Spec

Date: 2026-09-28
Status: Approved for planning

## Purpose

An internal tool for Kargo hiring (used by Arjun) to score PM and Senior PM
resumes against the company's 5-metric shortlisting rubric
(`docs/rubric/PM_SPM_Shortlist_Rubric.txt`), presented with an Apple-like
product design in the spirit of Resume Worded. Supports both a single-resume
instant report and a batch upload producing a ranked shortlist.

## Non-goals (v1)

- No user accounts / multi-user auth — single shared password gate.
- No email integration. Accept/Reject buttons only set a status field; the
  Gmail-draft-on-click integration is an explicitly deferred v2 feature. The
  data model reserves `candidates.status` and `candidates.email` so this can
  be added later without a schema migration that touches existing data.
- No resume rewrite/coaching suggestions — only score + evidence-based
  rationale per metric.
- No support for scanned/image-only PDFs (text-extraction only, no OCR).

## Scoring model

Source rubric: 5 metrics, each scored 1-4 by the rubric's explicit criteria:

1. Ground-Level Domain Grounding
2. Self-Initiated Ownership
3. Decision Autonomy Track Record
4. Role-Calibrated Product Craft (bar differs for PM vs. SPM)
5. Scale-Appropriate Experience & Complexity Handled (bar differs for PM vs. SPM)

Raw total = sum of the 5 metric scores (max 20, min 5).
Displayed total = raw total × 5, presented out of 100.

Two flags computed per the rubric's "How to Use" section:
- `flag_hidden_fit`: true if candidate scores 4 on Metrics 1-3 AND scores low
  (1-2) on Metric 5.
- `flag_spec_shallow`: true if candidate scores high (3-4) on Metrics 4-5 AND
  scores low (1-2) on Metrics 1-3.

Role (`PM` or `SPM`) is selected by Arjun at upload time and determines which
bar Gemini applies for Metrics 4 and 5. PM and SPM candidates are always
ranked in separate pools, never compared against each other.

## Architecture

Next.js (App Router) on Vercel. Neon Postgres for storage. Vercel Blob for
original resume files. Gemini 2.5 Flash for extraction-aware scoring.

### Data model (Neon Postgres)

```sql
candidates
  id            uuid primary key default gen_random_uuid()
  role          text not null check (role in ('PM','SPM'))
  name          text
  email         text                    -- extracted from resume; used by future email integration
  status        text not null default 'pending' check (status in ('pending','accepted','rejected'))
  file_url      text not null           -- Vercel Blob URL
  file_name     text not null
  resume_text   text not null           -- extracted text, kept for rationale traceability
  batch_id      uuid                    -- null for single uploads; shared by candidates uploaded together
  created_at    timestamptz not null default now()

scores
  id                  uuid primary key default gen_random_uuid()
  candidate_id        uuid not null unique references candidates(id) on delete cascade
  metric_1_score      int not null check (metric_1_score between 1 and 4)
  metric_1_rationale  text not null
  metric_2_score      int not null check (metric_2_score between 1 and 4)
  metric_2_rationale  text not null
  metric_3_score      int not null check (metric_3_score between 1 and 4)
  metric_3_rationale  text not null
  metric_4_score      int not null check (metric_4_score between 1 and 4)
  metric_4_rationale  text not null
  metric_5_score      int not null check (metric_5_score between 1 and 4)
  metric_5_rationale  text not null
  total_raw           int not null
  total_100           int not null
  flag_hidden_fit     boolean not null default false
  flag_spec_shallow   boolean not null default false
  created_at          timestamptz not null default now()
```

`scores.candidate_id` is unique — re-scoring a candidate is an upsert
(`ON CONFLICT (candidate_id) DO UPDATE`), no score history is kept.

### Backend flow

**Single upload / each file in a batch:**
1. Client requests a Vercel Blob client-upload token from
   `POST /api/blob-token`, uploads the file directly to Blob.
2. Client calls `POST /api/score` with `{ blobUrl, fileName, role, batchId? }`.
3. Server downloads the blob, extracts text: `pdf-parse` for `.pdf`,
   `mammoth` for `.docx`. Files that yield near-empty text (e.g.
   scanned/image PDFs) return a clear error to the client instead of
   silently scoring on nothing.
4. Server calls Gemini 2.5 Flash with the rubric's 5 metric definitions
   (role-appropriate Metric 4/5 bar), the extracted resume text, and a
   `responseSchema` that forces structured JSON output: one
   `{score, rationale}` per metric plus the two boolean flags.
5. Server computes `total_raw` / `total_100`, upserts `candidates` +
   `scores` rows in Neon.
6. Response returns the full score object.
7. On malformed/failed Gemini output: retry once, then return a per-file
   error the client shows inline (batch continues for other files).

**Batch upload:** N calls to the same `/api/score` endpoint, orchestrated
client-side with a concurrency cap of 5, sharing one client-generated
`batch_id`. A progress indicator shows "X/N scored." No server-side job
queue — each call is short enough to finish within a normal serverless
function invocation.

### Frontend

Pages:
- `/` — upload screen: PM/SPM role toggle, drag-and-drop (single or
  multi-file).
- `/candidate/[id]` — detail report: circular 0-100 score ring, 5-metric
  breakdown (1-4 pips + collapsible rationale), flag badges, Accept/Reject
  buttons (status only, no email action in v1).
- `/batch/[batchId]` — ranked table, PM and SPM pools shown/sorted
  separately, per-metric mini-bars, click-through to detail report.

Visual language: system font stack (renders as San Francisco on Apple
devices, Inter fallback elsewhere), generous whitespace, restrained neutral
palette with one accent color, soft-shadow cards, spring-eased transitions
(Framer Motion) on upload and score-reveal, rounded "glass" panels.

States to handle: upload progress, per-file batch progress, per-file error
with retry, empty states.

### Auth

`middleware.ts` gates all routes except the login page behind a signed
HTTP-only cookie. Login page posts a password to `POST /api/auth`, which
checks it against the `APP_PASSWORD` env var and sets the cookie on success.
No accounts, no per-user tracking.

### Environment variables

`GEMINI_API_KEY`, `DATABASE_URL` (Neon, auto-injected via Vercel's Neon
integration), `BLOB_READ_WRITE_TOKEN` (auto-injected via Vercel Blob),
`APP_PASSWORD`, `SESSION_SECRET` (cookie signing).

### Repo & deployment

New private GitHub repo, created and pushed via `gh` under the
`raahulpaatil` account. Connected to Vercel for auto-deploy on push to
`main`. Neon provisioned through Vercel's native Neon integration.

## Testing strategy

- Unit tests: raw→/100 conversion math, flag logic, text extraction against
  fixture PDF/DOCX files.
- Integration tests against `/api/score` with a mocked Gemini response
  (fixed JSON), verifying DB writes and response shape — no live Gemini
  calls in CI.
- Manual verification: upload a real resume post-deploy, confirm the report
  renders and reflects the rubric's intent.

## Future / v2 (explicitly out of scope now)

- Gmail draft-on-click integration: clicking Accept/Reject on a candidate
  drafts an appropriately-worded email in the user's Gmail drafts, using
  the candidate's extracted `email` and their score/rationale as content.
  Requires Gmail API OAuth — not built in this pass.
