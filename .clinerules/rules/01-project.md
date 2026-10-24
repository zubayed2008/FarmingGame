# Sunny Acres project rules

- Read `implementation-plan.md` and `infrastructure.md` before changing code.
- Implement the current phase only; ask before expanding MVP scope.
- Use TypeScript strict mode, named exports, and small pure functions.
- Keep game rules in `src/game/` and all prices/durations in `src/game/data.ts`.
- Keep all Three.js renderer, scene, model, and input code inside `src/render/scene3d.ts`.
- Never advance timers by frame count or read wall time inside pure rules; inject `now` or elapsed time.
- Never mutate input state in actions or simulation. Return a new state.
- Provide accessible DOM controls for every Canvas action.
- Prefer original or local assets over external asset URLs.
- Update tests and documentation when behavior or commands change.
