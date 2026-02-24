# MindPlan Batch Quality Test Report

**Date:** 2026-02-23
**Files tested:** 73 real client `.docx` fact-find files
**Test harness:** `test/batch-test.ts`

---

## Headline Numbers

| Metric | Result |
|--------|--------|
| **Success rate** | **73/73 (100%)** |
| **Parse failures** | 0 |
| **Duplicate IDs** | 0 |
| **Empty names** | 0 |
| **Validation warnings** | 0 |
| **Avg parse time** | 46.7s (min 10.6s, max 164.1s) |

## Completeness Rates (across 123 clients in 73 files)

| Field | Extracted | Rate |
|-------|-----------|------|
| Client age | 118/123 | **96%** |
| Client super | 108/123 | **88%** |
| Client risk profile | 105/123 | **85%** |
| Client income | 103/123 | **84%** |
| Client occupation | 99/123 | **80%** |
| Asset values | 950/987 | **96%** |
| Liability amounts | 90/90 | **100%** |

## Averages Per File

| | Avg | Range |
|--|-----|-------|
| Clients | 1.7 | 1–2 |
| Entities (trusts/SMSFs/companies) | 1.5 | 0–9 |
| Total assets | 13.5 | 1–52 |
| Total liabilities | 1.2 | 0–5 |
| Estate planning items | 7.2 | 0–12 |
| Family members | 1.2 | 0–5 |
| Goals | 6.6 | 0–16 |
| Relationships | 0.8 | 0–4 |
| Data gaps flagged | 14.8 | 7–27 |

## Text Length vs Data Richness

**Correlation: r = 0.91 (very strong).** Longer documents consistently produce richer structured output.

| Quartile | Avg Text | Avg Items Extracted | Avg Asset Value |
|----------|----------|--------------------:|----------------:|
| Q1 (shortest) | 5,080 chars | 15 | $3.0M |
| Q2 | 7,631 chars | 26 | $5.5M |
| Q3 | 9,173 chars | 36 | $11.8M |
| Q4 (longest) | 11,168 chars | 47 | $11.7M |

---

## Quality Issues — Prioritised

### ~~1. Missing Relationships for Dual-Client Files~~ — Won't Fix

**15 of 50 dual-client files (30%) produce zero professional relationships.**

**Investigation (2026-02-24):** Extracted text from all 15 source `.docx` files and searched for relationship keywords (accountant, solicitor, lawyer, doctor, broker, etc.). **None of the 15 files contain actual professional relationship data.** All keyword matches were false positives: boilerplate "Financial Adviser" headers, insurance product references, and client occupations. This is a data limitation in the source documents, not a parser/prompt issue.

### 2. Income/Super Asymmetry (MEDIUM)

- 3 files have income but zero super for any client
- 4 files have super but zero income for any client

In Australia, virtually all employed people have superannuation.

**Affected files:** TEST (16), (26), (27), (29), (42), (48), (53)

**Action:** Add post-parse validation in `enrichGaps()`: if client has income > 0 but super is null, auto-flag a gap (and vice versa).

### 3. High % of Unvalued Assets in Some Files (MEDIUM)

| File | Missing | Total Assets | % Missing |
|------|---------|-------------|-----------|
| TEST (30) | 8 | 14 | 57% |
| TEST (64) | 7 | 11 | 64% |
| TEST (23) | 5 | 19 | 26% |
| TEST (25) | 3 | 12 | 25% |
| TEST (50) | 3 | 10 | 30% |

**Action:** Show a warning in the summary bar when >30% of assets are unvalued.

### 4. 49% of Files Have Zero Entities (LOW — correct behaviour)

36 of 73 files have no trusts, SMSFs, or companies. This is real data variance — about half the client base has simple personal-only structures. No action needed.

### 5. 44% of Files Have Zero Family Members (LOW)

32/73 files extract no children/grandchildren. Most are thin documents, but some longer files (8,000+ chars) also have zero family.

**Action:** Spot-check 3-4 longer zero-family files to confirm no parser misses.

### 6. 5 Near-Empty Template Files (LOW)

Files TEST (5), (7), (46), (51), (63) are essentially blank templates (~3,200 chars, 1 asset at $1). The parser correctly generates 12-15 data gaps for each. No action needed.

### 7. Occupation/Risk Profile Missing in ~16% (LOW)

12 files each are missing occupation and risk profile, including some longer documents (e.g. TEST 28 at 10k chars).

**Action:** Spot-check a few longer files to see if the data exists in the document but the parser isn't finding it.

---

## Distributions

### Entity Count
| Entities | Files |
|----------|-------|
| 0 | 36 (49.3%) |
| 1 | 14 (19.2%) |
| 2 | 5 (6.8%) |
| 3 | 5 (6.8%) |
| 4 | 4 (5.5%) |
| 5+ | 9 (12.3%) |

### Family Member Count
| Members | Files |
|---------|-------|
| 0 | 32 (43.8%) |
| 1 | 12 (16.4%) |
| 2 | 16 (21.9%) |
| 3 | 8 (11.0%) |
| 4 | 3 (4.1%) |
| 5+ | 2 (2.7%) |

### Gap Count by Client Type
| Client Type | Files | Avg Gaps |
|-------------|-------|----------|
| Single-client | 23 | 12.3 |
| Dual-client | 50 | 15.9 |

## Leaderboards

**Top 5 by Entity Count:** TEST (59)=9, TEST (28)=7, Dorothy_Smith=6, TEST (2)=6, TEST (61)=6

**Top 5 by Asset Count:** TEST (3)=52, TEST (59)=33, TEST (32)=30, TEST (28)=28, TEST (55)=28

**Top 5 by Goal Count:** TEST (66)=16, TEST (67)=16, TEST (57)=15, TEST (24)=13, TEST (48)=13

**Top 5 by Gap Count:** TEST (60)=27, TEST (61)=24, TEST (6)=23, TEST (2)=22, TEST (64)=22

---

## Data Files

- `test/batch-results.json` — per-file metrics (no raw data)
- `test/batch-data.json` — full parsed JSON for all 73 files
- `test/batch-test.ts` — test harness source

## Re-running

```bash
npm run dev                    # start server
npx tsx test/batch-test.ts     # run all 73 files (~35-45 min)
```
