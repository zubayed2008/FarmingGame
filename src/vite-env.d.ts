/// <reference types="vite/client" />

import type { GameState } from "./game/types";

declare global {
  interface SunnyAcresDebugApi {
    getState: () => GameState;
    advance: (elapsedMs: number) => void;
    reset: () => void;
  }

  interface Window {
    __SUNNY_ACRES__?: SunnyAcresDebugApi;
  }
}

export {};
