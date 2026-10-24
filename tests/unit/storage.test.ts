import { describe, expect, it } from "vitest";
import { CROPS, OFFLINE_CAP_MS } from "../../src/game/data";
import { createNewGame } from "../../src/game/state";
import type { GameState } from "../../src/game/types";
import {
  BACKUP_KEY_PREFIX,
  SAVE_KEY,
  loadGame,
  parseSave,
  resetGame,
  saveGame,
  type StorageLike
} from "../../src/persistence/storage";

const NOW = 2_000_000_000;

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failReads = false;
  failWrites = false;

  getItem(key: string): string | null {
    if (this.failReads) {
      throw new Error("read blocked");
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error("write blocked");
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function stateWithProgress(): GameState {
  const state = createNewGame(NOW);
  return {
    ...state,
    coins: 42,
    inventory: { wheatSeed: 3, wheat: 2 },
    plots: state.plots.map((plot) =>
      plot.id === 0
        ? { id: 0, crop: { species: "wheat" as const, watered: true, growthMs: 5000 } }
        : plot
    )
  };
}

describe("save and load", () => {
  it("round trips a valid save", () => {
    const storage = new MemoryStorage();
    const state = stateWithProgress();
    expect(saveGame(storage, state, NOW)).toEqual({ ok: true });

    const loaded = loadGame(storage, NOW);
    expect(loaded.status).toBe("loaded");
    expect(loaded.state.coins).toBe(42);
    expect(loaded.state.inventory.wheat).toBe(2);
    expect(loaded.state.plots[0]?.crop?.growthMs).toBe(5000);
  });

  it("applies capped offline progress on load", () => {
    const storage = new MemoryStorage();
    saveGame(storage, stateWithProgress(), NOW);

    const loaded = loadGame(storage, NOW + OFFLINE_CAP_MS * 4);
    expect(loaded.state.plots[0]?.crop?.growthMs).toBe(CROPS.wheat.growthMs);
    expect(loaded.state.lastTickAt).toBe(NOW + OFFLINE_CAP_MS * 4);
  });

  it("keeps a backup and starts fresh when JSON is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, "{not json");

    const loaded = loadGame(storage, NOW);
    expect(loaded.status).toBe("recovered");
    expect(loaded.warning).toContain("could not be loaded");
    expect(storage.getItem(`${BACKUP_KEY_PREFIX}${NOW}`)).toBe("{not json");
    expect(loaded.state.coins).toBe(100);
  });

  it("rejects saves whose state fails validation", () => {
    const storage = new MemoryStorage();
    const invalid = { version: 1, savedAt: NOW, state: { ...createNewGame(NOW), coins: "lots" } };
    storage.setItem(SAVE_KEY, JSON.stringify(invalid));

    expect(parseSave(storage.getItem(SAVE_KEY)).ok).toBe(false);
    expect(loadGame(storage, NOW).status).toBe("recovered");
  });

  it("preserves a future-version save without overwriting it", () => {
    const storage = new MemoryStorage();
    const raw = JSON.stringify({ version: 99, savedAt: NOW, state: createNewGame(NOW) });
    storage.setItem(SAVE_KEY, raw);

    const loaded = loadGame(storage, NOW);
    expect(loaded.status).toBe("recovered");
    expect(loaded.warning).toContain("newer version");
    expect(storage.getItem(SAVE_KEY)).toBe(raw);
  });

  it("handles storage failures without crashing", () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    const loaded = loadGame(storage, NOW);
    expect(loaded.status).toBe("new");
    expect(loaded.warning).toContain("unavailable");

    storage.failReads = false;
    storage.failWrites = true;
    const saved = saveGame(storage, createNewGame(NOW), NOW);
    expect(saved.ok).toBe(false);
    expect(saved.message).toContain("could not be saved");
  });

  it("resets only the game key", () => {
    const storage = new MemoryStorage();
    saveGame(storage, createNewGame(NOW), NOW);
    storage.setItem("unrelated", "keep me");

    resetGame(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep me");
  });
});

describe("save validation", () => {
  it("rejects out-of-range stats and unknown items", () => {
    const storage = new MemoryStorage();
    const state = createNewGame(NOW);
    const badStat = {
      version: 1,
      savedAt: NOW,
      state: {
        ...state,
        animals: [{ id: 1, kind: "pet", species: "dog", hunger: 150, happiness: 10 }],
        nextAnimalId: 2
      }
    };
    storage.setItem(SAVE_KEY, JSON.stringify(badStat));
    expect(parseSave(storage.getItem(SAVE_KEY)).ok).toBe(false);

    const badItem = { version: 1, savedAt: NOW, state: { ...state, inventory: { unicorn: 4 } } };
    storage.setItem(SAVE_KEY, JSON.stringify(badItem));
    expect(parseSave(storage.getItem(SAVE_KEY)).ok).toBe(false);
  });

  it("rejects a plot id mismatch and too many animals", () => {
    const state = createNewGame(NOW);
    const storage = new MemoryStorage();
    const badPlot = {
      version: 1,
      savedAt: NOW,
      state: { ...state, plots: state.plots.map((plot, index) => ({ ...plot, id: index + 1 })) }
    };
    storage.setItem(SAVE_KEY, JSON.stringify(badPlot));
    expect(parseSave(storage.getItem(SAVE_KEY)).ok).toBe(false);

    const tooMany = {
      version: 1,
      savedAt: NOW,
      state: {
        ...state,
        animals: Array.from({ length: 5 }, (_, index) => ({
          id: index + 1,
          kind: "pet" as const,
          species: "dog" as const,
          hunger: 50,
          happiness: 50
        })),
        nextAnimalId: 6
      }
    };
    storage.setItem(SAVE_KEY, JSON.stringify(tooMany));
    expect(parseSave(storage.getItem(SAVE_KEY)).ok).toBe(false);
  });

  it("accepts fractional decay values inside valid bounds", () => {
    const storage = new MemoryStorage();
    const state = createNewGame(NOW);
    const valid = {
      version: 1,
      savedAt: NOW,
      state: {
        ...state,
        animals: [{ id: 1, kind: "pet", species: "cat", hunger: 79.5, happiness: 0.25 }],
        nextAnimalId: 2
      }
    };
    storage.setItem(SAVE_KEY, JSON.stringify(valid));
    const parsed = parseSave(storage.getItem(SAVE_KEY));
    expect(parsed.ok).toBe(true);
    expect(parsed.state?.animals[0]?.hunger).toBe(79.5);
  });
});
