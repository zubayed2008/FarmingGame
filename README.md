# Sunny Acres

Sunny Acres is a small, local-first browser farming game. Plant rice, wheat, carrots, and tomatoes; raise cows and goats; and care for dogs and cats. Progress is saved in the browser, so no account or server is required.

## Commands

```sh
npm install
npm run dev
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run preview
```

## Planning documents

- [implementation-plan.md](./implementation-plan.md) — phases, rules, and acceptance criteria.
- [infrastructure.md](./infrastructure.md) — architecture, state model, persistence, and deployment.

## Notes

- Progress is stored in `localStorage` under `sunny-acres:save`.
- Clearing browser site data removes the save.
- Play in one tab at a time; multiple open tabs each autosave and the most recent write wins.
- The production build in `dist/` can be hosted on any static file server.
