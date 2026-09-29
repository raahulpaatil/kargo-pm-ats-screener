# PM/SPM ATS Resume Screener — Handoff

Picking this up in a new chat? Start here.

## The one thing that matters most

**All code is committed and pushed to GitHub:**
👉 **https://github.com/raahulpaatil/kargo-pm-ats-screener** (branch `main`)

Clone that repo and you have the entire, working, tested codebase. Nothing
local is load-bearing except the `.env.local` values listed below (never
committed, gitignored) — recreate that file in the new session and you can
pick up exactly where this left off.

## What this is

An Apple-styled ATS resume screener for PM/Senior PM hiring at Kargo. Arjun
(non-technical user) uploads one resume or a batch (PDF/DOCX); the app
extracts text, scores it against a 5-metric rubric via Gemini (structured
JSON output), computes a 0-100 score plus two "flag" signals, stores results
in Neon Postgres with the original file in Vercel Blob, and shows either a
single-candidate report or a ranked batch table. Single shared-password
gate. As of today it also sends Accept/Reject decision emails via Resend.

**Source docs in the repo** (read these for full detail, this file is just
the fast-orientation layer):
- `docs/superpowers/specs/2026-09-28-pm-spm-ats-screener-design.md` — the spec
- `docs/superpowers/plans/2026-09-28-pm-spm-ats-screener.md` — the 12-task implementation plan
- `docs/rubric/PM_SPM_Shortlist_Rubric.txt` — the scoring rubric (source of truth)

## Tech stack

Next.js 16 (App Router, Turbopack), Tailwind CSS v4, Neon Postgres
(`@neondatabase/serverless`), Gemini API (`gemini-3.8-flash`), Vercel Blob
(private access + authenticated reads), Resend (transactional email),
Vitest. Deployed on Vercel.

## Environment variables needed (`.env.local`, never committed)

```
GEMINI_API_KEY=AQ.Ab8RN6Jm-I-AD2_E9QqM2QIkL-wfV37Ocsw66Tu1Y8pLOavnEw
DATABASE_URL=postgresql://neondb_owner:npg_IP0YNioyM9lk@ep-soft-sea-b39qnt9y-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_W8qu3rUhKqUYtU2x_19G9HmBRbhIxVBz0U7ex5c1K5Gg2I2
APP_PASSWORD=123456
SESSION_SECRET=98f93e5ee1624818c89cf20a5aeb8442cd0935eed8f9d4144b9785ce67ccb8ea
RESEND_API_KEY=re_SN3iSYwg_NVmtniFPqbkp6hMqMnb4LxjJ
```

`APP_PASSWORD=123456` is still a placeholder — worth changing before wider use.

## Setup in a fresh session

```bash
git clone https://github.com/raahulpaatil/kargo-pm-ats-screener.git
cd kargo-pm-ats-screener
npm install
# create .env.local with the values above
npx dotenv -e .env.local -- npm run test   # should be 77/77 passing
npx dotenv -e .env.local -- npm run dev    # http://localhost:3000
```

## Deployment status (this is the messy part — read carefully)

Deployment took several detours this session. Current state:

- **GitHub identity:** all commits use `rahulmp458@gmail.com` (matches the
  GitHub account). Earlier commits accidentally used
  `rahul_patil@pg27.mesaschool.co`, which is **not** the GitHub account's
  email — this caused Vercel to silently block every git-triggered deploy
  with "commit email could not be matched to a GitHub account." The whole
  history was rewritten (`git filter-branch`) and force-pushed to fix this.
  **If you ever see a Vercel deploy silently stuck in "Blocked" state again,
  check this first** — Settings → check the deployment detail page for a
  "Deployment Blocked" banner explaining why.
- **Two Vercel projects exist** from trial and error:
  - `raahulpaatil/kargo-pm-ats-screener` (first attempt, under a Vercel
    account tied to `raahulpaatil` — **not the one to keep using**, it has
    the git-email mismatch baked into its deploy history)
  - `raahulpaatil/kargo-pm-ats-screener-zfvk` (created by importing the
    GitHub repo fresh, under the correct `rahulmp458@gmail.com` identity)
    — **this is the one that's actually live and working**, last deployed
    successfully with the PDF/DOMMatrix fix in place.
  - Consider deleting the first one to avoid confusion later.
- **Deployment Protection:** Vercel's own "Vercel Authentication" gate was
  ON by default on the new project and had to be turned off (Settings →
  Deployment Protection) so the app is reachable without a Vercel login —
  otherwise nobody without a Vercel account (including Arjun) could even
  reach the app's own password screen.
- **Vercel API tokens failed repeatedly** this session (`"User not found"`
  from Vercel's own API, reproducibly, across ~4 different tokens) for
  reasons never fully diagnosed. **Manual dashboard actions were the only
  reliable path** — if picking this up again and needing to script
  something via the Vercel API/CLI, expect this might still be broken; try
  a fresh token and verify with `curl -H "Authorization: Bearer TOKEN"
  https://api.vercel.com/v2/user` before trusting it.
- **Pending as of this handoff:** `RESEND_API_KEY` needs to be added to the
  `kargo-pm-ats-screener-zfvk` Vercel project's environment variables
  (Production) and redeployed — it's in local `.env.local` but wasn't
  confirmed added to Vercel before this session ended. Do this first.

## What's built (all 12 plan tasks + follow-ups, all tested)

- Auth: shared-password gate, HMAC-signed cookie, `src/proxy.ts` (Next 16
  renamed `middleware.ts` → `proxy.ts` — don't rename it back)
- Upload: `/`, drag-and-drop PDF/DOCX, PM/SPM role toggle, concurrency-capped
  batch upload (cap 5), per-file retry, private Vercel Blob storage
- Scoring pipeline: `/api/score` — extract text → Gemini (role-aware
  rubric prompt, retry-once-then-error) → compute totals/flags → write to
  Neon
- Views: `/candidate/[id]` (single report, score ring with Framer Motion
  reveal animation, metric breakdown, flag badges), `/batch/[batchId]`
  (ranked table, PM/SPM pools separate), `/candidates` (**every** candidate
  ever scored, filterable by role/status, sortable by score — added after
  the initial 12-task build in response to a follow-up request)
- Accept/Reject: opens an email preview (to/subject/body) before sending
  anything (Resend has no "drafts," only send) — confirming calls
  `/api/candidates/[id]/decision`, which sends via Resend and only updates
  status if the send succeeds. **Currently uses Resend's shared
  `onboarding@resend.dev` test domain, which can only deliver to the
  Resend account's own verified email — not real candidates.** To actually
  email candidates: verify a real domain at resend.com/domains, then update
  `DECISION_EMAIL_FROM` in `src/lib/email-templates.ts` (one line).

## Three real cross-task bugs found via live testing (all fixed, all in `main`)

These only surfaced once the app was driven end-to-end for real (browser →
dev server → real Gemini/Blob/Neon) — no earlier task's mocked tests could
have caught them:

1. **Vercel Blob was private-access-only**, not public as originally
   assumed. Fixed: client uploads use `access: 'private'`;
   `src/app/api/score/route.ts` reads back via `@vercel/blob`'s
   authenticated `get()` instead of a plain `fetch()`.
2. **`gemini-2.5-flash` was deprecated by Google mid-session.** Fixed:
   pinned to `gemini-3.8-flash` in `src/lib/gemini.ts`, verified against
   the real API.
3. **PDF extraction crashed on Vercel specifically** (not caught by local
   `next build && next start` testing) — `pdf-parse`/`pdfjs-dist`
   references `DOMMatrix` at module load time, and its own polyfill
   fallback (`@napi-rs/canvas`, a native binary) isn't reliably bundled by
   Vercel's serverless function tracer. Fixed in `src/lib/extract-text.ts`:
   the `pdf-parse` import is now lazy (inside the PDF-only branch) and
   preceded by a plain-JS `dommatrix` polyfill so pdfjs-dist's own
   `if (!globalThis.DOMMatrix)` check short-circuits before it ever tries
   the native binary. Verified against the real Vercel deployment logs,
   not just locally.

## Other gotchas worth knowing

- **Tailwind v4** doesn't read `tailwind.config.ts` automatically — needs
  an explicit `@config "../../tailwind.config.ts";` at the top of
  `src/app/globals.css` (already done, just don't remove it).
- **A hydration bug**: `toLocaleDateString()` with no explicit locale
  differs between Node's server-render and the browser's client-render,
  throwing a real React hydration error. Fixed by always passing an
  explicit locale (`toLocaleDateString('en-US')`) — watch for this pattern
  anywhere else a date gets formatted in a component that's both
  server-rendered and hydrated.
- Malformed UUIDs (bad `id`/`batchId` in a URL or request body) are
  guarded against everywhere with an `isUuid()` check before hitting
  Postgres, to avoid raw 500s — see `src/lib/candidates.ts` and
  `src/app/api/score/route.ts` for the pattern if adding new
  ID-accepting routes.

## Testing

`npx dotenv -e .env.local -- npm run test` — 77 tests across 17 files, all
passing as of the last commit. Several are real integration tests against
the live Neon DB (insert/assert/cleanup) and one against the real Vercel
Blob API — not mocked, by design, given the project's scale.

## Natural next steps

1. Add `RESEND_API_KEY` to Vercel (Production env) on
   `kargo-pm-ats-screener-zfvk` and redeploy — first priority.
2. Verify a real sending domain in Resend, update `DECISION_EMAIL_FROM`.
3. Change `APP_PASSWORD` from the `123456` placeholder.
4. Consider deleting the stray first Vercel project
   (`raahulpaatil/kargo-pm-ats-screener`) to avoid confusion.
5. Do a full real-world pass with Arjun: upload a batch of real resumes,
   confirm scores look sane against the rubric, try Accept/Reject once a
   domain is verified.
