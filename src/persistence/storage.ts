import {
  ANIMAL_CAPACITY,
  CROPS,
  LIVESTOCK,
  MAX_STAT,
  OFFLINE_CAP_MS,
  PLOT_COUNT
} from "../game/data";
import { advanceTime } from "../game/simulation";
import { createNewGame } from "../game/state";
import {
  CROP_SPECIES,
  ITEM_IDS,
  LIVESTOCK_SPECIES,
  PET_SPECIES,
  type Animal,
  type CropSpecies,
  type GameState,
  type ItemId,
  type LivestockSpecies,
  type PetSpecies
} from "../game/types";
import { CURRENT_SAVE_VERSION, migrateSave } from "./migrations";

export const SAVE_KEY = "sunny-acres:save";
export const BACKUP_KEY_PREFIX = "sunny-acres:save-backup-";

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface SaveEnvelope {
  version: number;
  savedAt: number;
  state: GameState;
}

export interface LoadResult {
  state: GameState;
  status: "new" | "loaded" | "recovered";
  warning?: string;
}

export interface SaveResult {
  ok: boolean;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isStat(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= MAX_STAT;
}

function isCropSpecies(value: unknown): value is CropSpecies {
  return typeof value === "string" && (CROP_SPECIES as readonly string[]).includes(value);
}

function isLivestockSpecies(value: unknown): value is LivestockSpecies {
  return typeof value === "string" && (LIVESTOCK_SPECIES as readonly string[]).includes(value);
}

function isPetSpecies(value: unknown): value is PetSpecies {
  return typeof value === "string" && (PET_SPECIES as readonly string[]).includes(value);
}

function isValidInventory(value: unknown): value is Partial<Record<ItemId, number>> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).every(
    ([key, count]) => (ITEM_IDS as readonly string[]).includes(key) && isNonNegativeInteger(count)
  );
}

function isValidCrop(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (
    !isCropSpecies(value.species) ||
    typeof value.watered !== "boolean" ||
    !isFiniteNumber(value.growthMs)
  ) {
    return false;
  }
  return value.growthMs >= 0 && value.growthMs <= CROPS[value.species].growthMs;
}

function isValidPlot(value: unknown, index: number): boolean {
  if (!isRecord(value) || value.id !== index) {
    return false;
  }
  return value.crop === null || isValidCrop(value.crop);
}

function isValidAnimal(value: unknown, seenIds: Set<number>): value is Animal {
  if (!isRecord(value) || !isNonNegativeInteger(value.id) || value.id < 1 || seenIds.has(value.id)) {
    return false;
  }

  if (value.kind === "livestock") {
    if (!isLivestockSpecies(value.species)) {
      return false;
    }
    const config = LIVESTOCK[value.species];
    if (
      !isStat(value.hunger) ||
      typeof value.productionActive !== "boolean" ||
      typeof value.productReady !== "boolean" ||
      !isFiniteNumber(value.productionMs)
    ) {
      return false;
    }
    if (value.productionMs < 0 || value.productionMs > config.productionMs) {
      return false;
    }
    seenIds.add(value.id);
    return true;
  }

  if (value.kind === "pet") {
    if (!isPetSpecies(value.species) || !isStat(value.hunger) || !isStat(value.happiness)) {
      return false;
    }
    seenIds.add(value.id);
    return true;
  }

  return false;
}

export function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.version !== CURRENT_SAVE_VERSION) {
    return false;
  }
  if (!isFiniteNumber(value.coins) || value.coins < 0 || !Number.isInteger(value.coins)) {
    return false;
  }
  if (!isValidInventory(value.inventory)) {
    return false;
  }
  if (
    !Array.isArray(value.plots) ||
    value.plots.length !== PLOT_COUNT ||
    !value.plots.every((plot, index) => isValidPlot(plot, index))
  ) {
    return false;
  }
  if (!Array.isArray(value.animals) || value.animals.length > ANIMAL_CAPACITY) {
    return false;
  }
  const seenIds = new Set<number>();
  if (!value.animals.every((animal) => isValidAnimal(animal, seenIds))) {
    return false;
  }
  const maxId = seenIds.size > 0 ? Math.max(...seenIds) : 0;
  if (!isNonNegativeInteger(value.nextAnimalId) || value.nextAnimalId <= maxId) {
    return false;
  }
  return isFiniteNumber(value.lastTickAt);
}

export function parseSave(raw: string | null): { ok: boolean; state?: GameState; message?: string } {
  if (!raw) {
    return { ok: false, message: "No save was found." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "The save file is not valid JSON." };
  }

  if (!isRecord(parsed) || !isFiniteNumber(parsed.version) || !isFiniteNumber(parsed.savedAt)) {
    return { ok: false, message: "The save envelope is incomplete." };
  }

  const migration = migrateSave(parsed.version, parsed.state);
  if (!migration.ok || !isValidGameState(migration.data)) {
    return { ok: false, message: migration.message ?? "The save data failed validation." };
  }

  return { ok: true, state: migration.data };
}

function backupCorruptSave(storage: StorageLike, raw: string, now: number): void {
  try {
    storage.setItem(`${BACKUP_KEY_PREFIX}${now}`, raw);
  } catch {
    // A failed backup must not prevent the player from starting a new farm.
  }
}

export function loadGame(storage: StorageLike, now: number): LoadResult {
  let raw: string | null = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch {
    return {
      state: createNewGame(now),
      status: "new",
      warning: "Browser storage is unavailable, so progress will not be saved."
    };
  }

  if (!raw) {
    return { state: createNewGame(now), status: "new" };
  }

  const parsed = parseSave(raw);
  if (!parsed.ok || !parsed.state) {
    backupCorruptSave(storage, raw, now);
    return {
      state: createNewGame(now),
      status: "recovered",
      warning: `Saved progress could not be loaded (${parsed.message ?? "unknown error"}). A backup was kept and a new farm started.`
    };
  }

  return { state: advanceTime(parsed.state, now, OFFLINE_CAP_MS), status: "loaded" };
}

export function saveGame(storage: StorageLike, state: GameState, now: number): SaveResult {
  const envelope: SaveEnvelope = {
    version: CURRENT_SAVE_VERSION,
    savedAt: now,
    state
  };

  try {
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
    return { ok: true };
  } catch {
    return { ok: false, message: "Progress could not be saved in this browser." };
  }
}

export function resetGame(storage: StorageLike): void {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Reset still applies in memory when storage is unavailable.
  }
}
