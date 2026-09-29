# PM/SPM ATS Resume Screener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy an Apple-styled ATS resume screener that scores PM/SPM resumes against Kargo's 5-metric rubric using Gemini 2.5 Flash, stores results in Neon Postgres, and supports both single-resume and batch-ranked workflows.

**Architecture:** Next.js (latest, App Router — scaffolded fresh in Task 1, currently 15.x, using its async `params: Promise<...>` route/page signature throughout) on Vercel. Client uploads resumes directly to Vercel Blob, then calls a `/api/score` route that extracts text (pdf-parse/mammoth), sends it to Gemini 2.5 Flash with a structured JSON schema, computes totals/flags, and upserts into Neon Postgres via `@neondatabase/serverless`. A single shared-password cookie gates all routes via middleware.

**Tech Stack:** Next.js 15.x (TypeScript, App Router), Tailwind CSS, `@neondatabase/serverless`, `@google/genai`, `pdf-parse`, `mammoth`, `@vercel/blob`, `framer-motion`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-pm-spm-ats-screener-design.md`

## Global Constraints

- Scoring: 5 metrics, each 1-4, per `docs/rubric/PM_SPM_Shortlist_Rubric.txt`. `total_raw` = sum (5-20). `total_100` = `total_raw * 5`.
- Role is `'PM'` or `'SPM'` only, selected by the user at upload time — never inferred.
- PM and SPM candidates are never ranked against each other.
- `flag_hidden_fit` = true when metric_1, metric_2, AND metric_3 are all exactly 4, AND metric_5 is 1 or 2 (metric_4 not considered, per the rubric's "How to Use" §3 wording).
- `flag_spec_shallow` = true when metric_4 AND metric_5 are both ≥3, AND the average of metric_1/2/3 is ≤2 (per the rubric's §4 wording) — see Task 3 for the exact function.
- Accepted file types: `.pdf` and `.docx` only.
- No OCR — image-only/scanned PDFs must produce a clear error, never a silent low-evidence score.
- No user accounts. Single shared password (`APP_PASSWORD` env var) gates every route, including API routes.
- `scores.candidate_id` is unique; re-scoring an existing candidate id is an upsert. Uploading a new file always creates a new candidate row (no automatic dedup by name/email in v1).
- Secrets live only in `.env.local` (gitignored) and Vercel project env vars — never committed, never logged.

## Review Focus

- A `.txt`, `.jpg`, or other non-PDF/DOCX file is uploaded — the app must reject it with a clear message before ever calling Gemini, not crash the extraction step.
- A scanned/image-only PDF with no extractable text is uploaded — must surface a clear per-file error, never silently score a near-empty resume.
- Gemini returns malformed JSON or an error despite the response schema — must retry once, then surface a per-candidate error and let the rest of a batch continue.
- A request hits an API route (e.g. `/api/score`, `/api/candidates/[id]`) directly without the auth cookie — must return 401, not just rely on page-level redirects.
- A PM-role upload and an SPM-role upload of similar resumes must receive genuinely different Metric 4/5 prompts — the role must visibly change which bar Gemini is told to apply, not just be stored as a label.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Modify: none (new project)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: the Next.js project skeleton every later task builds inside. Design tokens (colors, font stack) defined in `tailwind.config.ts` and `globals.css`, referenced by class name (`bg-accent`, `text-ink`, etc.) in all later component tasks.

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*" --no-turbopack --yes
```

- [ ] **Step 2: Install remaining dependencies**

```bash
npm install @neondatabase/serverless @google/genai pdf-parse mammoth @vercel/blob framer-motion
npm install -D vitest @vitejs/plugin-react pdf-lib docx
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 4: Define Apple-style design tokens**

Replace the `theme.extend` block in `tailwind.config.ts`:
```typescript
theme: {
  extend: {
    colors: {
      ink: '#1d1d1f',
      subtle: '#6e6e73',
      surface: '#ffffff',
      canvas: '#f5f5f7',
      accent: '#0071e3',
      good: '#1db954',
      warn: '#ff9500',
      danger: '#ff3b30',
    },
    fontFamily: {
      sans: [
        '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"',
        '"SF Pro Text"', 'Inter', 'Helvetica', 'Arial', 'sans-serif',
      ],
    },
    borderRadius: { xl2: '1.25rem' },
    boxShadow: { soft: '0 4px 24px rgba(0,0,0,0.06)' },
  },
},
```

- [ ] **Step 5: Verify the app boots**

Run: `npm run dev` in the background, then `curl -s http://localhost:3000 | grep -o "<title>.*</title>"`
Expected: a `<title>` tag prints with no error output. Stop the dev server after confirming.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with design tokens and test runner"
```

---

### Task 2: Database schema & client

**Files:**
- Create: `src/lib/schema.sql`, `src/lib/db.ts`, `scripts/migrate.ts`
- Test: `tests/unit/db.test.ts`

**Interfaces:**
- Consumes: `DATABASE_URL` from `.env.local`.
- Produces: `import { sql } from '@/lib/db'` — a tagged-template query function (from `@neondatabase/serverless`'s `neon()`) used by every later route/lib that touches Postgres.

- [ ] **Step 1: Write the schema**

Create `src/lib/schema.sql`:
```sql
create extension if not exists pgcrypto;

create table if not exists candidates (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in ('PM','SPM')),
  name          text,
  email         text,
  status        text not null default 'pending' check (status in ('pending','accepted','rejected')),
  file_url      text not null,
  file_name     text not null,
  resume_text   text not null,
  batch_id      uuid,
  created_at    timestamptz not null default now()
);

create table if not exists scores (
  id                  uuid primary key default gen_random_uuid(),
  candidate_id        uuid not null unique references candidates(id) on delete cascade,
  metric_1_score      int not null check (metric_1_score between 1 and 4),
  metric_1_rationale  text not null,
  metric_2_score      int not null check (metric_2_score between 1 and 4),
  metric_2_rationale  text not null,
  metric_3_score      int not null check (metric_3_score between 1 and 4),
  metric_3_rationale  text not null,
  metric_4_score      int not null check (metric_4_score between 1 and 4),
  metric_4_rationale  text not null,
  metric_5_score      int not null check (metric_5_score between 1 and 4),
  metric_5_rationale  text not null,
  total_raw           int not null,
  total_100           int not null,
  flag_hidden_fit     boolean not null default false,
  flag_spec_shallow   boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists idx_candidates_batch_id on candidates(batch_id);
```

- [ ] **Step 2: Write the Neon client**

Create `src/lib/db.ts`:
```typescript
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

export const sql = neon(process.env.DATABASE_URL)
```

- [ ] **Step 3: Write the migration script**

Create `scripts/migrate.ts`:
```typescript
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'
import path from 'path'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

const sql = neon(url)
const schema = readFileSync(path.join(__dirname, '../src/lib/schema.sql'), 'utf-8')

async function main() {
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    await sql(stmt)
  }
  console.log('Migration complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 4: Run the migration against the real Neon DB**

Run: `npx dotenv -e .env.local -- npx tsx scripts/migrate.ts` (install `tsx` and `dotenv-cli` as dev deps first: `npm install -D tsx dotenv-cli`)
Expected: prints `Migration complete.` with no errors.

- [ ] **Step 5: Write a smoke test against the live DB**

Create `tests/unit/db.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { sql } from '@/lib/db'

describe('db', () => {
  let insertedId: string | undefined

  afterEach(async () => {
    if (insertedId) {
      await sql`delete from candidates where id = ${insertedId}`
      insertedId = undefined
    }
  })

  it('inserts and reads a candidate row', async () => {
    const rows = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text)
      values ('PM', 'Test Candidate', 'https://example.com/f.pdf', 'f.pdf', 'sample text')
      returning id, role, name
    `
    insertedId = rows[0].id as string
    expect(rows[0].role).toBe('PM')
    expect(rows[0].name).toBe('Test Candidate')
  })
})
```

- [ ] **Step 6: Run the test**

Run: `npx dotenv -e .env.local -- npm run test`
Expected: `db.test.ts` passes (1 test).

- [ ] **Step 7: Commit**

```bash
git add src/lib/schema.sql src/lib/db.ts scripts/migrate.ts tests/unit/db.test.ts package.json package-lock.json
git commit -m "feat: add Neon schema, client, and migration script"
```

---

### Task 3: Scoring math (pure functions)

**Files:**
- Create: `src/lib/scoring.ts`
- Test: `tests/unit/scoring.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces:
  - `type MetricScores = { metric1: number; metric2: number; metric3: number; metric4: number; metric5: number }`
  - `computeTotals(scores: MetricScores): { totalRaw: number; total100: number }`
  - `computeFlags(scores: MetricScores): { flagHiddenFit: boolean; flagSpecShallow: boolean }`
  Both consumed by Task 8 (`/api/score` route).

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { computeTotals, computeFlags, MetricScores } from '@/lib/scoring'

const base: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 2, metric5: 2 }

describe('computeTotals', () => {
  it('sums the five metrics and scales by 5', () => {
    expect(computeTotals(base)).toEqual({ totalRaw: 10, total100: 50 })
  })
  it('handles the minimum (all 1s)', () => {
    const min: MetricScores = { metric1: 1, metric2: 1, metric3: 1, metric4: 1, metric5: 1 }
    expect(computeTotals(min)).toEqual({ totalRaw: 5, total100: 25 })
  })
  it('handles the maximum (all 4s)', () => {
    const max: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 4, metric5: 4 }
    expect(computeTotals(max)).toEqual({ totalRaw: 20, total100: 100 })
  })
})

describe('computeFlags', () => {
  it('flags hidden fit: 1-3 all 4, metric5 low', () => {
    const s: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 2, metric5: 1 }
    expect(computeFlags(s)).toEqual({ flagHiddenFit: true, flagSpecShallow: false })
  })
  it('does not flag hidden fit if metric5 is 3', () => {
    const s: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 2, metric5: 3 }
    expect(computeFlags(s).flagHiddenFit).toBe(false)
  })
  it('does not flag hidden fit if one of 1-3 is below 4', () => {
    const s: MetricScores = { metric1: 4, metric2: 3, metric3: 4, metric4: 2, metric5: 1 }
    expect(computeFlags(s).flagHiddenFit).toBe(false)
  })
  it('flags spec-shallow: 4-5 both high, 1-3 average low', () => {
    const s: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 4, metric5: 3 }
    expect(computeFlags(s)).toEqual({ flagHiddenFit: false, flagSpecShallow: true })
  })
  it('does not flag spec-shallow if metric4 is below 3', () => {
    const s: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 2, metric5: 3 }
    expect(computeFlags(s).flagSpecShallow).toBe(false)
  })
  it('does not flag spec-shallow if 1-3 average is above 2', () => {
    const s: MetricScores = { metric1: 3, metric2: 2, metric3: 2, metric4: 4, metric5: 4 }
    expect(computeFlags(s).flagSpecShallow).toBe(false)
  })
  it('flags neither when scores are balanced', () => {
    expect(computeFlags(base)).toEqual({ flagHiddenFit: false, flagSpecShallow: false })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/unit/scoring.test.ts`
Expected: FAIL — `Cannot find module '@/lib/scoring'`.

- [ ] **Step 3: Implement**

Create `src/lib/scoring.ts`:
```typescript
export type MetricScores = {
  metric1: number
  metric2: number
  metric3: number
  metric4: number
  metric5: number
}

export function computeTotals(scores: MetricScores): { totalRaw: number; total100: number } {
  const totalRaw = scores.metric1 + scores.metric2 + scores.metric3 + scores.metric4 + scores.metric5
  return { totalRaw, total100: totalRaw * 5 }
}

export function computeFlags(scores: MetricScores): { flagHiddenFit: boolean; flagSpecShallow: boolean } {
  const { metric1, metric2, metric3, metric4, metric5 } = scores

  const flagHiddenFit =
    metric1 === 4 && metric2 === 4 && metric3 === 4 && metric5 <= 2

  const avg123 = (metric1 + metric2 + metric3) / 3
  const flagSpecShallow = metric4 >= 3 && metric5 >= 3 && avg123 <= 2

  return { flagHiddenFit, flagSpecShallow }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/unit/scoring.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/unit/scoring.test.ts
git commit -m "feat: add scoring math and hidden-fit/spec-shallow flag logic"
```

---

### Task 4: Resume text extraction

**Files:**
- Create: `src/lib/extract-text.ts`
- Test: `tests/unit/extract-text.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type FileKind = 'pdf' | 'docx'`
  - `fileKindFromName(fileName: string): FileKind | null`
  - `class ExtractionError extends Error`
  - `extractText(buffer: Buffer, kind: FileKind): Promise<string>` — throws `ExtractionError` for unreadable/near-empty content. Consumed by Task 8 (`/api/score` route).

- [ ] **Step 1: Write the failing tests (with generated fixtures)**

Create `tests/unit/extract-text.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { extractText, fileKindFromName, ExtractionError } from '@/lib/extract-text'

async function makePdf(text: string | null): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  if (text) {
    const font = await doc.embedFont(StandardFonts.Helvetica)
    page.drawText(text, { x: 50, y: page.getHeight() - 50, size: 12, font })
  }
  const bytes = await doc.save()
  return Buffer.from(bytes)
}

async function makeDocx(text: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  })
  return Packer.toBuffer(doc)
}

describe('fileKindFromName', () => {
  it('recognizes .pdf', () => expect(fileKindFromName('resume.pdf')).toBe('pdf'))
  it('recognizes .docx case-insensitively', () => expect(fileKindFromName('Resume.DOCX')).toBe('docx'))
  it('returns null for unsupported extensions', () => expect(fileKindFromName('resume.txt')).toBeNull())
})

describe('extractText', () => {
  it('extracts text from a PDF', async () => {
    const buf = await makePdf('Product Manager with 5 years of experience shipping features and killing underperforming ones based on data.')
    const text = await extractText(buf, 'pdf')
    expect(text).toContain('Product Manager')
  })

  it('extracts text from a DOCX', async () => {
    const buf = await makeDocx('Senior Product Manager who owned integration architecture decisions across three platform teams.')
    const text = await extractText(buf, 'docx')
    expect(text).toContain('Senior Product Manager')
  })

  it('throws ExtractionError on a near-empty PDF (scanned/image-only)', async () => {
    const buf = await makePdf(null)
    await expect(extractText(buf, 'pdf')).rejects.toThrow(ExtractionError)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- tests/unit/extract-text.test.ts`
Expected: FAIL — `Cannot find module '@/lib/extract-text'`.

- [ ] **Step 3: Implement**

Create `src/lib/extract-text.ts`:
```typescript
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

export type FileKind = 'pdf' | 'docx'

const MIN_TEXT_LENGTH = 30

export class ExtractionError extends Error {}

export function fileKindFromName(fileName: string): FileKind | null {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.docx')) return 'docx'
  return null
}

export async function extractText(buffer: Buffer, kind: FileKind): Promise<string> {
  let text: string

  if (kind === 'pdf') {
    const result = await pdfParse(buffer)
    text = result.text
  } else {
    const result = await mammoth.extractRawText({ buffer })
    text = result.value
  }

  const trimmed = text.trim()
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new ExtractionError(
      'Could not extract readable text from this file. It may be a scanned or image-only document, which is not supported.'
    )
  }
  return trimmed
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- tests/unit/extract-text.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extract-text.ts tests/unit/extract-text.test.ts
git commit -m "feat: add PDF/DOCX text extraction with near-empty rejection"
```

---

### Task 5: Rubric prompt + Gemini scoring

**Files:**
- Create: `src/lib/rubric.ts`, `src/lib/gemini.ts`
- Test: `tests/unit/rubric.test.ts`, `tests/unit/gemini.test.ts`

**Interfaces:**
- Consumes: `GEMINI_API_KEY` from `.env.local`.
- Produces:
  - `type Role = 'PM' | 'SPM'` (also used by Tasks 8, 9, 11)
  - `buildPrompt(resumeText: string, role: Role): string`
  - `type MetricResult = { score: number; rationale: string }`
  - `type GeminiScoreResult = { candidateName: string; candidateEmail: string; metric1: MetricResult; metric2: MetricResult; metric3: MetricResult; metric4: MetricResult; metric5: MetricResult }` (`candidateName`/`candidateEmail` are `''` when not found in the resume)
  - `class GeminiScoringError extends Error`
  - `scoreResume(resumeText: string, role: Role, client?: GoogleGenAI): Promise<GeminiScoreResult>` — retries once internally on malformed output, then throws `GeminiScoringError`. Consumed by Task 8.

- [ ] **Step 1: Write the rubric prompt builder**

Create `src/lib/rubric.ts`:
```typescript
export type Role = 'PM' | 'SPM'

const METRIC_4_BAR: Record<Role, string> = {
  PM: `For PM applicants: look for discovery work with real users, shipped features
with adoption evidence, and — critically — features KILLED based on data, not just
shipped. Comfort working without a PM handbook, sprint template, or design system
already in place. A 4 requires: shipped, killed, AND a specific higher-stakes call
made in an unstructured environment (0-to-1 process creation) that others now rely on.`,
  SPM: `For Senior PM applicants: look for ownership of integration/architecture-level
decisions (what to build vs. configure vs. avoid), reliability/data-quality
accountability, and evidence of shaping how a product function works (frameworks,
standards, practices for others) — not just running one. A 4 requires: shipped,
killed, AND a specific integration/architecture trade-off with multi-year
consequences that others now rely on.`,
}

const METRIC_5_BAND: Record<Role, string> = {
  PM: 'PM target: 2-4 years of PM experience; ideally at a company building a product/function for the first time.',
  SPM: 'Senior PM target: 5-8 years of PM experience; ideally including platform products, integration layers, or complex technical environments, and some early-stage-company exposure.',
}

export function buildPrompt(resumeText: string, role: Role): string {
  return `You are scoring a resume against Kargo's PM/Senior PM shortlisting rubric.
The candidate applied for the ${role === 'PM' ? 'Product Manager' : 'Senior Product Manager'} role.
Score each metric 1-4 using ONLY evidence stated in the resume text below — do not
infer beyond what is written. A candidate with zero evidence on a metric scores 1,
never a blank or a 0.

METRIC 1 — Ground-Level Domain Grounding (logistics/freight/ops reality):
1 = no logistics/ops/supply-chain exposure anywhere in career.
2 = sold or built software for logistics clients, but no hands-on operational role.
3 = held an operational role in an adjacent domain (general supply chain, e-commerce
fulfilment) but not freight/customs/port.
4 = held a hands-on operational role directly in freight forwarding, customs, port
operations, or carrier logistics.

METRIC 2 — Self-Initiated Ownership (built/fixed the unasked-for thing):
1 = no specific instance found; only generic self-description ("proactive," "self-starter").
2 = one instance of solving an assigned problem well, but it was requested/expected.
3 = one self-initiated fix/build, but adoption/impact unclear or limited to the
candidate's own work.
4 = one or more dated, specific instances of building/fixing something unprompted,
under real constraint, that was adopted by a team or became standard practice.

METRIC 3 — Decision Autonomy Track Record (no senior layer catching errors):
1 = always operated inside a structured team with a senior owner making final calls.
2 = contributed to decisions but shared final accountability with a manager or peer group.
3 = owned a defined area independently, with informal/occasional escalation to a manager.
4 = explicitly the final decision-maker in their area for an extended period, with
stated evidence of no escalation layer (sole owner, no account manager, no committee).

METRIC 4 — Role-Calibrated Product Craft:
${METRIC_4_BAR[role]}
1 = no evidence of discovery, shipping, or prioritization judgment; purely execution
of specs handed to them.
2 = shipped features with defined process support (existing templates, structured
discovery, PM team backing) — competent but not built for ambiguity.
3 = shipped AND killed at least one feature/initiative based on data or user
evidence, in a reasonably structured environment.
4 = shipped, killed, and can point to a specific higher-stakes call made in an
unstructured environment that others now rely on (see role-specific bar above).

METRIC 5 — Scale-Appropriate Experience & Complexity Handled:
${METRIC_5_BAND[role]}
1 = experience level clearly mismatched to the role applied for, or complexity of
systems/orgs managed is materially below what the role needs.
2 = close to the experience band but complexity handled is lower than the role demands.
3 = squarely within the experience band with complexity roughly matched to the role.
4 = within (or slightly beyond, without being a flight risk for over-levelling) the
experience band, with complexity handled that meets or exceeds what the role demands.

RESUME TEXT:
"""
${resumeText}
"""

Also extract the candidate's full name and email address from the resume text if
present. Return empty strings for candidateName/candidateEmail if not found —
never invent one.

For each metric, return an integer score 1-4 and a short rationale (1-2 sentences)
quoting or paraphrasing the specific resume evidence that justifies the score.`
}
```

- [ ] **Step 2: Write a failing test for the prompt builder**

Create `tests/unit/rubric.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@/lib/rubric'

describe('buildPrompt', () => {
  it('includes PM-specific Metric 4 bar for PM role', () => {
    const prompt = buildPrompt('some resume text', 'PM')
    expect(prompt).toContain('0-to-1 process creation')
    expect(prompt).not.toContain('integration/architecture trade-off with')
  })

  it('includes SPM-specific Metric 4 bar for SPM role', () => {
    const prompt = buildPrompt('some resume text', 'SPM')
    expect(prompt).toContain('integration/architecture trade-off with')
    expect(prompt).not.toContain('0-to-1 process creation')
  })

  it('includes the resume text verbatim', () => {
    const prompt = buildPrompt('UNIQUE_MARKER_TEXT_12345', 'PM')
    expect(prompt).toContain('UNIQUE_MARKER_TEXT_12345')
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm run test -- tests/unit/rubric.test.ts`
Expected: PASS (3 tests) — `rubric.ts` was written directly above, so this confirms the role branching is correct rather than testing a red state first.

- [ ] **Step 4: Write the Gemini client wrapper**

Create `src/lib/gemini.ts`:
```typescript
import { GoogleGenAI, Type } from '@google/genai'
import { buildPrompt, Role } from '@/lib/rubric'

export type MetricResult = { score: number; rationale: string }
export type GeminiScoreResult = {
  candidateName: string
  candidateEmail: string
  metric1: MetricResult
  metric2: MetricResult
  metric3: MetricResult
  metric4: MetricResult
  metric5: MetricResult
}

export class GeminiScoringError extends Error {}

const METRIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    rationale: { type: Type.STRING },
  },
  required: ['score', 'rationale'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING },
    candidateEmail: { type: Type.STRING },
    metric1: METRIC_SCHEMA,
    metric2: METRIC_SCHEMA,
    metric3: METRIC_SCHEMA,
    metric4: METRIC_SCHEMA,
    metric5: METRIC_SCHEMA,
  },
  required: ['candidateName', 'candidateEmail', 'metric1', 'metric2', 'metric3', 'metric4', 'metric5'],
}

function isValidResult(data: unknown): data is GeminiScoreResult {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (typeof record.candidateName !== 'string' || typeof record.candidateEmail !== 'string') {
    return false
  }
  const keys = ['metric1', 'metric2', 'metric3', 'metric4', 'metric5'] as const
  return keys.every((k) => {
    const m = record[k]
    return (
      typeof m === 'object' && m !== null &&
      typeof (m as MetricResult).score === 'number' &&
      (m as MetricResult).score >= 1 && (m as MetricResult).score <= 4 &&
      typeof (m as MetricResult).rationale === 'string'
    )
  })
}

async function callOnce(client: GoogleGenAI, prompt: string): Promise<GeminiScoreResult | null> {
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })
  const text = response.text
  if (!text) return null
  try {
    const data = JSON.parse(text)
    return isValidResult(data) ? data : null
  } catch {
    return null
  }
}

export async function scoreResume(
  resumeText: string,
  role: Role,
  client: GoogleGenAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
): Promise<GeminiScoreResult> {
  const prompt = buildPrompt(resumeText, role)

  const first = await callOnce(client, prompt)
  if (first) return first

  const retry = await callOnce(client, prompt)
  if (retry) return retry

  throw new GeminiScoringError('Gemini returned an unparseable or invalid score twice in a row.')
}
```

- [ ] **Step 5: Write a failing test with a mocked client**

Create `tests/unit/gemini.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { scoreResume, GeminiScoringError } from '@/lib/gemini'
import type { GoogleGenAI } from '@google/genai'

function mockClient(responses: (string | null)[]): GoogleGenAI {
  const generateContent = vi.fn()
  for (const r of responses) {
    generateContent.mockResolvedValueOnce({ text: r })
  }
  return { models: { generateContent } } as unknown as GoogleGenAI
}

const validJson = JSON.stringify({
  candidateName: 'Jane Doe',
  candidateEmail: 'jane@example.com',
  metric1: { score: 4, rationale: 'ex-ops exec' },
  metric2: { score: 3, rationale: 'built a tool overnight' },
  metric3: { score: 4, rationale: 'sole PM, no escalation' },
  metric4: { score: 3, rationale: 'shipped and killed a feature' },
  metric5: { score: 3, rationale: '3 years PM experience' },
})

describe('scoreResume', () => {
  it('returns the parsed result on a valid first response', async () => {
    const client = mockClient([validJson])
    const result = await scoreResume('resume text', 'PM', client)
    expect(result.metric1.score).toBe(4)
    expect(result.metric3.rationale).toContain('no escalation')
    expect(result.candidateName).toBe('Jane Doe')
    expect(result.candidateEmail).toBe('jane@example.com')
  })

  it('retries once on malformed JSON, then succeeds', async () => {
    const client = mockClient(['not json', validJson])
    const result = await scoreResume('resume text', 'PM', client)
    expect(result.metric4.score).toBe(3)
    expect(client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it('throws GeminiScoringError after two malformed responses', async () => {
    const client = mockClient(['not json', 'still not json'])
    await expect(scoreResume('resume text', 'PM', client)).rejects.toThrow(GeminiScoringError)
  })

  it('throws GeminiScoringError if a score is out of range', async () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), metric1: { score: 9, rationale: 'x' } })
    const client = mockClient([bad, bad])
    await expect(scoreResume('resume text', 'PM', client)).rejects.toThrow(GeminiScoringError)
  })
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- tests/unit/gemini.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/rubric.ts src/lib/gemini.ts tests/unit/rubric.test.ts tests/unit/gemini.test.ts
git commit -m "feat: add role-aware rubric prompt and Gemini scoring with retry"
```

---

### Task 6: Auth (shared password gate)

**Files:**
- Create: `src/lib/auth.ts`, `src/app/api/auth/route.ts`, `src/middleware.ts`, `src/app/login/page.tsx`
- Test: `tests/unit/auth.test.ts`, `tests/unit/auth-route.test.ts`, `tests/unit/middleware.test.ts`

**Interfaces:**
- Consumes: `APP_PASSWORD`, `SESSION_SECRET` from `.env.local`.
- Produces: `SESSION_COOKIE_NAME`, `checkPassword`, `createSessionCookieValue`, `isValidSessionCookieValue` from `@/lib/auth` — used only inside this task's own route and middleware.

- [ ] **Step 1: Write the failing test for the auth lib**

Create `tests/unit/auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { checkPassword, createSessionCookieValue, isValidSessionCookieValue } from '@/lib/auth'

describe('checkPassword', () => {
  it('accepts the correct password', () => {
    expect(checkPassword(process.env.APP_PASSWORD!)).toBe(true)
  })
  it('rejects an incorrect password', () => {
    expect(checkPassword('definitely-wrong')).toBe(false)
  })
})

describe('session cookie', () => {
  it('a freshly created cookie value is valid', () => {
    expect(isValidSessionCookieValue(createSessionCookieValue())).toBe(true)
  })
  it('rejects a tampered value', () => {
    const value = createSessionCookieValue()
    const tampered = value.slice(0, -1) + (value.endsWith('a') ? 'b' : 'a')
    expect(isValidSessionCookieValue(tampered)).toBe(false)
  })
  it('rejects undefined/empty', () => {
    expect(isValidSessionCookieValue(undefined)).toBe(false)
    expect(isValidSessionCookieValue('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`.

- [ ] **Step 3: Implement the auth lib**

Create `src/lib/auth.ts`:
```typescript
import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE_NAME = 'ats_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) throw new Error('APP_PASSWORD is not set')
  return safeEqual(candidate, expected)
}

export function createSessionCookieValue(): string {
  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiry)
  return `${payload}.${sign(payload)}`
}

export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  if (Date.now() > Number(payload)) return false
  return safeEqual(signature, sign(payload))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/auth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the login API route and its test**

Create `src/app/api/auth/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, createSessionCookieValue, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const password = body?.password
  if (typeof password !== 'string' || !checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  })
  return res
}
```

Create `tests/unit/auth-route.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/route'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

function makeRequest(password: unknown) {
  return new NextRequest('http://localhost:3000/api/auth', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth', () => {
  it('sets a session cookie on correct password', async () => {
    const res = await POST(makeRequest(process.env.APP_PASSWORD))
    expect(res.status).toBe(200)
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeTruthy()
  })

  it('returns 401 on incorrect password', async () => {
    const res = await POST(makeRequest('wrong'))
    expect(res.status).toBe(401)
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeFalsy()
  })
})
```

- [ ] **Step 6: Run the route test**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/auth-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Write middleware and its test**

Create `src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/login' || pathname === '/api/auth') {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (isValidSessionCookieValue(cookie)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

Create `tests/unit/middleware.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth'

describe('middleware', () => {
  it('redirects an unauthenticated page request to /login', () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('returns 401 for an unauthenticated API request', () => {
    const req = new NextRequest('http://localhost:3000/api/score')
    const res = middleware(req)
    expect(res.status).toBe(401)
  })

  it('passes through an authenticated page request', () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}` },
    })
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('never blocks /login or /api/auth', () => {
    expect(middleware(new NextRequest('http://localhost:3000/login')).status).toBe(200)
    expect(middleware(new NextRequest('http://localhost:3000/api/auth')).status).toBe(200)
  })
})
```

- [ ] **Step 8: Run the middleware test**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/middleware.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Build the login page**

Create `src/app/login/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('Incorrect password.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <form onSubmit={handleSubmit} className="bg-surface shadow-soft rounded-xl2 p-10 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-ink mb-1">PM/SPM Screener</h1>
        <p className="text-subtle text-sm mb-6">Enter the password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Password"
          autoFocus
        />
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-white rounded-lg py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 10: Manual verification**

Run `npm run dev`, visit `http://localhost:3000/` — expect a redirect to `/login`. Enter the wrong password — expect an inline error. Enter the correct `APP_PASSWORD` value — expect redirect to `/` (will 404/blank until Task 11, that's expected at this point).

- [ ] **Step 11: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/route.ts src/middleware.ts src/app/login/page.tsx tests/unit/auth.test.ts tests/unit/auth-route.test.ts tests/unit/middleware.test.ts
git commit -m "feat: add shared-password auth gate with signed session cookie"
```

---

### Task 7: Blob client-upload token route

**Files:**
- Create: `src/app/api/blob-token/route.ts`
- Test: `tests/unit/blob-token.test.ts`

**Interfaces:**
- Consumes: `BLOB_READ_WRITE_TOKEN` from `.env.local`.
- Produces: `POST /api/blob-token` endpoint, called directly by the browser via `@vercel/blob/client`'s `upload()` helper in Task 11 (not called from our own server code).

- [ ] **Step 1: Implement the route**

Create `src/app/api/blob-token/route.ts`:
```typescript
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // No-op: the client calls /api/score itself once the upload finishes,
        // so we don't need Vercel's webhook to drive anything server-side.
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 2: Write a test against the live Blob token**

Create `tests/unit/blob-token.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/blob-token/route'

function makeTokenRequest(pathname: string) {
  const body = {
    type: 'blob.generate-client-token',
    payload: {
      pathname,
      callbackUrl: 'http://localhost:3000/api/blob-token',
      multipart: false,
      clientPayload: null,
    },
  }
  return new Request('http://localhost:3000/api/blob-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/blob-token', () => {
  it('issues a client token for a pdf pathname', async () => {
    const res = await POST(makeTokenRequest('resumes/sample.pdf'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(typeof json.clientToken).toBe('string')
  })
})
```

- [ ] **Step 3: Run the test**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/blob-token.test.ts`
Expected: PASS (1 test). If the response shape differs from `@vercel/blob`'s current version, adjust the assertion to match the installed package's actual `HandleUploadBody`/response types — the important behavior is a 200 with a usable client token, not the exact field name.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/blob-token/route.ts tests/unit/blob-token.test.ts
git commit -m "feat: add Vercel Blob client-upload token route"
```

---

### Task 8: Score API route (orchestration)

**Files:**
- Create: `src/lib/types.ts`, `src/app/api/score/route.ts`
- Test: `tests/integration/score-route.test.ts`

**Interfaces:**
- Consumes: `fileKindFromName`/`extractText`/`ExtractionError` (Task 4), `scoreResume`/`GeminiScoringError` (Task 5), `computeTotals`/`computeFlags` (Task 3), `sql` (Task 2).
- Produces:
  - `type CandidateWithScore` from `@/lib/types` — consumed by Tasks 9, 10, 11.
  - `POST /api/score` — consumed by Task 11 (upload page).

- [ ] **Step 1: Define the shared response type**

Create `src/lib/types.ts`:
```typescript
import type { Role } from '@/lib/rubric'

export type CandidateStatus = 'pending' | 'accepted' | 'rejected'

export type CandidateWithScore = {
  id: string
  role: Role
  name: string | null
  email: string | null
  status: CandidateStatus
  fileUrl: string
  fileName: string
  batchId: string | null
  createdAt: string
  score: {
    metric1Score: number; metric1Rationale: string
    metric2Score: number; metric2Rationale: string
    metric3Score: number; metric3Rationale: string
    metric4Score: number; metric4Rationale: string
    metric5Score: number; metric5Rationale: string
    totalRaw: number
    total100: number
    flagHiddenFit: boolean
    flagSpecShallow: boolean
  }
}
```

- [ ] **Step 2: Implement the route**

Create `src/app/api/score/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { fileKindFromName, extractText, ExtractionError } from '@/lib/extract-text'
import { scoreResume, GeminiScoringError } from '@/lib/gemini'
import { computeTotals, computeFlags } from '@/lib/scoring'
import type { Role } from '@/lib/rubric'
import type { CandidateWithScore } from '@/lib/types'

type ScoreRequestBody = {
  blobUrl: string
  fileName: string
  role: Role
  batchId?: string
}

function isValidBody(body: unknown): body is ScoreRequestBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.blobUrl === 'string' &&
    typeof b.fileName === 'string' &&
    (b.role === 'PM' || b.role === 'SPM') &&
    (b.batchId === undefined || typeof b.batchId === 'string')
  )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const kind = fileKindFromName(body.fileName)
  if (!kind) {
    return NextResponse.json(
      { error: `Unsupported file type for "${body.fileName}". Only .pdf and .docx are accepted.` },
      { status: 400 }
    )
  }

  const fileRes = await fetch(body.blobUrl)
  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Could not download the uploaded file.' }, { status: 400 })
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer())

  let resumeText: string
  try {
    resumeText = await extractText(buffer, kind)
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  let gemini
  try {
    gemini = await scoreResume(resumeText, body.role)
  } catch (err) {
    if (err instanceof GeminiScoringError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    throw err
  }

  const metricScores = {
    metric1: gemini.metric1.score,
    metric2: gemini.metric2.score,
    metric3: gemini.metric3.score,
    metric4: gemini.metric4.score,
    metric5: gemini.metric5.score,
  }
  const { totalRaw, total100 } = computeTotals(metricScores)
  const { flagHiddenFit, flagSpecShallow } = computeFlags(metricScores)

  const [candidate] = await sql`
    insert into candidates (role, name, email, file_url, file_name, resume_text, batch_id)
    values (
      ${body.role},
      ${gemini.candidateName || null},
      ${gemini.candidateEmail || null},
      ${body.blobUrl},
      ${body.fileName},
      ${resumeText},
      ${body.batchId || null}
    )
    returning id, role, name, email, status, file_url, file_name, batch_id, created_at
  `

  const [score] = await sql`
    insert into scores (
      candidate_id,
      metric_1_score, metric_1_rationale,
      metric_2_score, metric_2_rationale,
      metric_3_score, metric_3_rationale,
      metric_4_score, metric_4_rationale,
      metric_5_score, metric_5_rationale,
      total_raw, total_100, flag_hidden_fit, flag_spec_shallow
    ) values (
      ${candidate.id},
      ${gemini.metric1.score}, ${gemini.metric1.rationale},
      ${gemini.metric2.score}, ${gemini.metric2.rationale},
      ${gemini.metric3.score}, ${gemini.metric3.rationale},
      ${gemini.metric4.score}, ${gemini.metric4.rationale},
      ${gemini.metric5.score}, ${gemini.metric5.rationale},
      ${totalRaw}, ${total100}, ${flagHiddenFit}, ${flagSpecShallow}
    )
    returning *
  `

  const result: CandidateWithScore = {
    id: candidate.id as string,
    role: candidate.role as Role,
    name: candidate.name as string | null,
    email: candidate.email as string | null,
    status: candidate.status as CandidateWithScore['status'],
    fileUrl: candidate.file_url as string,
    fileName: candidate.file_name as string,
    batchId: candidate.batch_id as string | null,
    createdAt: candidate.created_at as string,
    score: {
      metric1Score: score.metric_1_score as number, metric1Rationale: score.metric_1_rationale as string,
      metric2Score: score.metric_2_score as number, metric2Rationale: score.metric_2_rationale as string,
      metric3Score: score.metric_3_score as number, metric3Rationale: score.metric_3_rationale as string,
      metric4Score: score.metric_4_score as number, metric4Rationale: score.metric_4_rationale as string,
      metric5Score: score.metric_5_score as number, metric5Rationale: score.metric_5_rationale as string,
      totalRaw: score.total_raw as number,
      total100: score.total_100 as number,
      flagHiddenFit: score.flag_hidden_fit as boolean,
      flagSpecShallow: score.flag_spec_shallow as boolean,
    },
  }

  return NextResponse.json(result)
}
```

- [ ] **Step 3: Write the integration test (mocked extraction/Gemini, real Neon DB)**

Create `tests/integration/score-route.test.ts`:
```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { ExtractionError } from '@/lib/extract-text'
import { GeminiScoringError } from '@/lib/gemini'

vi.mock('@/lib/extract-text', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/extract-text')>()
  return { ...actual, extractText: vi.fn() }
})
vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>()
  return { ...actual, scoreResume: vi.fn() }
})

import { extractText } from '@/lib/extract-text'
import { scoreResume } from '@/lib/gemini'
import { POST } from '@/app/api/score/route'

const mockedExtractText = vi.mocked(extractText)
const mockedScoreResume = vi.mocked(scoreResume)

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/score', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const validGeminiResult = {
  candidateName: 'Jane Doe',
  candidateEmail: 'jane@example.com',
  metric1: { score: 4, rationale: 'r1' },
  metric2: { score: 3, rationale: 'r2' },
  metric3: { score: 4, rationale: 'r3' },
  metric4: { score: 3, rationale: 'r4' },
  metric5: { score: 3, rationale: 'r5' },
}

describe('POST /api/score', () => {
  let insertedId: string | undefined

  afterEach(async () => {
    vi.restoreAllMocks()
    if (insertedId) {
      await sql`delete from candidates where id = ${insertedId}`
      insertedId = undefined
    }
  })

  it('rejects an unsupported file type before extraction/scoring', async () => {
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.txt', fileName: 'resume.txt', role: 'PM' }))
    expect(res.status).toBe(400)
    expect(mockedExtractText).not.toHaveBeenCalled()
  })

  it('returns 400 with a clear message on ExtractionError', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as typeof fetch
    mockedExtractText.mockRejectedValue(new ExtractionError('scanned/image-only'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('scanned/image-only')
  })

  it('returns 502 with a clear message on GeminiScoringError', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as typeof fetch
    mockedExtractText.mockResolvedValue('extracted resume text')
    mockedScoreResume.mockRejectedValue(new GeminiScoringError('gave up after two tries'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json.error).toContain('gave up after two tries')
  })

  it('writes a candidate + score row and returns the combined result on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }) as typeof fetch
    mockedExtractText.mockResolvedValue('extracted resume text')
    mockedScoreResume.mockResolvedValue(validGeminiResult)

    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    insertedId = json.id

    expect(res.status).toBe(200)
    expect(json.name).toBe('Jane Doe')
    expect(json.score.totalRaw).toBe(17)
    expect(json.score.total100).toBe(85)

    const rows = await sql`select * from scores where candidate_id = ${json.id}`
    expect(rows).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the tests**

Run: `npx dotenv -e .env.local -- npm run test -- tests/integration/score-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/app/api/score/route.ts tests/integration/score-route.test.ts
git commit -m "feat: add /api/score orchestration route"
```

---

### Task 9: Candidate detail — API, page, components

**Files:**
- Create: `src/lib/candidates.ts`, `src/app/api/candidates/[id]/route.ts`, `src/app/candidate/[id]/page.tsx`
- Create: `src/components/ScoreRing.tsx`, `src/components/MetricBreakdown.tsx`, `src/components/StatusButtons.tsx`
- Test: `tests/unit/candidates.test.ts`, `tests/integration/candidates-route.test.ts`

**Interfaces:**
- Consumes: `CandidateWithScore`, `CandidateStatus` (Task 8), `sql` (Task 2).
- Produces:
  - `getCandidateWithScore(id: string): Promise<CandidateWithScore | null>`
  - `updateCandidateStatus(id: string, status: CandidateStatus): Promise<boolean>`
  Both consumed by Task 10's batch route/page for per-row detail links.

- [ ] **Step 1: Write the failing lib test**

Create `tests/unit/candidates.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { sql } from '@/lib/db'
import { getCandidateWithScore, updateCandidateStatus } from '@/lib/candidates'

describe('candidates lib', () => {
  let candidateId: string

  async function seed() {
    const [c] = await sql`
      insert into candidates (role, name, email, file_url, file_name, resume_text)
      values ('SPM', 'Alex Kim', 'alex@example.com', 'https://x/f.pdf', 'f.pdf', 'text')
      returning id
    `
    await sql`
      insert into scores (
        candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
        metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
        metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
      ) values (${c.id}, 4,'a',4,'b',4,'c',3,'d',2,'e',17,85,true,false)
    `
    return c.id as string
  }

  afterEach(async () => {
    if (candidateId) await sql`delete from candidates where id = ${candidateId}`
  })

  it('getCandidateWithScore returns the joined row', async () => {
    candidateId = await seed()
    const result = await getCandidateWithScore(candidateId)
    expect(result?.name).toBe('Alex Kim')
    expect(result?.score.total100).toBe(85)
    expect(result?.score.flagHiddenFit).toBe(true)
  })

  it('getCandidateWithScore returns null for a missing id', async () => {
    const result = await getCandidateWithScore('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('updateCandidateStatus updates and returns true', async () => {
    candidateId = await seed()
    const ok = await updateCandidateStatus(candidateId, 'accepted')
    expect(ok).toBe(true)
    const result = await getCandidateWithScore(candidateId)
    expect(result?.status).toBe('accepted')
  })

  it('updateCandidateStatus returns false for a missing id', async () => {
    const ok = await updateCandidateStatus('00000000-0000-0000-0000-000000000000', 'accepted')
    expect(ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/candidates.test.ts`
Expected: FAIL — `Cannot find module '@/lib/candidates'`.

- [ ] **Step 3: Implement the candidates lib**

Create `src/lib/candidates.ts`:
```typescript
import { sql } from '@/lib/db'
import type { CandidateWithScore, CandidateStatus } from '@/lib/types'

function mapRow(row: Record<string, unknown>): CandidateWithScore {
  return {
    id: row.id as string,
    role: row.role as CandidateWithScore['role'],
    name: row.name as string | null,
    email: row.email as string | null,
    status: row.status as CandidateStatus,
    fileUrl: row.file_url as string,
    fileName: row.file_name as string,
    batchId: row.batch_id as string | null,
    createdAt: row.created_at as string,
    score: {
      metric1Score: row.metric_1_score as number, metric1Rationale: row.metric_1_rationale as string,
      metric2Score: row.metric_2_score as number, metric2Rationale: row.metric_2_rationale as string,
      metric3Score: row.metric_3_score as number, metric3Rationale: row.metric_3_rationale as string,
      metric4Score: row.metric_4_score as number, metric4Rationale: row.metric_4_rationale as string,
      metric5Score: row.metric_5_score as number, metric5Rationale: row.metric_5_rationale as string,
      totalRaw: row.total_raw as number,
      total100: row.total_100 as number,
      flagHiddenFit: row.flag_hidden_fit as boolean,
      flagSpecShallow: row.flag_spec_shallow as boolean,
    },
  }
}

export async function getCandidateWithScore(id: string): Promise<CandidateWithScore | null> {
  const rows = await sql`
    select c.*, s.metric_1_score, s.metric_1_rationale, s.metric_2_score, s.metric_2_rationale,
           s.metric_3_score, s.metric_3_rationale, s.metric_4_score, s.metric_4_rationale,
           s.metric_5_score, s.metric_5_rationale, s.total_raw, s.total_100,
           s.flag_hidden_fit, s.flag_spec_shallow
    from candidates c
    join scores s on s.candidate_id = c.id
    where c.id = ${id}
  `
  return rows.length > 0 ? mapRow(rows[0]) : null
}

export async function updateCandidateStatus(id: string, status: CandidateStatus): Promise<boolean> {
  const rows = await sql`update candidates set status = ${status} where id = ${id} returning id`
  return rows.length > 0
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/candidates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing route test**

Create `tests/integration/candidates-route.test.ts`:
```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { GET, PATCH } from '@/app/api/candidates/[id]/route'

describe('/api/candidates/[id]', () => {
  let candidateId: string

  async function seed() {
    const [c] = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text)
      values ('PM', 'Sam Lee', 'https://x/f.pdf', 'f.pdf', 'text')
      returning id
    `
    await sql`
      insert into scores (
        candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
        metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
        metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
      ) values (${c.id}, 2,'a',2,'b',2,'c',2,'d',2,'e',10,50,false,false)
    `
    return c.id as string
  }

  afterEach(async () => {
    if (candidateId) await sql`delete from candidates where id = ${candidateId}`
  })

  it('GET returns 404 for a missing candidate', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/candidates/x'), {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.status).toBe(404)
  })

  it('GET returns the candidate with score', async () => {
    candidateId = await seed()
    const res = await GET(new NextRequest('http://localhost:3000/api/candidates/x'), {
      params: Promise.resolve({ id: candidateId }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.name).toBe('Sam Lee')
  })

  it('PATCH rejects an invalid status', async () => {
    candidateId = await seed()
    const req = new NextRequest('http://localhost:3000/api/candidates/x', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'maybe' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(400)
  })

  it('PATCH updates status to accepted', async () => {
    candidateId = await seed()
    const req = new NextRequest('http://localhost:3000/api/candidates/x', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Run test to verify it fails, then implement the route**

Run: `npx dotenv -e .env.local -- npm run test -- tests/integration/candidates-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/candidates/[id]/route'`.

Create `src/app/api/candidates/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCandidateWithScore, updateCandidateStatus } from '@/lib/candidates'
import type { CandidateStatus } from '@/lib/types'

const VALID_STATUSES: CandidateStatus[] = ['pending', 'accepted', 'rejected']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidateWithScore(id)
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  }
  return NextResponse.json(candidate)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = body?.status
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status as CandidateStatus)) {
    return NextResponse.json({ error: 'status must be one of pending, accepted, rejected.' }, { status: 400 })
  }
  const ok = await updateCandidateStatus(id, status as CandidateStatus)
  if (!ok) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, status })
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx dotenv -e .env.local -- npm run test -- tests/integration/candidates-route.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Build the detail page and its components**

Create `src/components/ScoreRing.tsx`:
```tsx
export function ScoreRing({ score }: { score: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? 'stroke-good' : score >= 50 ? 'stroke-warn' : 'stroke-danger'

  return (
    <div className="relative w-48 h-48">
      <svg className="w-48 h-48 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} strokeWidth="12" className="stroke-canvas" fill="none" />
        <circle
          cx="80" cy="80" r={radius} strokeWidth="12" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className={`${color} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold text-ink">{score}</span>
        <span className="text-subtle text-sm">/ 100</span>
      </div>
    </div>
  )
}
```

Create `src/components/MetricBreakdown.tsx`:
```tsx
import type { CandidateWithScore } from '@/lib/types'

const METRIC_LABELS = [
  'Ground-Level Domain Grounding',
  'Self-Initiated Ownership',
  'Decision Autonomy Track Record',
  'Role-Calibrated Product Craft',
  'Scale-Appropriate Experience',
]

export function MetricBreakdown({ score }: { score: CandidateWithScore['score'] }) {
  const metrics = [
    { label: METRIC_LABELS[0], value: score.metric1Score, rationale: score.metric1Rationale },
    { label: METRIC_LABELS[1], value: score.metric2Score, rationale: score.metric2Rationale },
    { label: METRIC_LABELS[2], value: score.metric3Score, rationale: score.metric3Rationale },
    { label: METRIC_LABELS[3], value: score.metric4Score, rationale: score.metric4Rationale },
    { label: METRIC_LABELS[4], value: score.metric5Score, rationale: score.metric5Rationale },
  ]

  return (
    <div className="space-y-4">
      {metrics.map((m) => (
        <div key={m.label} className="bg-surface shadow-soft rounded-xl2 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-ink">{m.label}</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((pip) => (
                <span key={pip} className={`w-3 h-3 rounded-full ${pip <= m.value ? 'bg-accent' : 'bg-canvas'}`} />
              ))}
            </div>
          </div>
          <p className="text-subtle text-sm">{m.rationale}</p>
        </div>
      ))}
    </div>
  )
}
```

Create `src/components/StatusButtons.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { CandidateStatus } from '@/lib/types'

export function StatusButtons({ candidateId, initialStatus }: { candidateId: string; initialStatus: CandidateStatus }) {
  const [status, setStatus] = useState<CandidateStatus>(initialStatus)
  const [pending, setPending] = useState(false)

  async function updateStatus(next: CandidateStatus) {
    setPending(true)
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setPending(false)
    if (res.ok) setStatus(next)
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => updateStatus('accepted')}
        disabled={pending}
        className={`px-5 py-2 rounded-lg font-medium transition ${status === 'accepted' ? 'bg-good text-white' : 'bg-canvas text-ink hover:bg-good/10'}`}
      >
        Accept
      </button>
      <button
        onClick={() => updateStatus('rejected')}
        disabled={pending}
        className={`px-5 py-2 rounded-lg font-medium transition ${status === 'rejected' ? 'bg-danger text-white' : 'bg-canvas text-ink hover:bg-danger/10'}`}
      >
        Reject
      </button>
    </div>
  )
}
```

Create `src/app/candidate/[id]/page.tsx`:
```tsx
import { notFound } from 'next/navigation'
import { getCandidateWithScore } from '@/lib/candidates'
import { ScoreRing } from '@/components/ScoreRing'
import { MetricBreakdown } from '@/components/MetricBreakdown'
import { StatusButtons } from '@/components/StatusButtons'

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidateWithScore(id)
  if (!candidate) notFound()

  return (
    <main className="min-h-screen bg-canvas p-8 max-w-3xl mx-auto">
      <div className="bg-surface shadow-soft rounded-xl2 p-8 mb-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-ink mb-1">{candidate.name || 'Unnamed Candidate'}</h1>
        <p className="text-subtle mb-6">{candidate.role === 'PM' ? 'Product Manager' : 'Senior Product Manager'}</p>
        <ScoreRing score={candidate.score.total100} />
        <div className="mt-6">
          <StatusButtons candidateId={candidate.id} initialStatus={candidate.status} />
        </div>
        {(candidate.score.flagHiddenFit || candidate.score.flagSpecShallow) && (
          <div className="mt-6 flex gap-2">
            {candidate.score.flagHiddenFit && (
              <span className="bg-good/10 text-good text-xs font-medium px-3 py-1 rounded-full">Hidden Fit</span>
            )}
            {candidate.score.flagSpecShallow && (
              <span className="bg-warn/10 text-warn text-xs font-medium px-3 py-1 rounded-full">Spec-Matched but Shallow</span>
            )}
          </div>
        )}
      </div>
      <MetricBreakdown score={candidate.score} />
    </main>
  )
}
```

- [ ] **Step 9: Manual verification**

Run `npm run dev`, log in, then visit `/candidate/<an id from Step 4/5's leftover test data or a real /api/score call>` — confirm the ring, metric pips, rationale text, flag badges, and Accept/Reject buttons render and that clicking Accept/Reject persists (reload the page and confirm the button stays highlighted).

- [ ] **Step 10: Commit**

```bash
git add src/lib/candidates.ts src/app/api/candidates src/app/candidate src/components/ScoreRing.tsx src/components/MetricBreakdown.tsx src/components/StatusButtons.tsx tests/unit/candidates.test.ts tests/integration/candidates-route.test.ts
git commit -m "feat: add candidate detail API, page, and score components"
```

---

### Task 10: Batch ranked table — API, page, component

**Files:**
- Modify: `src/lib/candidates.ts` (add `getBatchCandidates`), `tests/unit/candidates.test.ts` (add tests)
- Create: `src/app/api/batch/[batchId]/route.ts`, `src/app/batch/[batchId]/page.tsx`, `src/components/BatchTable.tsx`
- Test: `tests/integration/batch-route.test.ts`

**Interfaces:**
- Consumes: `CandidateWithScore` (Task 8), `sql` (Task 2), the `mapRow` helper already in `src/lib/candidates.ts` (Task 9).
- Produces: `getBatchCandidates(batchId: string): Promise<{ pm: CandidateWithScore[]; spm: CandidateWithScore[] }>`, sorted `total100` descending within each pool, consumed by Task 11's post-batch-upload redirect.

- [ ] **Step 1: Write the failing test for the lib function**

Append to `tests/unit/candidates.test.ts` (inside the existing top-level `describe('candidates lib', ...)` block, alongside the existing `it`s):
```typescript
  it('getBatchCandidates groups by role and sorts by total100 desc', async () => {
    const batchId = crypto.randomUUID()
    const seedOne = async (role: 'PM' | 'SPM', name: string, total100: number) => {
      const raw = total100 / 5
      const [c] = await sql`
        insert into candidates (role, name, file_url, file_name, resume_text, batch_id)
        values (${role}, ${name}, 'https://x/f.pdf', 'f.pdf', 'text', ${batchId})
        returning id
      `
      await sql`
        insert into scores (
          candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
          metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
          metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
        ) values (${c.id}, 2,'a',2,'b',2,'c',2,'d',2,'e',${raw},${total100},false,false)
      `
      return c.id as string
    }

    const id1 = await seedOne('PM', 'Low PM', 40)
    const id2 = await seedOne('PM', 'High PM', 80)
    const id3 = await seedOne('SPM', 'Only SPM', 60)

    const { pm, spm } = await getBatchCandidates(batchId)
    expect(pm.map((c) => c.name)).toEqual(['High PM', 'Low PM'])
    expect(spm.map((c) => c.name)).toEqual(['Only SPM'])

    await sql`delete from candidates where id in (${id1}, ${id2}, ${id3})`
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/candidates.test.ts`
Expected: FAIL — `getBatchCandidates is not a function`.

- [ ] **Step 3: Implement `getBatchCandidates`**

Append to `src/lib/candidates.ts`:
```typescript
export async function getBatchCandidates(
  batchId: string
): Promise<{ pm: CandidateWithScore[]; spm: CandidateWithScore[] }> {
  const rows = await sql`
    select c.*, s.metric_1_score, s.metric_1_rationale, s.metric_2_score, s.metric_2_rationale,
           s.metric_3_score, s.metric_3_rationale, s.metric_4_score, s.metric_4_rationale,
           s.metric_5_score, s.metric_5_rationale, s.total_raw, s.total_100,
           s.flag_hidden_fit, s.flag_spec_shallow
    from candidates c
    join scores s on s.candidate_id = c.id
    where c.batch_id = ${batchId}
    order by s.total_100 desc
  `
  const all = rows.map(mapRow)
  return {
    pm: all.filter((c) => c.role === 'PM'),
    spm: all.filter((c) => c.role === 'SPM'),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx dotenv -e .env.local -- npm run test -- tests/unit/candidates.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing route test**

Create `tests/integration/batch-route.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { GET } from '@/app/api/batch/[batchId]/route'

describe('GET /api/batch/[batchId]', () => {
  it('returns empty pm/spm arrays for an unknown batch', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/batch/x'), {
      params: Promise.resolve({ batchId: crypto.randomUUID() }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ pm: [], spm: [] })
  })

  it('returns seeded candidates grouped by role', async () => {
    const batchId = crypto.randomUUID()
    const [c] = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text, batch_id)
      values ('PM', 'Test Candidate', 'https://x/f.pdf', 'f.pdf', 'text', ${batchId})
      returning id
    `
    await sql`
      insert into scores (
        candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
        metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
        metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
      ) values (${c.id}, 2,'a',2,'b',2,'c',2,'d',2,'e',10,50,false,false)
    `
    const res = await GET(new NextRequest('http://localhost:3000/api/batch/x'), {
      params: Promise.resolve({ batchId }),
    })
    const json = await res.json()
    expect(json.pm).toHaveLength(1)
    expect(json.spm).toHaveLength(0)

    await sql`delete from candidates where id = ${c.id}`
  })
})
```

- [ ] **Step 6: Run test to verify it fails, then implement the route**

Run: `npx dotenv -e .env.local -- npm run test -- tests/integration/batch-route.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/batch/[batchId]/route'`.

Create `src/app/api/batch/[batchId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getBatchCandidates } from '@/lib/candidates'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const result = await getBatchCandidates(batchId)
  return NextResponse.json(result)
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx dotenv -e .env.local -- npm run test -- tests/integration/batch-route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Build the batch page and table component**

Create `src/components/BatchTable.tsx`:
```tsx
import Link from 'next/link'
import type { CandidateWithScore } from '@/lib/types'

function Pool({ title, candidates }: { title: string; candidates: CandidateWithScore[] }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-ink mb-3">{title} ({candidates.length})</h2>
      <div className="bg-surface shadow-soft rounded-xl2 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-subtle text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Metrics</th>
              <th className="px-4 py-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr key={c.id} className="border-t border-canvas hover:bg-canvas/50">
                <td className="px-4 py-3 text-subtle">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/candidate/${c.id}`} className="text-accent font-medium hover:underline">
                    {c.name || 'Unnamed Candidate'}
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-ink">{c.score.total100}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[c.score.metric1Score, c.score.metric2Score, c.score.metric3Score, c.score.metric4Score, c.score.metric5Score].map((v, idx) => (
                      <span key={idx} className="w-5 h-2 rounded-full bg-canvas relative overflow-hidden block">
                        <span className="absolute inset-y-0 left-0 bg-accent block" style={{ width: `${(v / 4) * 100}%` }} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.score.flagHiddenFit && <span className="text-good text-xs font-medium mr-2">Hidden Fit</span>}
                  {c.score.flagSpecShallow && <span className="text-warn text-xs font-medium">Spec-Shallow</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BatchTable({ pm, spm }: { pm: CandidateWithScore[]; spm: CandidateWithScore[] }) {
  return (
    <>
      <Pool title="Product Manager" candidates={pm} />
      <Pool title="Senior Product Manager" candidates={spm} />
    </>
  )
}
```

Create `src/app/batch/[batchId]/page.tsx`:
```tsx
import { getBatchCandidates } from '@/lib/candidates'
import { BatchTable } from '@/components/BatchTable'

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const { pm, spm } = await getBatchCandidates(batchId)

  return (
    <main className="min-h-screen bg-canvas p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink mb-6">Batch Results</h1>
      <BatchTable pm={pm} spm={spm} />
    </main>
  )
}
```

- [ ] **Step 9: Manual verification**

Run `npm run dev`, log in, visit `/batch/<a batch id from a test run or later real uploads>` — confirm both pools render, sorted descending, with clickable names linking to `/candidate/[id]`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/candidates.ts src/app/api/batch src/app/batch src/components/BatchTable.tsx tests/unit/candidates.test.ts tests/integration/batch-route.test.ts
git commit -m "feat: add batch ranked table API, page, and component"
```

---

### Task 11: Upload page (role toggle, drag-and-drop, concurrency-capped scoring)

**Files:**
- Create: `src/lib/concurrency.ts`, `src/components/RoleToggle.tsx`, `src/components/UploadForm.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/unit/concurrency.test.ts`

**Interfaces:**
- Consumes: `Role` (Task 5), `POST /api/blob-token` (Task 7), `POST /api/score` (Task 8).
- Produces: `runWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]>` — order-preserving, capped-concurrency runner, general-purpose but only used here.

- [ ] **Step 1: Write the failing concurrency test**

Create `tests/unit/concurrency.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { runWithConcurrency } from '@/lib/concurrency'

describe('runWithConcurrency', () => {
  it('preserves result order even when later items resolve first', async () => {
    const items = [30, 10, 20]
    const results = await runWithConcurrency(
      items, 3,
      (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms))
    )
    expect(results).toEqual([30, 10, 20])
  })

  it('never runs more than `limit` workers concurrently', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 10 }, (_, i) => i)
    await runWithConcurrency(items, 3, async (i) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return i
    })
    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('handles an empty array', async () => {
    const results = await runWithConcurrency([], 5, async (x: number) => x)
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/concurrency.test.ts`
Expected: FAIL — `Cannot find module '@/lib/concurrency'`.

- [ ] **Step 3: Implement**

Create `src/lib/concurrency.ts`:
```typescript
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function runNext(): Promise<void> {
    const current = nextIndex++
    if (current >= items.length) return
    results[current] = await worker(items[current], current)
    await runNext()
  }

  const workerCount = Math.min(limit, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runNext()))
  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/concurrency.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Build the role toggle**

Create `src/components/RoleToggle.tsx`:
```tsx
'use client'

import type { Role } from '@/lib/rubric'

export function RoleToggle({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div className="inline-flex bg-canvas rounded-lg p-1">
      {(['PM', 'SPM'] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            role === r ? 'bg-surface shadow-soft text-ink' : 'text-subtle'
          }`}
        >
          {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Build the upload form**

Create `src/components/UploadForm.tsx`:
```tsx
'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { upload } from '@vercel/blob/client'
import { RoleToggle } from '@/components/RoleToggle'
import { runWithConcurrency } from '@/lib/concurrency'
import type { Role } from '@/lib/rubric'

type FileStatus = {
  file: File
  state: 'pending' | 'uploading' | 'scoring' | 'done' | 'error'
  error?: string
  candidateId?: string
}

const CONCURRENCY = 5

export function UploadForm() {
  const [role, setRole] = useState<Role>('PM')
  const [files, setFiles] = useState<FileStatus[]>([])
  const [running, setRunning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const batchIdRef = useRef<string | undefined>(undefined)
  const router = useRouter()

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles(Array.from(list).map((file) => ({ file, state: 'pending' })))
  }

  async function scoreOne(entry: FileStatus, batchId: string | undefined): Promise<FileStatus> {
    try {
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'uploading' } : f)))
      const blob = await upload(entry.file.name, entry.file, {
        access: 'public',
        handleUploadUrl: '/api/blob-token',
      })
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'scoring' } : f)))
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ blobUrl: blob.url, fileName: entry.file.name, role, batchId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const failed: FileStatus = { ...entry, state: 'error', error: body.error || 'Scoring failed.' }
        setFiles((prev) => prev.map((f) => (f.file === entry.file ? failed : f)))
        return failed
      }
      const json = await res.json()
      const done: FileStatus = { ...entry, state: 'done', candidateId: json.id }
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? done : f)))
      return done
    } catch {
      const failed: FileStatus = { ...entry, state: 'error', error: 'Upload failed.' }
      setFiles((prev) => prev.map((f) => (f.file === entry.file ? failed : f)))
      return failed
    }
  }

  async function retryOne(entry: FileStatus) {
    setFiles((prev) => prev.map((f) => (f.file === entry.file ? { ...f, state: 'pending', error: undefined } : f)))
    await scoreOne(entry, batchIdRef.current)
  }

  async function handleStart() {
    if (files.length === 0) return
    setRunning(true)
    batchIdRef.current = files.length > 1 ? crypto.randomUUID() : undefined
    const results = await runWithConcurrency(files, CONCURRENCY, (entry) => scoreOne(entry, batchIdRef.current))
    setRunning(false)

    const allDone = results.every((r) => r.state === 'done')
    if (files.length === 1 && allDone) {
      router.push(`/candidate/${results[0].candidateId}`)
    } else if (files.length > 1 && batchIdRef.current) {
      router.push(`/batch/${batchIdRef.current}`)
    }
  }

  const doneCount = files.filter((f) => f.state === 'done').length

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex justify-center">
        <RoleToggle role={role} onChange={setRole} />
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl2 p-12 text-center cursor-pointer bg-surface hover:border-accent transition"
      >
        <p className="text-ink font-medium mb-1">Drop resumes here or click to upload</p>
        <p className="text-subtle text-sm">PDF or DOCX, one or many</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((f) => (
            <div key={f.file.name} className="flex items-center justify-between bg-surface shadow-soft rounded-lg px-4 py-3 text-sm">
              <span className="text-ink">{f.file.name}</span>
              {f.state === 'error' ? (
                <button onClick={() => retryOne(f)} className="text-danger font-medium">
                  {f.error} · Retry
                </button>
              ) : (
                <span className="text-subtle capitalize">{f.state}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <button
          onClick={handleStart}
          disabled={running}
          className="mt-6 w-full bg-accent text-white rounded-lg py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {running ? `Scoring ${doneCount}/${files.length}…` : `Score ${files.length} resume${files.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Wire up the home page**

Replace the contents of `src/app/page.tsx`:
```tsx
import { UploadForm } from '@/components/UploadForm'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas py-16 px-4">
      <h1 className="text-3xl font-semibold text-ink text-center mb-2">PM / SPM Resume Screener</h1>
      <p className="text-subtle text-center mb-10">Score candidates against Kargo&apos;s shortlisting rubric.</p>
      <UploadForm />
    </main>
  )
}
```

- [ ] **Step 8: Manual verification in the browser**

Run `npm run dev`, log in, then verify all of:
1. **Single-file happy path:** upload one real PDF resume with the PM role selected — confirm it redirects to `/candidate/[id]` with a populated report.
2. **Batch happy path:** upload 3+ files at once — confirm the per-file progress list updates, then redirect to `/batch/[batchId]` shows all of them ranked.
3. **Rejected file type:** try uploading a `.txt` file — confirm it surfaces a per-file error instead of crashing the page.
4. **Retry:** temporarily break `GEMINI_API_KEY` (or use a scanned/image-only PDF) to force a per-file error, confirm the Retry button re-attempts just that file without disturbing the others.

- [ ] **Step 9: Commit**

```bash
git add src/lib/concurrency.ts src/components/RoleToggle.tsx src/components/UploadForm.tsx src/app/page.tsx tests/unit/concurrency.test.ts
git commit -m "feat: add upload page with role toggle and concurrency-capped batch scoring"
```

---

### Task 12: Page metadata, GitHub repo, and Vercel deployment

**Files:**
- Modify: `src/app/layout.tsx` (page metadata)
- Create: `.env.example`, `README.md`

**Interfaces:**
- Consumes: everything built in Tasks 1-11.
- Produces: a pushed GitHub repo and a live Vercel deployment — the final deliverable.

- [ ] **Step 1: Set real page metadata**

In `src/app/layout.tsx`, replace the `metadata` export (from create-next-app's default) with:
```typescript
export const metadata: Metadata = {
  title: 'PM / SPM Resume Screener',
  description: "Score PM and Senior PM resumes against Kargo's shortlisting rubric.",
}
```

- [ ] **Step 2: Add `.env.example` (no real values)**

Create `.env.example`:
```
GEMINI_API_KEY=
DATABASE_URL=
BLOB_READ_WRITE_TOKEN=
APP_PASSWORD=
SESSION_SECRET=
```

- [ ] **Step 3: Add a README**

Create `README.md`:
```markdown
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
```

- [ ] **Step 4: Commit the polish**

```bash
git add src/app/layout.tsx .env.example README.md
git commit -m "chore: add metadata, .env.example, and README"
```

- [ ] **Step 5: Create the GitHub repo and push**

Run:
```bash
gh repo create kargo-pm-ats-screener --private --source=. --remote=origin --push
```
Expected: prints the new repo URL (`https://github.com/raahulpaatil/kargo-pm-ats-screener`) and pushes all commits made so far (spec, plan, and every task's commits).

- [ ] **Step 6: Connect the repo to Vercel (manual, human partner does this)**

Tell the user:
> "Repo is live at `<url from Step 5>`. To deploy: go to vercel.com/new, import this repo, and before the first deploy add these environment variables in the Vercel project settings (Settings → Environment Variables): `GEMINI_API_KEY`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `APP_PASSWORD`, `SESSION_SECRET` — using the same values from your local `.env.local`. Once set, trigger the deploy. Every future push to `main` will auto-deploy."

- [ ] **Step 7: Verify the deployment**

Once the user confirms the Vercel deploy succeeded and shares the URL, visit it, confirm the login gate appears, log in with `APP_PASSWORD`, and re-run the Step 8 manual checks from Task 11 (single upload, batch upload, rejected file type, retry) against the live deployment.

