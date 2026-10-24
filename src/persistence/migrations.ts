export const CURRENT_SAVE_VERSION = 1;

export interface MigrationResult {
  ok: boolean;
  data: unknown;
  message?: string;
}

export function migrateSave(version: number, data: unknown): MigrationResult {
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, data: null, message: "The save has an invalid version." };
  }

  if (version > CURRENT_SAVE_VERSION) {
    return {
      ok: false,
      data: null,
      message: "This save was created by a newer version of Sunny Acres and was left untouched."
    };
  }

  switch (version) {
    case 1:
      return { ok: true, data };
    default:
      return { ok: false, data: null, message: "The save version is not supported." };
  }
}
