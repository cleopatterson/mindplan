# MindPlan Projection View — Feature Specifications

> Experimental financial projection engine. Time-based wealth modelling visualised as a Recharts stacked area chart with editable assumptions.

---

## Architecture Overview

- **Client-side engine**: Pure `calculateProjection(plan, settings) → ProjectionResult` — per-year iteration, no server calls needed after initial settings
- **Claude AI smart settings**: `POST /api/projection-settings` analyses the uploaded document's `details` fields for embedded rates, yields, loan terms, expenses. Auto-fires when projection view opens. Fully editable — AI suggestions shown with purple "AI" badges.
- **Pre-tax simplification**: No marginal income tax or CGT modelled. Simplified super tax, Div 293, and franking credits are included. Disclaimer shown in settings panel.

---

## Feature List

### Phase 1 — Expenditure & Cash Flow Modelling

**Ongoing Expenses**
- Recurring annual expenses (e.g. living costs, insurance premiums, advice fees)
- Each expense can be indexed to inflation (CPI-linked) or fixed
- Default: "Living Expenses" auto-estimated at 70% of gross income (or $60,000 if no income data)
- AI extracts expenses from document details, goals, and lifestyle information
- Add/edit/remove in settings panel

**Lump Sum Expenses**
- One-off costs in a specific year (e.g. renovations $100K in 2028, car purchase)
- AI extracts from goals with explicit dollar amounts and timeframes
- Add/edit/remove in settings panel

**Pre-Retirement Cash Flow**
- Employment income (growing with salary growth rate) minus expenses = net cash flow
- Surplus → deposited into cash assets
- Deficit → drawn from cash assets first

**Post-Retirement Drawdown Waterfall**
- No employment income after retirement
- Asset income (rent, dividends, interest) + Age Pension partially covers expenses
- Remaining deficit drawn in order: Super/Pension → Cash → Shares/Liquid assets
- Primary residence (PPR) excluded from drawdown — you don't sell your house

**Expenses Line on Chart**
- Orange dashed line shows total annual expenses over time
- Visible in chart tooltip alongside asset categories

---

### Phase 2 — Income/Growth Split & Super Tax

**Income vs Capital Growth**
- Each asset's total return is split into income (distributed as cash flow) and capital growth (compounds in asset value)
- Default income rates: Property 4% (rental yield), Shares 3% (dividends), Managed Funds 2.5%, Cash 1.5% (100% income), Super/Pension 0% (retained inside wrapper)
- Per-asset income yield editable in settings panel (shown alongside total return)
- AI extracts specific yields from document details (e.g. "4.2% rental yield")

**Super Contributions Tax (15%)**
- Employer SG contributions taxed at 15% before entering super
- Net contribution = gross contribution x 0.85
- Configurable rate in Global Settings

**Super Earnings Tax**
- Accumulation phase: 15% tax on earnings (reduced by franking credits — see Phase 4)
- Pension phase: 0% tax on earnings + franking credit refunds
- Configurable in Global Settings

---

### Phase 3 — PPR, Preservation Age & Retirement Risk Shift

**Primary Residence (PPR) Tagging**
- Auto-detected from property names/details (looks for "home", "residence", "family" vs "rental", "investment", "IP")
- Blue home icon toggle per property in Asset Returns settings
- PPR effects: excluded from retirement drawdown, 0% income yield (no rent on your own home), excluded from Age Pension assets test
- AI prompt identifies PPR from document descriptions

**Super Preservation Age**
- Default: age 60 (Australian standard)
- Super cannot be drawn until the youngest client reaches preservation age
- If retiring before 60: drawdown comes from non-super assets first (cash → shares → other)
- Super unlocks automatically at preservation age
- Milestone marker on chart: "Super accessible (age 60)"
- Configurable in Global Settings

**Retirement Risk Profile Shift**
- Default: automatically shifts down one notch at retirement (e.g. Growth → Balanced, Balanced → Mod. Conservative)
- Reduces growth rate assumptions to reflect more conservative post-retirement allocation
- Only affects assets without manual/AI overrides
- Dropdown in Global Settings: "No shift" or pick a specific target profile
- Shift applies once when all clients are retired

---

### Phase 4 — Salary Sacrifice, Div 293, Contribution Caps, Age Pension & Franking Credits

**Salary Sacrifice**
- Per-client annual pre-tax amount directed to super (default $0)
- Reduces take-home income, increases super contributions
- Combined with employer SG, subject to concessional cap
- Editable per client in Client Settings
- AI detects salary sacrifice mentions in documents

**Division 293 Tax**
- Extra 15% tax on concessional super contributions when income + contributions > $250,000
- Calculated per client
- Applies to the lesser of: total concessional contributions, or the amount exceeding the threshold
- Threshold configurable in Global Settings

**Concessional Contribution Cap**
- $30,000 per person per year (SG + salary sacrifice combined)
- Excess above cap is not contributed to super
- Configurable in Global Settings

**Government Age Pension (Simplified)**
- Assets-test based model using 2025-26 rates
- Activates when all clients are aged 67+ and retired
- Homeowner thresholds (PPR automatically excluded from assessable assets)
- Single: max $28,514/yr, lower threshold $314,000
- Couple: max $43,006/yr, lower threshold $470,000
- Taper rate: $78/year per $1,000 of assets over lower threshold
- Couple vs single auto-detected from client count
- Toggle on/off in Global Settings

**Franking Credits (Dividend Imputation)**
- Assumes 40% of super fund earnings from Australian equities (typical balanced fund allocation)
- Accumulation phase: franking credits offset 15% earnings tax → effective tax near zero
- Pension phase: full franking credit refund added to super balance (cash refund)
- Company tax rate (30%) configurable in Global Settings

**Salary-Linked Super Growth**
- Super contributions scale with salary growth each year (not fixed at year-0 income)

---

## Default Assumptions

| Setting | Default | Notes |
|---------|---------|-------|
| Horizon | `90 - youngest age` (min 5) | Life expectancy model |
| Inflation | 2.5% | CPI |
| Salary Growth | 3.0% | AI adjusts by occupation |
| Super SG Rate | 11.5% | 2025 Australian rate |
| Contributions Tax | 15% | Standard concessional tax |
| Earnings Tax | 15% / 0% | Accumulation / Pension |
| Preservation Age | 60 | Australian standard |
| Concessional Cap | $30,000 | Per person per year |
| Div 293 Threshold | $250,000 | Income + contributions |
| Age Pension | On | Simplified assets test |
| Franking Rate | 30% | Australian company tax rate |
| Living Expenses | 70% of income or $60K | AI refines from document |

### Default Growth Rates (Total Return)

| Asset Type | Conservative | Mod. Conservative | Balanced | Growth | High Growth |
|-----------|-------------|-------------------|---------|--------|------------|
| Property | 5.0% | 5.0% | 5.5% | 6.0% | 6.0% |
| Shares / Managed Funds | 4.0% | 5.5% | 7.0% | 8.5% | 10.0% |
| Cash | 1.5% | 1.5% | 1.5% | 1.5% | 1.5% |
| Super / Pension | 4.0% | 5.5% | 7.0% | 8.5% | 10.0% |
| Vehicle | -10% | -10% | -10% | -10% | -10% |

### Default Income Rates (Portion of Total Return)

| Asset Type | Income Rate | Type |
|-----------|-------------|------|
| Property (investment) | 4.0% | Rental yield |
| Property (PPR) | 0% | No rental income |
| Shares | 3.0% | Dividend yield |
| Managed Funds | 2.5% | Distributions |
| Cash | 1.5% | Interest (100% income) |
| Super / Pension | 0% | Retained inside wrapper |

---

## UI Components

- **Map/Projection toggle** in header — segmented control switches between mind map and projection view
- **Stacked area chart** — Recharts ComposedChart with property (blue), shares (purple), super (green), cash (amber), vehicle (gray), other (pink) areas
- **Liabilities area** — red, renders below zero line
- **Net worth line** — dashed white/black line overlaid
- **Expenses line** — orange dashed line
- **Milestone markers** — vertical dashed lines with labels (retirement, debt-free, super accessible, goals)
- **Summary strip** — 4 clickable metric cards: Net Worth at Retirement, Super at Retirement, Years to Debt Free, Final Net Worth
- **Detail panel** — right-side panel showing per-asset/liability breakdowns when a summary card is clicked
- **Settings panel** — gear icon, accordion sections: Global, Client, Asset Returns (per-asset with Total Return + Income Yield + PPR toggle), Liabilities, Ongoing Expenses, Lump Sum Expenses
- **AI badges** — purple "AI" labels on overridden values with reason text

---

## Key Files

| File | Purpose |
|------|---------|
| `shared/types.ts` | All projection TypeScript interfaces |
| `client/src/utils/projectionDefaults.ts` | Default rates, PPR detection, retirement risk shift |
| `client/src/utils/projectionEngine.ts` | Core calculation engine (pure function) |
| `client/src/components/projection/ProjectionView.tsx` | Container (lazy-loaded) |
| `client/src/components/projection/ProjectionChart.tsx` | Recharts chart |
| `client/src/components/projection/ProjectionSummaryStrip.tsx` | Summary metric cards |
| `client/src/components/projection/ProjectionSettingsPanel.tsx` | Editable settings UI |
| `client/src/components/projection/ProjectionDetailPanel.tsx` | Per-card detail breakdowns |
| `server/src/routes/projection.ts` | AI settings endpoint |
| `server/src/schema/projectionSettings.ts` | Zod validation |
| `server/src/prompts/generateProjectionSettings.ts` | Claude system prompt |

---

## Not Yet Modelled

- **Capital Gains Tax (CGT)**: Requires cost base tracking per asset, 50% discount rules, and marginal tax rate tables
- **Non-concessional contributions**: Only concessional (SG + salary sacrifice) modelled
- **Transition to Retirement (TTR) pensions**: Pension phase used but no TTR-specific rules
- **Centrelink income test**: Age Pension uses assets test only (typically the binding constraint)
- **Deeming rates**: Simplified — uses assets test thresholds directly
- **Social security interaction**: No rent assistance, health care card, etc.
- **Tax offsets**: No SAPTO, LITO, etc.
