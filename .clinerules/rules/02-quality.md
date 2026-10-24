# Sunny Acres quality rules

- Test success and rejection paths for domain changes.
- Run `npm run typecheck`, `npm run test`, and `npm run build` before reporting completion.
- Run `npm run test:e2e` for UI or interaction changes when possible.
- Never claim a check passed unless its command actually ran.
- Do not commit secrets; none are needed for local play.
- Keep browser console output free of errors and warnings.
