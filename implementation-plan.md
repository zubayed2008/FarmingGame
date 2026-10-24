# Sunny Acres — Implementation Plan

## 1. Product goal

Build **Sunny Acres**, a small, single-player farming game with a relaxed FarmVille-style loop. The player plants and harvests crops, raises livestock, cares for pets, and earns coins.

This is a playable MVP, not a social or online service. Use [infrastructure.md](./infrastructure.md) for architecture and commands.

### Player experience

1. Start with 100 coins, six empty plots, and one wheat seed.
2. Select a seed, plant it in an empty plot, then water it.
3. Wait for growth; harvest it into inventory.
4. Sell harvested goods for coins.
5. Buy a cow or goat, feed it, and collect milk after its timer.
6. Adopt a dog or cat, feed it, and pet it to restore happiness.
7. Leave and return without losing progress; capped offline progress is applied.

### MVP content

| Type | Content | Interaction | Output / purpose |
| --- | --- | --- | --- |
| Crops | Rice, wheat, carrot, tomato | Plant, water, wait, harvest | Sellable produce |
| Livestock | Cow, goat | Buy, feed, wait, collect | Cow milk or goat milk |
| Pets | Dog, cat | Adopt, feed, pet | Happiness and companionship |

Pets do not produce goods. Do not add breeding, combat, crop bonuses, quests, or byproducts until the MVP is complete.

## 2. Scope boundaries

### Included

- One fixed farm screen with a rotatable, zoomable 3D camera; no character movement or pathfinding.
- Six crop plots and four animal spaces, shared by livestock and pets.
- Coins, inventory, shop, growth, production, and pet happiness.
- Clear selected-tool and disabled-action feedback.
- Versioned local saves, autosave, confirmed reset, and offline progress.
- Simple shapes/CSS or original placeholder sprites; no external art required.
- Unit tests for rules and a small browser smoke test.

### Excluded

Accounts, multiplayer, chat, payments, ads, premium currency, backend services, procedural maps, seasons, weather, crafting, buildings, decorations, sound, complex animation, and free-form placement.

## 3. Core rules and balancing

Use epoch milliseconds for timestamps and milliseconds for durations. Never advance timers per rendered frame.

| Crop | Seed cost | Growth after watering | Yield | Sale price each |
| --- | ---: | ---: | ---: | ---: |
| Wheat | 5 coins | 20 seconds | 2 wheat | 5 coins |
| Carrot | 8 coins | 30 seconds | 2 carrots | 8 coins |
| Rice | 12 coins | 45 seconds | 2 rice | 12 coins |
| Tomato | 18 coins | 60 seconds | 3 tomatoes | 12 coins |

- Buying a seed deducts coins and adds one seed to inventory.
- Planting consumes one seed and creates a dry crop.
- Only watered crops grow. Watering is free with no cooldown.
- Harvesting clears a ripe plot and adds its yield.
- Selling one unit uses the configured price. Add “sell all” only after basic selling works.

| Animal | Cost | Feed cost | Production / decay | Output value |
| --- | ---: | ---: | --- | --- |
| Cow | 80 coins | 5 coins | Produces in 90 seconds | 1 cow milk, sells for 25 |
| Goat | 60 coins | 4 coins | Produces in 60 seconds | 1 goat milk, sells for 20 |
| Dog | 40 coins | 3 coins | Hunger/happiness fall 1/minute | None |
| Cat | 40 coins | 3 coins | Hunger/happiness fall 1/minute | None |

- Buying/adopting requires coins and a free animal space.
- Feeding livestock sets hunger to 100 and starts production only when no product is ready or active. Collection adds one product and leaves the animal unfed with no active production.
- Livestock hunger falls 1 point/minute. Production advances only while hunger is above zero; livestock never die.
- Pet hunger and happiness range from 0–100 and start at 100. Feeding restores hunger; petting restores happiness. Both stats fall 1 point/minute.
- Offline progress is capped at 8 hours per return. Dry crops and unfed animals do not advance.

## 4. Implementation sequence

Complete phases in order. Keep each Cline task to one phase or numbered task.

### Phase 0 — Bootstrap and Cline context

1. Create directories/config from `infrastructure.md` as needed; avoid empty placeholders.
2. Add project rules and a verification workflow under `.clinerules/`.
3. Install dependencies; prove the empty app builds and tests run.
4. Add a README command summary after scripts exist.

**Done when:** the dev server shows a page and build, type-check, and unit-test commands pass.

### Phase 1 — Domain model and pure simulation

1. Define crop, animal, inventory, plot, and game-state types.
2. Put all balancing values in `src/game/data.ts`; do not duplicate values in UI.
3. Implement a new-game factory with 100 coins and one wheat seed.
4. Implement pure actions: buy seed, plant, water, harvest, sell, buy/adopt, feed, collect, and pet.
5. Return structured results such as `{ state, ok, message }`; rejected actions do not mutate state.
6. Implement `advanceTime(state, now)` with clamped delta, crop growth, production, and stat decay. Handle long elapsed periods without frame-by-frame loops.
7. Test every action, insufficient funds, capacity, timestamps, invalid transitions, and offline cap.

**Done when:** the game can be exercised in tests without Canvas or the DOM.

### Phase 2 — Playable farming loop

1. Build semantic DOM panels for coins, shop, inventory, selected tool, and messages.
2. Render a Three.js farm scene: lit grass field, six raised soil plots, barn, fence, paddock, trees, pond, and path.
3. Pick plots with a Raycaster and distinguish clicks from camera drags.
4. Add seed selection and plot actions: empty plots plant; dry crops water; ripe crops harvest.
5. Provide an accessible DOM button/list alternative for every 3D plot action.
6. Show crop growth with 3D models plus ripe/water badges; do not rely on color alone.
7. Add shop and inventory selling; disable unaffordable purchases.
8. Drive 3D animation with `requestAnimationFrame`, while simulation uses elapsed timestamps.

**Done when:** a player can buy wheat, plant, water, wait, harvest, and sell without reloading.

### Phase 3 — Livestock and pets

1. Render four labeled animal spaces and a details/action panel.
2. Add cow, goat, dog, and cat purchase buttons with capacity checks.
3. Add feed, collect, and pet actions with status text and disabled states.
4. Add livestock readiness and pet hunger/happiness meters.
5. Add milk to inventory and connect it to selling.
6. Test capacity, feeding while busy, collection, hunger pause, and stat bounds.

**Done when:** all four animals can be owned and their complete basic loops work.

### Phase 4 — Persistence and offline progress

1. Add a versioned save envelope and runtime validation at the storage boundary.
2. Load a valid save or create a new game; never crash on malformed storage.
3. Save after successful actions, on a throttled interval, and when the page is hidden.
4. On load, apply at most 8 hours of elapsed progress and persist the result.
5. Add a reset button with confirmation. Do not silently reset a corrupt save.
6. Test round trips, missing fields, wrong types, unsupported versions, and storage failures.

**Done when:** refresh and a later return preserve progress; reset and bad-save recovery are understandable.

### Phase 5 — Responsive polish and accessibility

1. Arrange farm and side panels for narrow and wide screens without horizontal overflow.
2. Add visible keyboard focus, labels, sufficient contrast, and touch targets of at least 44 CSS px.
3. Announce action results with a polite live region; do not announce every timer tick.
4. Respect `prefers-reduced-motion`; animation is optional.
5. Replace placeholders only with optimized local assets and useful alt text where applicable.
6. Add empty-state guidance and a short “How to play” panel.

**Done when:** keyboard-only and mobile users can perform every action, and feedback is not color-only.

### Phase 6 — Verification and release

1. Run type-check, unit tests, production build, and browser tests.
2. Manually test a fresh game, full farming cycle, each animal, refresh, offline return, and reset.
3. Test at narrow mobile and desktop widths and with keyboard navigation.
4. Serve `dist/` with the preview command and confirm there are no console errors.
5. Deploy the static output and document the URL and commands in the README.

## 5. Test checklist

### Unit tests

- New-game defaults and deterministic IDs.
- Seed purchases, planting consumption, watering, growth thresholds, yields, and selling.
- Rejection for insufficient coins/items, occupied plots, unripe harvest, and invalid IDs.
- Cow/goat feeding, production, hunger pause, collection, and milk value.
- Dog/cat feeding, petting, and hunger/happiness clamped to 0–100.
- Animal-space capacity and rejection without partial coin deduction.
- Zero/negative/huge elapsed time, exact thresholds, and 8-hour offline cap.
- Save round trip and malformed/unsupported saves.

### Browser smoke tests

- Start a new game and complete a wheat cycle using controlled time.
- Buy a goat, feed it, advance time, collect, and sell goat milk.
- Adopt a cat and use feed/pet controls.
- Refresh and verify coins, inventory, plots, and animals persist.
- Navigate core actions with keyboard and at a mobile viewport.

## 6. MVP acceptance criteria

- All four crops and all four animals are implemented with the rules above.
- The player can earn coins through both crops and livestock.
- Invalid actions explain why and never partially modify state.
- Timers work across refresh and offline returns, with the 8-hour cap.
- There is one obvious way to select and perform each action.
- Every gameplay action works by mouse/touch and keyboard-accessible DOM controls.
- No network connection is needed after the static app and assets load.
- Automated checks pass and no browser console errors occur during the smoke path.

## 7. Suggested first Cline prompts

1. “Read `implementation-plan.md` and `infrastructure.md`. Implement Phase 0 only, then run the verification commands.”
2. “Implement Phase 1. Keep rules pure and complete the listed unit tests; do not build UI yet.”
3. “Implement Phase 2 using the existing domain API. Verify a full wheat cycle.”
4. “Implement Phase 3, then Phase 4 separately, running the checks after each phase.”

After the MVP is verified, consider expansions one at a time: more plots, animal pens, crafting, quests, sound, unlocks, or cloud saves. Revisit the plan before adding any of them.
