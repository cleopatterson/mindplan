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

TypeScript checks (no top-level tsconfig, check each workspace):
```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

## Architecture Decisions

### Data Flow
Upload → text extraction → Claude API (tool use + Zod schema) → gap enrichment → anonymization → JSON response → ReactFlow mind map

### Mind Map Layout
- Dagre runs twice: RL for left side (clients/entities/assets), LR for right side (estate/family)
- Both sides stitched at the central family node, then top-aligned
- Left-side nodes are right-aligned, right-side nodes are left-aligned (rank-based)
- Node widths are FIXED (`w-[Xpx]`) and must match `NODE_WIDTH` constants in `useGraphLayout.ts`

### Edge Types
- **Structural edges**: dagre-layouted parent→child connections
- **Cross-links** (`data.isCrossLink`): joint asset ownership, excluded from dagre, styled like structural edges
- **User links** (`data.isUserLink`): manually drawn by users, purple dashed, removable via double-click

### Anonymization
- Runs server-side after gap enrichment (in `parse.ts`)
- Only strips surnames from person-name fields (clients, family members, estate contacts, individual trustees)
- Entity names, asset names, liability names are left untouched

### Gap System
- Server-side `enrichGaps()` detects critical missing data only: client ages, asset values, liability amounts
- Deduplication uses `nodeId::field` key (not description strings)
- Client-side `resolveGap()` uses `nodeId` for precise field targeting across all node types

### Summary Bar
- Asset allocation groups `managed_fund` + `shares` together as "Shares"
- Debt ratio color-coded: green <30%, amber 30-50%, red >50%

## Conventions

- All node components use `React.memo` and fixed widths matching dagre constants
- `data.side` on nodes: `'left'` | `'right'` | `'center'`
- Performance timing logs use `⏱` prefix (server and client)
- The app uses `select-none` globally to prevent text selection on shift-click
- Zod validation uses `safeParse` (not `parse`) for clean error messages
