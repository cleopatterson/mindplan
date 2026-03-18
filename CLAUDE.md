# CLAUDE.md

## Project Overview

MindPlan is a financial structure visualiser. It parses financial planning documents via Claude AI and renders interactive mind maps using ReactFlow.

## Tech Stack

- **Monorepo**: npm workspaces (`shared/`, `server/`, `client/`)
- **Server**: Express 5, TypeScript, tsx (dev), Anthropic SDK, Firebase Admin, Zod, multer, pdf-parse, mammoth
- **Client**: React 19, Vite, ReactFlow (@xyflow/react), dagre (@dagrejs/dagre), Tailwind CSS, lucide-react, Firebase Auth
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
- `ANTHROPIC_API_KEY` — required for Claude API parsing
- `CLAUDE_MODEL` — override Claude model (default: `claude-sonnet-4-5-20250929`)
- `LLM_PROVIDER` — `local` (fast deterministic) or `claude` (default: claude)
- `PORT` — server port (default: 3001)
- `FIREBASE_PROJECT_ID` — Firebase project ID
- `FIREBASE_CLIENT_EMAIL` — Firebase service account email
- `FIREBASE_PRIVATE_KEY` — Firebase service account private key (multiline in Railway, `\n`-escaped in `.env`)

Client environment variables (`client/.env`):
- `VITE_FIREBASE_API_KEY` — Firebase web API key
- `VITE_FIREBASE_AUTH_DOMAIN` — Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` — Firebase project ID
- `VITE_ENABLE_PROJECTION` — set to `true` to show the Map/Cashflow/Projection toggle (V2 gate, omit to hide). Not set on Railway.

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
- **Gap badges on nodes**: `gapNodeIds` Set passed from Dashboard → MindMap → stamped as `hasGap` on node data → amber AlertTriangle badge rendered on AssetNode, LiabilityNode, ClientNode
- **Gaps panel toggle**: click gaps badge to open, click again to close (toggleGaps in Dashboard)
- **GapsChecklist styling**: normal font color (not red), exclamation badges, separator lines, generous spacing, theme-aware

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
- Edge identity preservation: `setEdges` functional updater reuses old edge references when source/target/position/className unchanged, preventing ReactFlow SVG unmount/remount flash

### Insurance Cover Groups (Collapsible)
- Insurance covers grouped by cover type (Life, TPD, Trauma, Income Protection) under each client when 2+ of same type
- Same expand/collapse pattern as asset groups — collapsed by default, click to toggle, viewport anchoring
- `InsuranceCoverGroupNode.tsx` — cyan-styled group node with cover-type icon and chevron
- Group node IDs: `ins-type-${clientId}-${coverType}`
- Single covers of a type remain flat (no group wrapper)
- Hierarchy: Insurance → Client → Cover Type Group (if 2+) → Individual Covers
- Individual cover labels show policy name (e.g. "MLC: Aaron Scagliotta") when grouped, cover type label when flat

### Asset Types
- `super` = accumulation phase, `pension` = drawdown/retirement phase (Account Based Pension, TTR)
- Both grouped under "Super" in summary bar (`ASSET_GROUP` in `calculations.ts`)
- Both excluded from `personalAssetsForCalc()` when SMSF has underlying assets (dedup)

### Expenses (Mind Map)
- Parsed from "Regular expenses" section (stops at first "Total" row to exclude "One off expenses")
- Displayed as a collapsible group node hanging off the first client, with cross-links to other clients
- Group node (`expensesGroup`): slate-styled like asset category groups, shows count + total/yr
- Individual expense nodes (`expense`): reuse `LiabilityNode` component (red styling)
- `ExpensesGroupNode.tsx` — collapsible group with receipt icon
- 62/73 test files contain expenses data

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
- Last run (2026-03-18): 4/73 failures (gold standard ceiling — super counting methodology difference + entity structure edge cases)

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
  - `expenses.ts` — regular expenses (4-column table: Description, Owner, Details, Amount)
  - `goals.ts`, `dependants.ts`, `relationships.ts` — goals, family, professional relationships

Key parser patterns:
- Insurance parser recognises "Provider: PersonName" headers (e.g. "CareSuper: Aaron Scagliotta", "Asteron: Heizel")
- "Super - ..." in insurance is an owner field, not a policy name
- Insurance sub-covers within a named policy are skipped (only the named policy is an item)
- `isLiabilityType()` excludes "loan offset" (it's a cash asset, not a liability)
- Insurance assets have `value: null` in gap detection and unvalued stats (cover ≠ asset value)
- SMSF member balance entries are deduped against personal super (pattern-matched names)
- Fuzzy entity name matching (suffix-based fallback) for entity holdings → entity structure joins
- Entity holdings `isKnownAssetType()` is the gatekeeper — includes Plutosoft entity asset categories (Cash, Investment portfolio, Shares, Property, Business assets, Loan assets, Loans, Share in private company). Unrecognised types fall back to dollar-amount lookahead heuristic (if cell+2 is `$amount`, treat as asset with type `other`).
- Goals parser: `matchCategory()` uses **exact match only** (not `startsWith`) to avoid false positives (e.g. "Tax-effective ways..." matching "tax")
- Goals parser: `isTimeframeText()` only matches patterns starting with "Ongoing", "Now", "From", or a year. No month name matching (false positives in detail text like "by 31 December 2029")
- Goal categories match Plutosoft system: `retirement`, `superannuation`, `tax`, `wealth`, `protection`, `estate`, `lifestyle`, `cash_reserve`, `other_investments`, `debt`, `centrelink`, `education`, `regular_review`, `other`
- Test: `npx tsx test/test-local-batch.ts` — 4/73 failures (gold standard ceiling), goal count 64/73 (88%)

### Authentication
- Firebase Auth (email/password, invite-only — no self-registration)
- Users created manually in Firebase Console (console.firebase.google.com)
- Client: `client/src/firebase.ts` (app init), `client/src/hooks/useAuth.ts` (auth state hook)
- Server: `server/src/middleware/auth.ts` (token verification middleware, lazy-initialized)
- `verifyAuth` middleware on `/api/parse` and `/api/insights`; health check + static files are public
- Login flow: LandingPage (marketing) → LoginPage → LandingPage (personalized with upload)
- Lazy Firebase Admin init required — env vars aren't available at import time (dotenv loads after ES imports)

### Projection View (Experimental)
Time-based financial projection visualized as a Recharts stacked area chart. Toggled via Map/Cashflow/Projection segmented control in the header. **Gated by `VITE_ENABLE_PROJECTION` env var** — set in local `client/.env` (gitignored), not set on Railway. Code stays in codebase (harmless, lazy-loaded) but UI toggle is hidden in production.

#### Architecture
- **Client-side projection engine**: Pure `calculateProjection(plan, settings) → ProjectionResult` — per-year iteration with asset growth, P&I liability amortization, super contributions, retirement detection
- **Claude AI smart settings**: `POST /api/projection-settings` analyzes `details` text fields for embedded rates, yields, loan terms. Auto-fires on projection view mount. Uses its own Anthropic client — **independent of `LLM_PROVIDER`** (so `LLM_PROVIDER=local` still works for the mind map parser)
- **Pre-tax only**: No CGT, super tax, or marginal rates modelled. Disclaimer shown in settings panel.

#### Key Files
- `shared/types.ts` — `ProjectionSettings`, `ProjectionResult`, `ProjectionYearData`, `ProjectionMilestone`, `ProjectionAssetDetail`, `ProjectionLiabilityDetail`, `ProjectionSettingsResponse`
- `client/src/utils/projectionDefaults.ts` — Default growth rates by asset type × risk profile, `getDefaultSettings()`, `resolveGrowthRate()`, `resolveLiabilityTerms()`
- `client/src/utils/projectionEngine.ts` — Pure `calculateProjection()` function
- `client/src/components/projection/ProjectionView.tsx` — Container (lazy-loaded via `React.lazy`)
- `client/src/components/projection/ProjectionChart.tsx` — Recharts `ComposedChart` with stacked areas + net worth line + milestones
- `client/src/components/projection/ProjectionSummaryStrip.tsx` — 4 clickable metric cards (net worth, super, debt-free, final)
- `client/src/components/projection/ProjectionSettingsPanel.tsx` — Editable accordion: Global, Client, Asset Returns (per-asset), Liabilities (per-liability)
- `client/src/components/projection/ProjectionDetailPanel.tsx` — Detail breakdowns per summary card
- `server/src/routes/projection.ts` — POST endpoint with own Anthropic client
- `server/src/schema/projectionSettings.ts` — Zod validation schema
- `server/src/prompts/generateProjectionSettings.ts` — Claude system prompt

#### Default Growth Rates
| Asset Type | Conservative | Balanced | Growth | High Growth |
|-----------|-------------|---------|--------|------------|
| property | 5.0% | 5.5% | 6.0% | 6.0% |
| shares/managed_fund | 4.0% | 7.0% | 8.5% | 10.0% |
| cash | 1.5% | 1.5% | 1.5% | 1.5% |
| super/pension | 4.0% | 7.0% | 8.5% | 10.0% |
| vehicle | -10% | -10% | -10% | -10% |

#### Conventions
- Horizon: `Math.max(90 - youngestAge, 5)` years (life expectancy model, not retirement-based)
- AI overrides merge into settings on arrival — shown inline with "AI" badges, fully editable
- Duplicate retirement milestones grouped: "Both retire at 67"
- Insurance assets excluded from projections
- Settings gear in chart area top-right, detail panel reuses same `w-96` animated right panel

### Cashflow View
d3-sankey diagram showing annual income vs spending. Toggled via header segmented control (between Map and Projection). **Gated by `VITE_ENABLE_PROJECTION`** (shared V2 gate). Pure client-side — no server changes needed.

#### Layout
- **Column 0 (Inflows)**: One node per client with `income > 0`
- **Column 1 (Pass-through)**: Single "Household Cashflow" node aggregating all income
- **Column 2 (Outflows)**: Grouped expenses (keyword-categorised), liability repayments (P&I calc), surplus/deficit node

#### Expense Categories
Deterministic keyword matching on `expense.name`: Housing, Transport, Insurance & Health, Lifestyle, Education, Other

#### Key Files
- `client/src/hooks/useCashflowData.ts` — `buildCashflowData()` transforms `FinancialPlan` → Sankey nodes/links + summary totals
- `client/src/components/cashflow/CashflowView.tsx` — d3-sankey SVG with filled bezier link paths, staggered entrance animation, node glow filters, summary strip at bottom

#### Visual Design (inspired by dorothy-sankey.html prototype)
- Filled bezier link paths (not stroked) — custom `linkFillPath()` using d3-sankey's center-of-band y0/y1 ± half width
- Node glow effects via SVG feGaussianBlur filters (dark mode only)
- Staggered entrance animation: nodes grow in (0→50%), then links fade in (40%→100%), ~1.8s total
- Household node label positioned above (not beside)
- Uppercase column headers with letter-spacing
- Layout height capped at 420px to prevent giant bars filling viewport
- Summary strip at bottom (matches mind map convention): Total Income | Total Outflows | Surplus/Deficit
- Surplus node green, deficit node red
- Monospace font for value labels

### Reveal Animation
- DFS-order staggered node/edge appearance on initial load only (not on group expand/collapse)
- Opacity-only keyframe (no `transform: scale()` — was causing ReactFlow handle position miscalculation)
- Cleanup uses DOM-only class removal (not React state) to avoid triggering edge re-render
- **Critical**: `revealedDataRef` must NOT be reset in useEffect cleanup — React Strict Mode's simulated unmount/remount preserves refs, so resetting causes reveal to re-fire on next state change (edge flash bug). Real unmounts create fresh hook instances.
- `setNodes` in useLayoutEffect preserves `old.measured` on existing nodes to prevent ReactFlow re-measuring all nodes (which causes edges to temporarily lose connection points)
- `fitView` prop removed from `<ReactFlow>` — it re-fitted on every node change. Replaced with one-time `fitView()` on initial mount via `initialFitDone` ref

### PDF Export
- `usePdfExport.ts` — captures map as JPEG, builds multi-page jsPDF document
- Map capture moves element offscreen (`top: -captureH`) at `z-index: 1` (behind modal at z-50) so user sees modal "Generating..." state throughout
- Viewport saved before capture, restored after — `MindMapHandle.getViewport()`/`restoreViewport()`
- Filename derived from family label + title (e.g. `Smith-Family-Legacy-Wealth-Blueprint.pdf`)
- Success flow: Generate → spinner → green "PDF saved!" (1.5s) → modal auto-closes

### Usage Tracking & Admin Dashboard
- Firestore-based (collection: `usage_events`) — client-side fire-and-forget logging
- `client/src/services/usageTracking.ts` — `logUsageEvent()` helper, one `sessionId` per browser tab
- Events tracked: `login`, `logout`, `parse_start`, `parse_success`, `parse_error`, `pdf_export`, `view_change`
- Parse events include metadata: fileName, fileSize, parseTimeMs, clientCount, error message
- Standalone dashboard at `/dashboard` (also deployed as separate Railway service `dashboard/`)
- `server/src/dashboard/index.html` — single-file HTML with Chart.js, Tailwind CDN, Firebase JS SDK
- Two tabs: **Overview** (KPIs, charts, users table) and **Sessions** (sortable table with expandable detail)
- Charts: Activity Over Time (stacked bar), Event Breakdown (doughnut), Parse Time Trend (line), Parses by User (horizontal bar)
- Drill-through: click any KPI card, chart element, or user row → jumps to Sessions tab filtered
- Feedback section at bottom of Overview — real-time Firestore subscription, mark-addressed button
- Admin-only: Firebase Auth + Firestore rules gated to admin UID
- Firestore rules: `usage_events` — any authed user can create, admin-only read; `feedback` — authed create, user-scoped read, admin-only update
- Client fetch retry: 2 automatic retries with 3s delay on network failures (Railway cold start)

### Feedback System
- Firestore-based (collection: `feedback`) — no server endpoint needed
- `client/src/components/feedback/FeedbackPanel.tsx` — submit + history panel
- `client/src/firebase.ts` — exports `db` (Firestore instance)
- Admin UID `7Ldd1nNF7vcDpjxpjaOe5xx1Nrh2` (Tony) sees all feedback with filter/respond/mark-addressed
- Non-admin users see only their own feedback history
- Feedback text has `select-text` override (global `select-none` otherwise blocks copy-paste)
- Firestore rules: authenticated create, user-scoped read, admin-only update

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
- Global `button:not(:disabled) { cursor: pointer }` in `index.css` (Tailwind preflight resets it) — no need for `cursor-pointer` on buttons
- Header icon buttons use `hover:bg-white/10` (dark) / `hover:bg-gray-100` (light) for visible hover feedback
