# MindPlan

Financial structure visualiser that transforms financial planning documents into interactive mind maps. Upload a PDF, Word, or text file and get an instant visual breakdown of clients, entities, assets, liabilities, estate planning, and family hierarchy.

## Architecture

Monorepo with three workspaces:

```
shared/     Shared TypeScript types (FinancialPlan, Client, Entity, Asset, etc.)
server/     Express API — file upload, text extraction, Claude AI parsing, gap detection
client/     React + Vite — mind map (ReactFlow), detail panels, summary bar, PDF export
```

### Pipeline

1. **Upload** — Client sends PDF/DOCX/TXT via multipart form to `/api/parse`
2. **Extract** — Server extracts text using `pdf-parse` or `mammoth`
3. **Parse** — Claude API (tool use with Zod schema) returns structured `FinancialPlan`
4. **Enrich** — Server-side gap detection flags missing critical data (ages, values, amounts)
5. **Anonymize** — Surnames stripped from person-name fields for privacy
6. **Render** — Client transforms data into a dagre-layouted ReactFlow mind map

### Mind Map Layout

- **Center**: Family node
- **Left side** (RL): Clients → Entities → Assets/Liabilities
- **Right side** (LR): Estate Planning, Family Members
- Both sides top-aligned, left-side nodes right-aligned, right-side nodes left-aligned
- Cross-links for joint asset ownership rendered as structural edges

## Development

```bash
npm install
npm run dev          # Runs server (tsx watch) + client (Vite) concurrently
```

Requires a `.env` file at the root with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

Optional env vars:
- `CLAUDE_MODEL` — override the Claude model (default: `claude-sonnet-4-5-20250929`)
- `PORT` — server port (default: 3001)

## Deployment

Configured for Railway via `railway.json`. Build runs `npm run build` across all workspaces; start runs the Express server which also serves the built client as static files. Railway uses `/api/health` as the healthcheck endpoint.

```bash
npm run build        # Build shared → client → server
npm start            # Start production server
```

## Key Files

| File | Purpose |
|------|---------|
| `server/src/routes/parse.ts` | Upload endpoint, orchestrates pipeline |
| `server/src/services/claude.ts` | Claude API call with Zod-validated tool use |
| `server/src/services/validator.ts` | Server-side gap detection (critical fields only) |
| `server/src/services/anonymize.ts` | Strips surnames from person-name fields |
| `client/src/utils/transformToGraph.ts` | Converts `FinancialPlan` → ReactFlow nodes/edges |
| `client/src/hooks/useGraphLayout.ts` | Dagre layout with left/right side stitching |
| `client/src/hooks/useFinancialData.ts` | Central state hook (data, selection, gaps, links) |
| `client/src/components/Dashboard.tsx` | Main layout — map, summary bar, detail panel |
| `shared/types.ts` | All shared TypeScript interfaces |
