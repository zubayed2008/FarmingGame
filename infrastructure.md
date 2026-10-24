# Sunny Acres — Infrastructure and Architecture

## 1. Technical direction

Sunny Acres is a static, local-first 3D browser game. Use **TypeScript + Vite + Three.js (WebGL) + semantic DOM controls**. Three.js renders the farm; DOM provides shop, inventory, status, and accessible alternatives to 3D interactions.

No backend is required for the MVP. Saves live in `localStorage`. Do not add a game engine, state-management library, UI framework, database, or asset pipeline without a later requirement.

### Dependencies

- Runtime: `three`.
- Development: `vite`, `typescript`, `vitest`, `@playwright/test`, `@types/three`, and `jsdom` only if DOM tests need it.
- Package manager: npm; commit `package-lock.json`.
- Target: current evergreen desktop and mobile browsers.

## 2. Repository structure

Create files as implementation reaches each phase; do not generate empty placeholder modules.

```text
BrowserGame/
├── .clinerules/
│   ├── rules/
│   │   ├── 01-project.md       # Scope, architecture, naming, style
│   │   └── 02-quality.md       # Testing and verification requirements
│   └── workflows/
│       └── verify.md           # Repeatable checks for Cline
├── public/
│   ├── favicon.svg
│   └── assets/                 # Optional local sprites; no remote dependencies
├── src/
│   ├── main.ts                 # Composition root only
│   ├── styles.css
│   ├── game/
│   │   ├── types.ts            # Save/domain types and unions
│   │   ├── data.ts             # All crop/animal balancing values
│   │   ├── state.ts            # New game and action results
│   │   ├── actions.ts          # Pure player commands
│   │   ├── simulation.ts       # Elapsed-time/offline progression
│   │   └── selectors.ts        # Derived UI values; no mutation
│   ├── render/
│   │   └── scene3d.ts          # Three.js world, models, raycasting, animation
│   ├── ui/
│   │   ├── app.ts              # Screen orchestration
│   │   ├── panels.ts           # Shop/inventory/animal controls
│   │   └── accessibility.ts    # Equivalent non-Canvas controls
│   └── persistence/
│       ├── storage.ts          # Load/save/reset and validation boundary
│       └── migrations.ts       # Explicit save-version upgrades
├── tests/
│   ├── unit/                   # Vitest; mirrors tested modules
│   └── e2e/
│       └── farming.spec.ts     # Playwright critical-path test
├── index.html
├── package.json
├── package-lock.json
├── playwright.config.ts
├── tsconfig.json
├── vite.config.ts
├── implementation-plan.md
├── infrastructure.md
└── README.md
```

`main.ts` wires dependencies; it must not contain game rules. UI/rendering may import domain functions, never the reverse. Avoid circular imports and global mutable state.

## 3. Cline operating rules

Put this guidance in `.clinerules/rules/01-project.md`:

- Read both root planning documents before changing code.
- Implement the current phase only; ask before expanding MVP scope.
- Use TypeScript strict mode, named exports, and small pure functions.
- Keep game rules in `src/game/` and all prices/durations in `data.ts`.
- Never advance timers by frame count or read wall time inside pure rules; inject `now`.
- Never mutate input state in actions or simulation.
- Provide accessible DOM controls for every Canvas action.
- Prefer original/local assets and placeholders over external asset URLs.
- Update tests and documentation when behavior or commands change.

Put this in `02-quality.md`:

- Test success and rejection paths for domain changes.
- Run type-check, unit tests, and build before reporting completion.
- Run relevant browser tests for UI changes when possible.
- Never claim a check passed unless its command actually ran.
- Do not commit secrets; none are needed for local play.

`.clinerules/workflows/verify.md` should instruct Cline to run `npm run typecheck`, `npm run test`, and `npm run build`, then summarize changed files and unrun checks. Add `npm run test:e2e` for browser changes.

## 4. Bootstrap commands and scripts

Run from the repository root after creating `package.json` and initial config:

```sh
npm install
npm install -D vite typescript vitest @playwright/test
npx playwright install chromium
```

Use these npm scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Enable `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, and `noImplicitOverride`. Use bundler module resolution, ES2022 or newer, DOM types, and no TypeScript emit. Separate Vitest and Playwright test directories so runners do not execute each other's tests.

## 5. State and time model

Use one serializable root object. Do not store class instances, functions, DOM nodes, `Map`, or `Set` in the save.

```ts
type ItemId =
  | "wheatSeed" | "carrotSeed" | "riceSeed" | "tomatoSeed"
  | "wheat" | "carrot" | "rice" | "tomato"
  | "cowMilk" | "goatMilk";
type Species = "wheat" | "carrot" | "rice" | "tomato";

interface GameState {
  version: 1;
  coins: number;
  inventory: Partial<Record<ItemId, number>>;
  plots: Plot[];
  animals: Animal[];
  nextAnimalId: number;
}

type Plot =
  | { id: number; crop: null }
  | { id: number; crop: {
      species: Species;
      watered: boolean;
      growthMs: number;
    } };
```

Use separate livestock and pet variants in a discriminated `Animal` union. Livestock records contain `id`, `kind: "cow" | "goat"`, hunger, accumulated production time, `productionActive`, and `productReady`. Pet records contain `id`, `kind: "dog" | "cat"`, hunger, and happiness. Feeding is an immediate coin-cost action; there is no separate feed inventory in the MVP.

### Simulation contract

- Domain actions receive current state and explicit arguments; simulation also receives `now`.
- Return new state rather than mutating input. Derived time remaining belongs in selectors.
- At startup, compute `elapsed = clamp(now - savedAt, 0, 8 hours)`. Treat non-finite timestamps as invalid saves and negative elapsed time as zero.
- Advance crops by at most their remaining growth time. Advance livestock only while hunger is positive and production is active; stop at product readiness.
- Apply hunger/happiness decay deterministically and clamp stats to 0–100. Document and test processing order at timestamp boundaries.
- `requestAnimationFrame` requests redraws only. Use `Date.now()` at the app boundary, not frame counts, for elapsed time.
- Do not run a permanent high-frequency timer while the page is hidden. Save on `visibilitychange` and reconcile on return.

## 6. Persistence

Use one key, `sunny-acres:save`, with a small envelope:

```ts
interface SaveEnvelope {
  version: 1;
  savedAt: number;
  state: GameState;
}
```

`savedAt` is the single authoritative wall-clock timestamp for offline progress. Update it whenever a save is written.

- Serialize with `JSON.stringify`; parse inside `try/catch`.
- Validate parsed data at runtime: TypeScript types alone cannot validate storage. Check version, finite nonnegative numbers, integer quantities/IDs, allowed enum values, plot/animal capacity, and stat bounds.
- Route old supported versions through pure migrations. Reject future versions without overwriting them.
- On corrupt data, preserve the original value under a timestamped backup key when possible, show a recovery message, and require confirmation before starting over.
- Autosave after successful actions and at most once every 5 seconds for elapsed progress. Save on page hide.
- Catch quota/security errors and show “Progress could not be saved”; gameplay may continue in memory.
- Reset removes only this game's keys after explicit confirmation. Never call `localStorage.clear()`.

This storage is convenience, not security. Players can edit local saves; do not add anti-cheat infrastructure to a local-only game.

## 7. UI, rendering, and assets

- Keep a single state owner in `ui/app.ts`. Dispatch an action, replace state on success, persist, render, and show its message.
- Use event delegation and cleanup listeners when replacing UI. Never inject save-derived strings with `innerHTML`; use `textContent`.
- Own the Three.js renderer, scene, camera, controls, and animation loop inside `render/scene3d.ts`. Dispose geometries, materials, the timer, and the renderer when the scene is torn down.
- Size the WebGL canvas from its container, cap `devicePixelRatio` at 2, and update the camera aspect on resize.
- Pick plots with a `Raycaster` against invisible hit meshes, and ignore drag gestures by comparing pointer-down and pointer-up distance.
- Use actual `<button>`, `<progress>`, headings, and lists in DOM panels. Every 3D plot/animal action needs an equivalent DOM control.
- Give icon-only buttons accessible names. Use a polite live region for completed actions, not continuous timer updates.
- Provide visible focus, 44px touch targets, contrast, reduced-motion support, and labels beyond color.
- Start with drawn shapes/emoji only if platform-independent presentation is not required. Prefer simple original SVG/PNG sprites stored under `public/assets/`; include license/source notes for third-party assets.
- Reference public assets with URLs that respect Vite's configured `base`; do not depend on remote image hosts.

## 8. Testing and quality gates

### Vitest

Test pure domain and persistence modules with explicit timestamps. Cover success, rejection, exact timer boundaries, long offline intervals, and malformed saves. Avoid sleeping in tests. Use an in-memory storage fake for storage tests.

### Playwright

Use Chromium for the required smoke suite; add Firefox/WebKit later if needed. Start Vite through Playwright `webServer`. Use role/label-based locators, not CSS implementation details. Control browser time with Playwright's clock support or an injected app clock; do not make tests wait 20–90 real seconds.

Required local gates:

```sh
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

For a quick static smoke check, run `npm run preview` and open the shown local URL. Check the browser console and a mobile viewport before release.

## 9. Build and deployment

The production artifact is `dist/`, generated by `npm run build`. Deploy it to any static host; there are no environment variables, server routes, API keys, or secrets.

- For a root domain, Vite's default base is sufficient.
- For GitHub Pages under a repository subpath, configure Vite `base` as `/REPOSITORY_NAME/` and test asset loading at that path.
- Do not add SPA rewrites unless client-side routing is introduced; the MVP has one page.
- Keep CI simple: checkout, setup the active Node LTS, `npm ci`, install Chromium with dependencies when needed, then run the four gates above. Upload Playwright failure artifacts when available.

## 10. Operational limits and future changes

The MVP has no server backup or cross-device sync. Clearing site data can remove saves; say so in the README. Optional export/import of a validated JSON save is a safer first enhancement than accounts.

Add a backend only for a confirmed feature such as cloud saves or multiplayer. That would require a separate API/auth design, server-authoritative validation, environment/secret management, and a revised data model; it is deliberately outside this infrastructure.
