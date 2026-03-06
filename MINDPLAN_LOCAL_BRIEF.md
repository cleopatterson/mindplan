# MindPlan Local — Implementation Brief

## Mission

Build a **fully offline, code-driven parser** for Plutosoft fact-find `.docx` files that outputs the exact same `FinancialPlan` JSON the existing React frontend expects. No cloud API calls. No IT approval needed. Gemma 3 12B used only for an optional insights/gap-detection layer on top of the code-extracted data.

This is "v2" — a local companion product alongside the existing Claude-powered cloud version. The client-side React app, ReactFlow mind map, PDF export, and all frontend code remain unchanged. Only the **server-side parsing pipeline** is replaced.

---

## Why Code-Driven (Not LLM-Driven)

We tested Gemma 3 12B against Claude Sonnet on 73 real client files:

| Metric | Gemma 12B | Claude Sonnet |
|--------|-----------|---------------|
| Clients | 10/10 | 10/10 |
| Entities | 9/10 | 10/10 |
| Personal assets | **1/10** | 10/10 |
| Entity assets | **4/10** (often 0 vs 46) | 10/10 |
| Goals | **2/10** | 10/10 |
| Estate planning | **2/10** | 10/10 |
| Overall match | **56%** | baseline |

The LLM can identify structures but cannot reliably assign assets to entities or extract nuanced data. However, **the source documents are highly structured Plutosoft templates** — all data lives in predictable tables that can be parsed with code at near-100% accuracy.

---

## Source Document Analysis (73 files)

All files come from **Plutosoft** financial planning software and follow a consistent table-based template:

### Document Structure

| Table Type | Header Pattern | Present In | Content |
|-----------|---------------|-----------|---------|
| Metadata | `Type of Advice \| Limited Advice` | 73/73 | Advice type, prepared for/by, date |
| Firm details | `Nexia Perth \| Nexia Perth Financial...` | 73/73 | Firm address, ABN, AFSL |
| Client details (couple) | `Description \| Client \| Partner` | 50/73 | Full name, DOB, age, occupation, income per client |
| Client details (single) | `Description \| Client` | 23/73 | Same but single column |
| Dependants | `Dependant \| Type \| Date of birth \| Dependant until` | 36/73 | Children who are financial dependants |
| Children (alt format) | `Adult Children \| Income \| Employment \| Grandkids` | 1/73 | Rare alternate format |
| Relationships | `From \| Relationship \| To \| Notes` | 19/73 | Professional advisers |
| Goals | `Goal \| Detail \| Timeframe` | 65/73 | Structured goals with categories |
| Income | `Description \| Owner \| Amount` | 62/73 | Income sources per owner |
| Entities | `Description \| Type \| Directors/trustees \| Shareholders/beneficiaries` | 37/73 | Trusts, SMSFs, companies |
| Entity assets | `Description \| Type \| Amount` (with entity name header rows) | 36/73 | Assets grouped under entity names |
| Personal assets (multiple) | `Description \| Owner \| Details \| Amount` | 73/73 | ~6 tables per file covering lifestyle, bank, investment property, super, pension, shares |
| Expenses | `Description \| Owner \| Details \| Amount` (with "living expense" content) | varies | Regular expenses |
| Insurance | `Policy \| Life insured \| Policy owner \| Features \| Cover amount` | 40/73 | Insurance policies |
| Super nominations | `Superannuation/pension fund \| Owner \| Nomination type \| Beneficiaries` | 64/73 | Binding/non-binding death benefit nominations |
| Estate planning | `Description \| [ClientFirstName] \| [PartnerFirstName]` | 73/73 | Will, EPA, EPG status per client — **client names ARE the column headers** |
| Signature | `[signature_c]` or `[signature_c] \| [signature_p]` | 73/73 | Signature block |

### Critical Design Insight

**Tables are NOT identified by position** (table count varies from 6 to 20). They are identified by **header row pattern**:

1. First cell is almost always `"Description"` or a known keyword (`"Goal"`, `"Policy"`, `"Dependant"`)
2. Second+ cells distinguish the table type (`"Owner"`, `"Client"`, `"Type"`, first names, etc.)
3. Entity assets use a SINGLE table with **entity name rows as section dividers** (colspan or bold row with just the entity name, followed by asset rows, then a "Total" row)
4. Personal asset tables are distinguished by their **content** (address = property, "everyday cash" = cash, "accumulation" = super, etc.)

---

## Target Output Schema

The parser must produce a `FinancialPlan` object matching this exact TypeScript interface (used by the existing React frontend):

```typescript
interface FinancialPlan {
  clients: Client[];
  entities: Entity[];
  personalAssets: Asset[];
  personalLiabilities: Liability[];
  estatePlanning: EstatePlanItem[];
  familyMembers: FamilyMember[];
  objectives: string[];
  goals: Goal[];
  relationships: Relationship[];
  dataGaps: DataGap[];
  familyLabel?: string;
}
```

### Full Type Definitions

```typescript
interface Client {
  id: string;          // "client-1", "client-2"
  name: string;
  age: number | null;
  occupation: string | null;
  income: number | null;       // Annual AUD
  superBalance: number | null; // AUD
  riskProfile: 'conservative' | 'moderately_conservative' | 'balanced' | 'growth' | 'high_growth' | null;
}

interface Entity {
  id: string;          // "entity-1", "entity-2"
  name: string;        // "Wall Family Trust"
  type: 'trust' | 'smsf' | 'company' | 'partnership';
  linkedClientIds: string[];   // Client IDs as trustees/directors/beneficiaries
  role: string | null;
  trusteeName: string | null;  // "Tony Wall" or "Smith Corp Pty Ltd"
  trusteeType: 'individual' | 'corporate' | null;
  assets: Asset[];             // Assets belonging to this entity
  liabilities: Liability[];    // Liabilities belonging to this entity
}

interface Asset {
  id: string;          // "asset-1", "asset-2" (globally unique across personal + entity)
  name: string;        // "123 Smith St, Bondi"
  type: 'property' | 'shares' | 'cash' | 'managed_fund' | 'super' | 'pension' | 'insurance' | 'vehicle' | 'other';
  value: number | null;        // AUD, null if unknown
  ownerIds: string[];          // Client IDs. Personal: ["client-1"]. Joint: ["client-1","client-2"]. Entity assets: []
  details: string | null;
}

interface Liability {
  id: string;
  name: string;
  type: 'mortgage' | 'loan' | 'credit_card' | 'other';
  amount: number | null;       // Outstanding balance AUD
  interestRate: number | null; // Annual % rate
  ownerIds: string[];          // Same rules as Asset.ownerIds
  details: string | null;
}

interface EstatePlanItem {
  id: string;          // "estate-1"
  clientId: string;    // Links to Client.id
  type: 'will' | 'poa' | 'guardianship' | 'super_nomination';
  status: 'current' | 'expired' | 'not_established' | null;
  lastReviewed: number | null; // Year, e.g. 2021
  primaryPerson: string | null;     // Executor, attorney, or guardian name
  alternatePeople: string[] | null;
  details: string | null;
  hasIssue: boolean;   // True if expired, not_established, or missing key info
}

interface FamilyMember {
  id: string;          // "family-1"
  name: string;
  relationship: 'son' | 'daughter' | 'other';
  partner: string | null;
  age: number | null;
  isDependant: boolean;
  details: string | null;
  children: Grandchild[];  // Grandchildren nested under their parent
}

interface Grandchild {
  id: string;          // "grandchild-1"
  name: string;
  relationship: 'grandson' | 'granddaughter';
  age: number | null;
  isDependant: boolean;
  details: string | null;
}

interface Goal {
  id: string;          // "goal-1"
  name: string;        // "Comfortable lifestyle in retirement"
  category: 'retirement' | 'wealth' | 'protection' | 'estate' | 'lifestyle' | 'education' | 'other';
  detail: string | null;
  timeframe: string | null;   // "Ongoing", "Now", "5 years"
  value: number | null;       // Target dollar value
}

interface Relationship {
  id: string;          // "rel-1"
  clientIds: string[]; // Client IDs this adviser is linked to
  type: 'accountant' | 'stockbroker' | 'solicitor' | 'insurance_adviser' | 'mortgage_broker' | 'financial_adviser' | 'other';
  firmName: string | null;
  contactName: string | null;
  notes: string | null;
}

interface DataGap {
  entityId: string | null;  // null for personal gaps
  field: string;
  description: string;
  nodeId?: string;          // Graph node ID for precise targeting
}
```

---

## Architecture: Code Parser + Gemma Insights

### Pipeline Overview

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  .docx file │ ──▶ │  Table Extractor  │ ──▶ │  Code Parser     │ ──▶ │  Gemma Insights  │
│  (Plutosoft) │     │  (python-docx)   │     │  (table→JSON)    │     │  (optional)      │
└─────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
                                                      │                        │
                                                      ▼                        ▼
                                              FinancialPlan JSON      DataGap[] enrichment
                                              (complete, accurate)    + Insight[] observations
                                                      │                        │
                                                      └──────┬─────────────────┘
                                                             ▼
                                                   React Frontend (unchanged)
```

### Step 1: Table Extraction (python-docx or equivalent)

Extract all tables from the `.docx` file. For each table, capture:
- Header row (first row cells)
- Data rows (remaining rows)
- Handle merged cells / colspan (entity name dividers in entity assets table)

**Important**: Use `python-docx` directly, NOT mammoth HTML conversion. The existing extractor (`server/src/services/extractor.ts`) converts to HTML then to pipe-delimited text for the LLM — we don't need that intermediate step. We need the raw table structure.

The server is TypeScript/Node, so either:
- (a) Use a Node docx parser (e.g. `docx4js`, or parse the XML directly since .docx is a zip of XML files), OR
- (b) Have a Python subprocess that extracts tables to JSON, called from the Node server

Option (b) may be simpler and more reliable given python-docx's maturity.

### Step 2: Table Classification

Classify each table by examining its header row. Rules (in priority order):

```
IF header[0] = "Type of Advice"           → METADATA
IF header[0] starts with "Nexia"           → FIRM_DETAILS
IF header = ["Description", "Client", "Partner"]  → CLIENT_DETAILS_COUPLE
IF header = ["Description", "Client"]      → CLIENT_DETAILS_SINGLE
IF header contains "Dependant" + "Date of birth"  → DEPENDANTS
IF header contains "Adult Children"        → CHILDREN
IF header contains "From" + "Relationship" → RELATIONSHIPS
IF header contains "Goal" + "Detail"       → GOALS
IF header contains "Directors/trustees"    → ENTITIES
IF header = ["Description", "Type", "Amount"] AND rows > 5  → ENTITY_ASSETS
IF header contains "Nomination type" + "Beneficiaries"      → SUPER_NOMINATIONS
IF header contains "Policy" + "Life insured"                → INSURANCE
IF header = ["Description", "Executors"]   → ESTATE_SINGLE_FORMAT
IF header[0] = "Description" + remaining cells are first names
   AND rows contain "Will"/"Enduring power"                 → ESTATE_PLANNING
IF header = ["Description", "Owner", "Details", "Amount"]   → PERSONAL_ASSET (subtype by content)
IF header = ["Description", "Owner", "Amount"]              → INCOME or EXPENSES (subtype by content)
IF header contains "[signature"            → SIGNATURE (skip)
```

Personal asset subtypes are determined by scanning data row content:
- Contains address/street/road/avenue → `property` (investment or lifestyle based on Details column)
- Contains "everyday cash", "savings", "term deposit" → `cash`
- Contains "accumulation", "super" → `super`
- Contains "ABP", "account based pension" → `pension`
- Contains "share", "portfolio", "managed fund" → `shares`
- Contains "living expense" → `expenses`
- Contains "vehicle", "boat", "caravan", "home" in Details → `lifestyle`

### Step 3: Data Mapping (Table → FinancialPlan JSON)

This is the core of the parser. Each classified table maps directly to a part of the schema:

#### Clients
From CLIENT_DETAILS table. Rows typically include:
- `Full name` → `client.name`
- `Date of birth` → calculate age (or use `Age` row if present)
- `Occupation`/`Employment` → `client.occupation`
- Income → from INCOME table, sum all entries for this owner

For couples: Client column = client-1, Partner column = client-2.

#### Entities
From ENTITIES table. Each data row = one entity:
- Column "Description" → `entity.name`
- Column "Type" → map: "Trust (Discretionary)" → `trust`, "SMSF" → `smsf`, "Pty Ltd" → `company`
- Column "Directors/trustees" → `entity.trusteeName` + determine `trusteeType` (contains "Pty Ltd" = corporate)
- Column "Shareholders/beneficiaries" → parse names, match to clients for `linkedClientIds`
- Column "Appointor" → store in `entity.role` or `details`

#### Entity Assets
From ENTITY_ASSETS table. This table has a special structure:
- **Entity name rows** appear as section headers (either colspan rows or rows where only the first cell has content matching an entity name)
- **Asset rows** follow, with Description | Type | Amount columns
- **"Total" rows** mark the end of each entity's section

Parse by tracking the "current entity" as you iterate rows:
```
current_entity = null
FOR each row:
  IF row matches an entity name from the entities list → current_entity = that entity
  ELSE IF row[0] = "Total" → current_entity = null
  ELSE IF current_entity AND row has description + amount → add asset to current_entity.assets
```

Asset type classification for entity assets:
- "cash", "everyday", "savings", "term deposit" → `cash`
- "property", "residential", "commercial", street addresses → `property`
- "share", "portfolio", "direct shares" → `shares`
- "managed fund", "fund" → `managed_fund`
- "unlisted" → `other`

#### Personal Assets
From multiple PERSONAL_ASSET tables. Each table typically covers one asset class.

For each data row:
- `Description` → `asset.name`
- `Owner` → match to client name(s) for `ownerIds`. "Joint" or both names = both client IDs.
- `Details` → `asset.details` (may contain cost base, rental income, CGT info — preserve as string)
- `Amount` → `asset.value` (parse: remove $, commas, handle "m" suffix)
- Determine `asset.type` from the table subtype classification

**Super balance**: Sum personal super + pension values and set on the corresponding `client.superBalance`.

#### Personal Liabilities
Look for rows with "Loan", "Mortgage", "Credit" in personal asset tables, OR a dedicated liabilities table.
Also check entity assets table for loans (rows with "Loan" in description under an entity).

#### Estate Planning
From ESTATE_PLANNING table. Structure: `Description | ClientFirstName | PartnerFirstName`

Rows:
- "Will" → type `will`. Cell value = status + executor info
- "Enduring power of attorney" → type `poa`
- "Enduring power of guardianship" → type `guardianship`

Cell values to parse:
- "Yes" / "Current" / executor names → status `current`
- "No" / "Not recorded" → status `not_established`
- "Expired" → status `expired`

If cell contains names (e.g. "Sonia, Karl and Melanie (accountant)") → `primaryPerson` / `alternatePeople`.

For super nominations: from SUPER_NOMINATIONS table, create one `super_nomination` estate item per client with:
- `details` = nomination type + beneficiaries string
- `status` = `current` if nomination exists

#### Family Members
From DEPENDANTS table and/or CHILDREN table.

Dependants table gives: name, type (son/daughter), date of birth, dependant status.
Children table gives: name, income, employment, grandkids column.

**Grandchildren parsing**: The "Grandkids" column contains names like "Chelsea & Liam". These become `Grandchild` objects nested under their parent `FamilyMember`. Use name gender heuristics or default to determine grandson/granddaughter.

**Important**: Family members may also appear in entity beneficiary lists. Cross-reference but don't duplicate.

#### Goals
From GOALS table. Rows often have a category header row followed by detail rows:
```
Row: "Retirement planning" | "" | ""           ← category header
Row: "Director - Income" | "comfortable..." | "Ongoing"  ← actual goal
```

Map goal categories:
- "Retirement planning" → `retirement`
- "Living & Lifestyle" → `lifestyle`
- "Estate Planning" → `estate`
- "Wealth" / "Investment" → `wealth`
- "Education" → `education`
- "Protection" / "Insurance" → `protection`

#### Relationships (Advisers)
From RELATIONSHIPS table: `From | Relationship | To | Notes`
- "Accountant" → type `accountant`
- "Financial Adviser" → type `financial_adviser`
- "Estate Planner" / "Solicitor" → type `solicitor`
- "Stockbroker" → type `stockbroker`

Also extract from METADATA table: "Prepared by" row gives the primary financial adviser.

#### Risk Profile
From the paragraph text (not tables). Look for text like:
- "SMA - Growth" → `growth`
- "SMA - Balanced" → `balanced`
- "SMA - Conservative" → `conservative`
- "SMA - High Growth" → `high_growth`
- "SMA - Moderately Conservative" → `moderately_conservative`

Match to the client by checking if the section header mentions a client name or entity name.

#### Family Label
Derive from client surnames:
- Single client "Dorothy Smith" → "Smith Family"
- Couple "James & Mary Wall" → "Wall Family"
- Different surnames "James Wall & Mary Chen" → "James & Mary"

#### ID Assignment
All IDs must be globally unique and follow the pattern:
- Clients: `client-1`, `client-2`
- Entities: `entity-1`, `entity-2`, ...
- Assets: `asset-1`, `asset-2`, ... (globally across personal AND entity assets)
- Liabilities: `liability-1`, `liability-2`, ...
- Estate items: `estate-1`, `estate-2`, ...
- Family members: `family-1`, `family-2`, ...
- Grandchildren: `grandchild-1`, `grandchild-2`, ...
- Goals: `goal-1`, `goal-2`, ...
- Relationships: `rel-1`, `rel-2`, ...

### Step 4: Code-Based Gap Detection

After building the complete FinancialPlan, run rule-based gap detection (equivalent to the existing `enrichGaps()` in `server/src/services/validator.ts`):

- Client missing age → gap
- Client missing income → gap (if any income tables exist)
- Asset with null value → gap
- Liability with null amount → gap
- Liability with null interest rate → gap
- Entity with no assets and no liabilities → informational note
- Estate document with status `not_established` or `expired` → hasIssue = true
- Super nomination missing → gap (if super/pension assets exist but no nomination)
- Family member missing age → gap

### Step 5: Gemma 3 Insights Layer (Optional)

After the code parser produces a complete `FinancialPlan` JSON, optionally pass it to Gemma 3 12B for:

#### 5a. Enhanced Gap Detection
Send the completed JSON + the raw document text to Gemma with a focused prompt:

```
You are reviewing a parsed financial plan for completeness. The structured data has already been extracted. Your job is to identify:
1. Inconsistencies (e.g. asset appears in two places, ownership percentages don't add up)
2. Missing context the code parser couldn't capture (e.g. "relationship to client unclear")
3. Cross-reference issues (e.g. "Frank Hribar listed as appointer but not in family or client list")

Here is the parsed plan: {JSON}
Here is the original document text: {text}

Return ONLY a JSON array of DataGap objects.
```

This is a **review** task, not an extraction task — much easier for a 12B model.

#### 5b. Insights Generation
Send the completed JSON to Gemma for financial observations:

```
You are a financial planning assistant reviewing a client's financial structure. Provide 3-6 actionable insights.

Categories: concentration | liquidity | tax | estate | debt | insurance | structure
Severity: info | warning | critical

Focus on: asset concentration risk, debt ratios, insurance gaps, estate planning issues, structural observations.

Here is the plan: {JSON}
```

This maps to the existing `Insight` interface:
```typescript
interface Insight {
  category: 'concentration' | 'liquidity' | 'tax' | 'estate' | 'debt' | 'insurance' | 'structure';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  detail: string;
  nodeIds: string[];
}
```

---

## Folder Structure & Separation from Cloud Version

The cloud (Claude Sonnet) version and local (code + Gemma) version coexist in the same monorepo but are cleanly separated. **Nothing in the existing cloud pipeline is modified.**

### Principle

- The `server/src/services/` folder contains the **cloud pipeline** — don't touch it
- A new `server/src/services/plutosoft/` folder contains the **entire local parser** — self-contained
- The `shared/` types and `client/` frontend are **shared** by both versions
- The `server/src/services/validator.ts` (`enrichGaps()`) is **shared** — both pipelines use it
- A new route `parse-local.ts` sits alongside the existing `parse.ts`

### Full Server Structure (after implementation)

```
server/src/
├── routes/
│   ├── parse.ts                  ← EXISTING cloud route (UNCHANGED)
│   ├── parse-local.ts            ← NEW: local code-driven route
│   └── insights.ts               ← EXISTING (cloud insights, UNCHANGED)
│
├── services/
│   ├── claude.ts                 ← UNCHANGED (cloud LLM)
│   ├── llm.ts                    ← UNCHANGED (cloud LLM provider abstraction)
│   ├── mlx.ts                    ← UNCHANGED
│   ├── ollama.ts                 ← UNCHANGED
│   ├── scrub.ts                  ← UNCHANGED (cloud pre-API scrubbing)
│   ├── anonymize.ts              ← UNCHANGED (cloud post-parse anonymization)
│   ├── coerce.ts                 ← UNCHANGED
│   ├── extractor.ts              ← UNCHANGED (cloud text extraction)
│   ├── postExtract.ts            ← UNCHANGED (cloud fallback enrichment)
│   ├── validator.ts              ← SHARED — enrichGaps() used by both pipelines
│   │
│   └── plutosoft/                ← NEW: entire local parser (self-contained)
│       ├── index.ts              — Main entry: docx buffer → FinancialPlan
│       ├── tableExtractor.ts     — .docx → raw table arrays
│       ├── tableClassifier.ts    — Classify tables by header pattern
│       ├── planBuilder.ts        — Orchestrator: classified tables → FinancialPlan JSON
│       ├── clientParser.ts       — Parse client details tables
│       ├── entityParser.ts       — Parse entity + entity assets tables
│       ├── assetParser.ts        — Parse personal asset tables
│       ├── estateParser.ts       — Parse estate planning tables
│       ├── familyParser.ts       — Parse dependants/children tables
│       ├── goalParser.ts         — Parse goals table
│       ├── adviserParser.ts      — Parse relationships table + metadata
│       ├── riskProfileParser.ts  — Extract risk profile from paragraph text
│       ├── gapDetector.ts        — Rule-based gap detection
│       ├── gemmaInsights.ts      — Optional Gemma 3 via Ollama for insights + gap review
│       └── utils.ts              — Shared helpers (dollar parsing, name matching, etc.)
```

### Route Separation

The new `parse-local.ts` route exposes `POST /api/parse-local`. It returns the **identical `ParseResponse`** type so the frontend can switch between them:

```typescript
// parse-local.ts — simplified pipeline (no scrub, no anonymize, no LLM)
import { plutosoftParse } from '../services/plutosoft/index.js';
import { enrichGaps } from '../services/validator.js';

parseLocalRouter.post('/parse-local', upload.single('file'), async (req, res) => {
  const plan = await plutosoftParse(req.file.buffer);   // pure code extraction
  enrichGaps(plan);                                       // shared gap detection
  // Optional: Gemma insights layer
  // const gemmaGaps = await gemmaReview(plan, rawText);
  // plan.dataGaps.push(...gemmaGaps);
  res.json({ success: true, data: plan });
});
```

The existing `parse.ts` route (`POST /api/parse`) remains completely unchanged.

### Frontend Toggle

The client needs a small addition — a toggle or config to choose which endpoint to call. This could be:
- A UI toggle (cloud vs local mode)
- An environment variable at build time
- Auto-detection (try `/api/parse-local`, fall back to `/api/parse`)

### What Each Version Owns

| Component | Cloud Version (v1) | Local Version (v2) |
|-----------|-------------------|-------------------|
| Text extraction | `extractor.ts` (mammoth → raw text) | `plutosoft/tableExtractor.ts` (docx → raw tables) |
| Core parsing | Claude API tool use + Zod schema | Code parser (table classification + direct mapping) |
| Post-extraction | `postExtract.ts` (fallback enrichment) | Not needed — code parser handles all directly |
| Surname scrubbing | `scrub.ts` (pre-API redaction) | Not needed — no API call, all local |
| Surname restoration | `scrub.ts` restoreSurnames() | Not needed |
| Anonymization | `anonymize.ts` (strip surnames) | Not needed — all data stays on machine |
| Gap detection | `validator.ts` enrichGaps() | **Same** `validator.ts` enrichGaps() (shared) |
| Insights | Claude API (`services/claude.ts`) | Gemma 3 12B via Ollama (`plutosoft/gemmaInsights.ts`) |
| Route | `routes/parse.ts` | `routes/parse-local.ts` |
| Frontend | **Shared** | **Shared** |
| Schema / Types | **Shared** | **Shared** |

---

## Validation & Testing

### Test Against Existing Batch Results

The existing `test/batch-test.ts` harness and `test/batch-data.json` (Claude Sonnet's output for all 73 files) provides the ground truth. Build a comparison test:

1. Run the code parser on all 73 `.docx` files
2. Compare each field against the Claude Sonnet baseline in `batch-data.json`
3. Track: exact match count, close match count, missing data, extra data
4. Target: **90%+ match rate** on all metrics (vs Gemma's 56%)

### Key Metrics to Track

- Client count match: target 73/73
- Entity count match: target 37/37 (files that have entities)
- Personal asset count match: target 70+/73
- Entity asset count match: target 34+/36
- Total asset value within 5% of Sonnet's value
- Estate planning item count match
- Goal count match
- Family member count match
- Super nomination detection

### Dollar Value Parsing

Currency parsing must handle:
- `$4,340,000` → 4340000
- `$1m` or `$1M` → 1000000
- `$2.5m` → 2500000
- `$580,175` → 580175
- `$1` → 1
- Empty or "N/A" → null
- Negative values (rare but possible)

---

## Desktop Packaging (Later Phase)

Once the code parser + Gemma insights pipeline is working:

1. **Electron app** wrapping the existing React frontend + local Express server
2. **Bundled Ollama** with Gemma 3 12B model (or make Ollama install a prerequisite)
3. **No internet required** for core functionality
4. **Single installer** (.exe for Windows, .dmg for Mac)
5. Python dependency either bundled or use a pure Node/TS docx parser to avoid it

---

## Priority Order

1. **Table extractor** — get raw tables from .docx files (Day 1)
2. **Table classifier** — identify each table's type (Day 1)
3. **Client + entity parsers** — the structural foundation (Day 2)
4. **Asset parsers** (personal + entity) — the #1 failure point for Gemma (Day 2-3)
5. **Estate + super nomination parsers** (Day 3)
6. **Family + goals + adviser parsers** (Day 3-4)
7. **Gap detection** (Day 4)
8. **Batch testing against Sonnet baseline** (Day 4-5)
9. **Gemma insights integration** (Day 5-6)
10. **Fix edge cases from batch testing** (Day 6-7)
11. **Desktop packaging** (Day 8-10)

---

## Reference: Dorothy Smith Example

The Dorothy Smith fact-find contains 18 tables. Here is the exact extraction the code parser should produce (from the Sonnet baseline):

**Clients**: Dorothy June Smith, age 74, Director, income $10,104 (from SF Family Trust directorship — note: total income from all sources = $237,546 + $10,104)

**Entities**: Dj Smith Foundation (trust), JPF Family Trust (trust), SF Family Trust Superannuation Scheme (smsf), The SF Family Trust (trust), Hribar Nominees Pty Ltd (company), Hribar Investments Pty Ltd (company)

**Entity Assets**: Dj Smith Foundation: $57,500 cash + $820,000 property + $800,000 property = $1,677,500. JPF Family Trust: $2,500,000 property. SMSF: 9 assets totalling $8,803,198. SF Family Trust: $4,500,000 + $700,000 property = $5,200,000.

**Personal Assets**: $4,340,000 home, $1 everyday cash, $2,238,000 + $7,000,000 investment property, $4,366,464 super accumulation, $2,147,485 + $610,793 pension

**Family**: Karl Hribar (son), Sonia White (daughter, kids: Chelsea & Liam), Daniel Hribar (son, kids: James & Madeline)

**Estate**: Will (current, executors: Sonia, Karl, Melanie), EPA (current), EPG (current), Super nomination (binding, 4 nominations: LPR 35%, Sonia 25%, Daniel 15%, Karl 25%)

**Goals**: Comfortable lifestyle in retirement (retirement, ongoing), Maintain living expenditure $252,604 (lifestyle, ongoing), Smooth transition of assets (estate)

**Advisers**: Melanie McRoberts (accountant), Katie McDonald at Nexia Perth Financial Solutions (financial adviser, AFSL 482926, Adviser No 444059), Michael Hughes Legal (solicitor), Robert Luo (accountant, SMSF)
