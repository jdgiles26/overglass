# OverGlass Rebuild Plan

## Audit Findings (Confirmed)

1. **`@huggingface/transformers` is a dead dependency** — tries to download 1GB+ models, fails silently, never used
2. **Three.js (`three`, `@react-three/fiber`, `@react-three/drei`) imported but unused** — globe view is a placeholder
3. **Zero real AI/ML** — the `analyst` and `cv-agent` views are placeholders; `analyzeData()` in `utils/analysis.ts` is if/else string templates
4. **Globe view is "Coming soon"** — Three.js deps are installed for nothing
5. **No CSS framework** — uses raw Tailwind-like classes but no Tailwind is configured
6. **Terminal view** has broken state (`const [input, setInput] = ''` — no useState import)
7. **Chat panel** code exists in types/store but UI was stripped out
8. **No error boundaries** anywhere
9. **21MB node_modules bloat** from unused deps (transformers WASM alone)

## Rebuild Strategy

### Phase 1: Clean House
- Remove `@huggingface/transformers`, `three`, `@react-three/fiber`, `@react-three/drei` from package.json
- Delete node_modules, reinstall (should drop from ~21MB to ~8MB)
- Fix the broken Terminal view (missing useState)
- Remove dead CSS in index.html (duplicated from index.css)

### Phase 2: Real CSS Architecture  
- Install Tailwind CSS v4 properly
- Set up proper design tokens (colors, spacing, typography)
- Create reusable component styles

### Phase 3: Real Features
- **Globe View**: Use a lightweight SVG world map (no Three.js needed) with proper data-driven markers
- **Analyst View**: Build a real queryable analytics panel — charts, filters, data tables powered by the existing data model
- **CV Agent View**: Show real CV data from the video feeds — object detection breakdowns, confidence distributions, model comparison
- **Terminal**: Fix the broken view, add real command processing using the existing `analyzeData()` function
- **Chat Panel**: Rebuild as a floating analysis assistant that calls `analyzeData()`
- **Error Boundaries**: Wrap each view

### Phase 4: Polish
- Keyboard shortcuts already work (useShortcuts.ts) — verify they work after rebuild
- Add loading states
- Add sparkline charts for metrics history (using recharts, already installed)
- Responsive design improvements
- Performance: memoize expensive computations

## Architecture

```
src/
├── App.tsx          — Shell with sidebar + error boundary
├── main.tsx         — Entry point
├── index.css        — Tailwind base + custom tokens
├── types.ts         — (keep) Domain types
├── data.ts          — (keep) Seed data
├── store.ts         — (keep) Zustand store
├── hooks/
│   └── useShortcuts.ts  — (keep, fix duplicate auto-refresh)
├── utils/
│   └── analysis.ts  — (keep) Data analysis engine
├── components/
│   ├── ErrorBoundary.tsx
│   ├── StatusBadge.tsx
│   ├── MetricCard.tsx
│   └── Sparkline.tsx
└── views/
    ├── Dashboard.tsx
    ├── Globe.tsx          — SVG-based world map
    ├── Connectors.tsx
    ├── Video.tsx
    ├── Analyst.tsx        — Real analytics with charts
    ├── CVAgent.tsx        — CV data explorer
    ├── Alerts.tsx
    ├── Pipeline.tsx
    ├── Terminal.tsx       — Fixed + functional
    └── Settings.tsx
```

## Execution Order
1. Phase 1 (clean deps, fix bugs)
2. Phase 2 (Tailwind setup)  
3. Phase 3 (extract components, build real views)
4. Phase 4 (polish, verify)
