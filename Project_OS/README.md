# Project OS

AI-powered IDE that visualizes your codebase as a function map, tracks agent execution flows, and provides intelligent code understanding.

## Structure

```
ProjectOS/
├── app/      # Full product codebase (Demo → M1 → M2 → M3)
├── mvp/      # Standalone runnable Demo MVP
└── sample/   # Sample Next.js project for testing analysis
```

### app/

The complete roadmap codebase structured for incremental milestone delivery:

- **Demo** (real): Static analysis engine — file scanning, route detection, import parsing, heuristic clustering, edge inference, graph builder
- **M1** (stubs): Context building, incremental re-index, file watcher
- **M2** (stubs): Prompt understanding, agent execution, agent flow tracking
- **M3** (stubs): Error parsing, debug context, automated bug fix, cloud auth, LLM proxy

Full Cursor-style dark IDE layout with Function Map (ReactFlow), Agent Flow timeline, Node Inspector, AI Chat sidebar, and Terminal panel.

### mvp/

A minimal runnable version — open a Next.js project, analyze its structure, and visualize functional clusters on an interactive graph.

### sample/

A Next.js App Router SaaS starter (login, dashboard, profile, settings, API routes, Prisma) designed to produce a meaningful function map with 5-6 nodes.

## Quick Start

```bash
# Run the MVP
cd mvp
npm install
npm run dev

# Or run the full app
cd app
npm install
npm run dev
```

Click **Open Project** and point it at the `sample/` folder (or any Next.js project).

## Tech Stack

- **Electron** + **React** + **TypeScript** + **Vite** (via electron-vite)
- **@xyflow/react** (React Flow v12) for graph visualization
- IPC communication via contextBridge + preload pattern
- Heuristic-based feature clustering (no LLM required for Demo)

## Team

- **Ray** — System / AI / Structure Engine (mainlines B, C, D)
- **Terran** — Product / UI / IDE Shell (mainline A)
