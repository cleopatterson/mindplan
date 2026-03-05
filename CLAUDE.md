# CLAUDE.md

## Project Overview

MindPlan is a financial structure visualiser. It parses financial planning documents via Claude AI and renders interactive mind maps using ReactFlow.

## Tech Stack

- **Monorepo**: npm workspaces (`shared/`, `server/`, `client/`)
- **Server**: Express 5, TypeScript, tsx (dev), Anthropic SDK, Zod, multer, pdf-parse, mammoth
- **Client**: React 19, Vite, ReactFlow (@xyflow/react), dagre (@dagrejs/dagre), Tailwind CSS, lucide-react
- **Shared**: TypeScript types only (no runtime code)
- **Deployment**: Railway (Nixpacks)

## Commands

```bash
npm run dev          # Start dev server + client concurrently
npm run build        # Build all workspaces (shared → client → server)
npm start            # Start production server
```

TypeScript checks (workspaces extend `tsconfig.base.json`, check each individually):
```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

Environment variables (`.env` at root):
- `ANTHROPIC_API_KEY` — **required**
- `CLAUDE_MODEL` — override Claude model (default: `claude-sonnet-4-5-20250929`)
- `PORT` — server port (default: 3001)

## Architecture Decisions

### Data Flow
Upload → text extraction → **Claude API path**: pre-API scrubbing → Claude API (tool use + Zod schema) → surname restoration | **Local parser path**: `splitSections` → per-section parsers → `assemble` | → gap enrichment → anonymization → JSON response → ReactFlow mind map

### Key Server Files
- `server/src/schema/financialPlan.ts` — Zod schema defining the `FinancialPlan` structure (used as Claude tool schema)
- `server/src/prompts/parseFinancialPlan.ts` — System/user prompts sent to Claude for document parsing
- `server/src/services/validator.ts` — `enrichGaps()` function that detects critical missing data
- `server/src/routes/parse.ts` — Main parse route orchestrating the full pipeline

### Mind Map Layout
- Dagre runs twice: RL for left side (clients/entities/assets), LR for right side (estate/family)
- Both sides stitched at the central family node, then top-aligned
- Left-side nodes are right-aligned, right-side nodes are left-aligned (rank-based)
- Node widths are FIXED (`w-[Xpx]`) and must match `NODE_WIDTH` constants in `useGraphLayout.ts`
- Asset/liability ordering: individual assets first, joint assets last per owner (pushes joint items between clients visually)

### Edge Types
- **Structural edges**: dagre-layouted parent→child connections
- **Cross-links** (`data.isCrossLink`): joint asset ownership, excluded from dagre, styled like structural edges
- **User links** (`data.isUserLink`): manually drawn by users, purple dashed, removable via double-click

### Anonymization
- Runs server-side after gap enrichment (in `parse.ts`)
- Only strips surnames from person-name fields (clients, family members, estate contacts, individual trustees)
- Entity names, asset names, liability names are left untouched

### Gap System
- Server-side `enrichGaps()` (in `validator.ts`) detects critical missing data only: client ages, asset values, liability amounts
- Insurance assets are excluded from gap detection (cover amount is not an asset value)
- Deduplication uses `nodeId::field` key (not description strings)
- Client-side `resolveGap()` uses `nodeId` for precise field targeting across all node types

### Asset Groups (Collapsible)
- Assets are grouped by raw `asset.type` when 2+ share the same type under a parent
- Groups are **collapsed by default** — click to expand/collapse (chevron indicator)
- `ASSET_TYPE_DISPLAY` in `transformToGraph.ts` maps raw type → display label (e.g. `managed_fund` → "Managed Funds")
- Group node IDs: `asset-group-${parentId}-${rawType}`
- `expandedGroupIds` state in `MindMap.tsx` tracks which groups are open
- Viewport anchoring on toggle prevents screen jumping (captures node position + viewport before re-layout, compensates after)
- Drag-to-create from a collapsed group auto-expands it
- Hidden children of collapsed groups are filtered between `transformToGraph` and `useGraphLayout`
- Layout sync uses `useLayoutEffect` (not `useEffect`) to prevent edge flicker on expand/collapse

### Asset Types
- `super` = accumulation phase, `pension` = drawdown/retirement phase (Account Based Pension, TTR)
- Both grouped under "Super" in summary bar (`ASSET_GROUP` in `calculations.ts`)
- Both excluded from `personalAssetsForCalc()` when SMSF has underlying assets (dedup)

### Summary Bar
- Asset allocation groups `managed_fund` + `shares` together as "Shares", `pension` + `super` as "Super"
- Debt ratio color-coded: green <30%, amber 30-50%, red >50%

### Drag-to-Create
- Dragging from a node handle into empty space opens a `NodeTypePicker` context menu
- `nodeChildTypes.ts` defines valid child types per parent node type
- `addNode()` in `useFinancialData` creates the node, `newNodeId` + auto-focus flow opens the detail panel with the name field selected

### Testing
- `test/batch-test.ts` — batch quality test harness, uploads files to `/api/parse` and validates responses
- Run: `npx tsx test/batch-test.ts` (requires server running on localhost:3001)
- `test/batch-results.json` — per-file metrics from last run
- `test/batch-data.json` — full parsed data from last run
- `client_files/` — 73 real client `.docx` fact-find files (not committed)
- Last run (2026-02-23): 73/73 passed, 0 failures, 0 warnings
- `test/test-local-batch.ts` — local parser batch test, compares against Claude gold standard
- Run: `npx tsx test/test-local-batch.ts` (no server needed, avg 151ms/file)
- Last run (2026-03-04): 69/73 passed, 4 gold standard inconsistencies

### Local Code-Based Parser
Deterministic parser for Plutosoft "Client Fact Find" `.docx` documents. No API calls — runs in ~150ms/file.

- `server/src/services/local/index.ts` — entry point (`parseWithLocal`)
- `server/src/services/local/splitSections.ts` — splits mammoth raw text into named sections using ordered landmark detection
- `server/src/services/local/assembler.ts` — assembles section parse results into a `FinancialPlan`
- `server/src/services/local/parseTable.ts` — generic table cell splitter for raw text tables
- `server/src/services/local/utils.ts` — shared utilities (`parseDollar`, `normalizeName`, `isNoInfoLine`)
- `server/src/services/local/sections/` — per-section parsers:
  - `header.ts`, `personalDetails.ts` — client names, ages, occupations
  - `income.ts`, `riskProfile.ts` — client income and risk profile
  - `personalAssets.ts` — bank accounts, financial investments, shares, lifestyle assets
  - `superPension.ts` — superannuation and pension accounts
  - `insurance.ts` — life, TPD, trauma, income protection policies
  - `loans.ts` — personal liabilities (mortgages, car loans, credit cards)
  - `investmentProperty.ts` — investment properties with rental details
  - `entityStructure.ts` — entity names, types, directors/trustees
  - `entityHoldings.ts` — entity assets and liabilities (shares, property, cash, loans)
  - `estatePlanning.ts` — wills, EPA, EPG, super nominations
  - `goals.ts`, `dependants.ts`, `relationships.ts` — goals, family, professional relationships

Key parser patterns:
- Insurance sub-covers within a named policy are skipped (only the named policy is an item)
- `isLiabilityType()` excludes "loan offset" (it's a cash asset, not a liability)
- Insurance assets have `value: null` in gap detection and unvalued stats (cover ≠ asset value)
- SMSF member balance entries are deduped against personal super (pattern-matched names)
- Fuzzy entity name matching (suffix-based fallback) for entity holdings → entity structure joins
- Test: `npx tsx test/test-local-batch.ts` — 69/73 pass rate against Claude gold standard

### LLM Providers
- `server/src/services/llm.ts` — provider abstraction
- `server/src/services/mlx.ts` — MLX local model support
- `server/src/services/ollama.ts` — Ollama local model support

## Conventions

- All node components use `React.memo` and fixed widths matching dagre constants
- `data.side` on nodes: `'left'` | `'right'` | `'center'`
- Performance timing logs use `⏱` prefix (server and client)
- The app uses `select-none` globally to prevent text selection on shift-click
- Zod validation uses `safeParse` (not `parse`) for clean error messages
