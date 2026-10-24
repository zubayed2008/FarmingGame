export const ITEM_IDS = [
  "wheatSeed",
  "carrotSeed",
  "riceSeed",
  "tomatoSeed",
  "wheat",
  "carrot",
  "rice",
  "tomato",
  "cowMilk",
  "goatMilk"
] as const;

export type ItemId = (typeof ITEM_IDS)[number];

export const CROP_SPECIES = ["wheat", "carrot", "rice", "tomato"] as const;
export type CropSpecies = (typeof CROP_SPECIES)[number];

export const LIVESTOCK_SPECIES = ["cow", "goat"] as const;
export type LivestockSpecies = (typeof LIVESTOCK_SPECIES)[number];

export const PET_SPECIES = ["dog", "cat"] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export type AnimalSpecies = LivestockSpecies | PetSpecies;

export interface CropState {
  species: CropSpecies;
  watered: boolean;
  growthMs: number;
}

export interface Plot {
  id: number;
  crop: CropState | null;
}

export interface LivestockAnimal {
  id: number;
  kind: "livestock";
  species: LivestockSpecies;
  hunger: number;
  productionMs: number;
  productionActive: boolean;
  productReady: boolean;
}

export interface PetAnimal {
  id: number;
  kind: "pet";
  species: PetSpecies;
  hunger: number;
  happiness: number;
}

export type Animal = LivestockAnimal | PetAnimal;

export interface GameState {
  version: 1;
  coins: number;
  inventory: Partial<Record<ItemId, number>>;
  plots: Plot[];
  animals: Animal[];
  nextAnimalId: number;
  lastTickAt: number;
}

export interface ActionResult {
  ok: boolean;
  state: GameState;
  message: string;
}
