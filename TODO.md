# MindPlan — TODO

Tasks identified from batch quality testing 73 real client files (2026-02-23).

## High Priority

### ~~1. Strengthen Professional Relationship Extraction~~ — Won't Fix
**Problem:** 30% of dual-client files (15/50) produce zero professional relationships.

**Investigation (2026-02-24):** Checked all 15 source `.docx` files — none contain actual professional relationship data (no named accountants, solicitors, doctors, brokers). All keyword matches were boilerplate (preparing adviser header, insurance product references, client occupations). **This is a data limitation, not a parser bug.**

## Medium Priority

### 2. Income/Super Cross-Validation
**Problem:** 7 files have income but no super, or super but no income. In Australia, virtually all employed people have super.

**Action:**
- [x] In `server/src/services/validator.ts` (`enrichGaps`), add: if client has income > 0 but superBalance is null, auto-flag a gap
- [x] Similarly: if superBalance > 0 but income is null, flag it
- [ ] Re-run batch test to check new gap counts

**Files affected:** TEST (16), (26), (27), (29), (42), (48), (53)

### 3. Summary Bar "Incomplete Data" Warning
**Problem:** TEST (30) has 57% unvalued assets, TEST (64) has 64%. The summary bar charts are misleading when many assets have no value.

**Action:**
- [x] In the `SummaryBar` component, compute % of assets without values
- [x] If >30%, show a warning badge: "Asset totals are approximate — X assets have no value"
- [x] Style it amber to match the existing gap-count warning aesthetic

## Low Priority

### 4. Spot-Check Zero-Family Files
**Problem:** 32/73 files (44%) have zero family members. Most are genuinely thin documents, but some longer files (8,000+ chars) might have children mentioned that the parser missed.

**Action:**
- [ ] Manually review 3-4 longer zero-family files from `test/batch-data.json`
- [ ] If parser misses are found, adjust the prompt in `parseFinancialPlan.ts`

### 5. Occupation/Risk Profile Extraction Gaps
**Problem:** ~16% of files each are missing occupation and risk profile, including some longer documents (e.g. TEST 28 at 10k chars).

**Action:**
- [ ] Spot-check TEST (28) and a few other longer files to see if occupation data exists in the document
- [ ] If found, adjust prompt to better target these fields

## Completed

- [x] Batch test harness (`test/batch-test.ts`) — 73/73 files pass
- [x] Drag-to-create child nodes
- [x] Editable detail panel fields (name, type dropdowns, toggles)
- [x] Flowable PDF pages (estate/family/goals/relationships share pages)
- [x] Gap nodeId validation (reject placeholder IDs from Claude)
- [x] Insights abort controller
- [x] LLM provider abstraction (Anthropic/MLX/Ollama)
