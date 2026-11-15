import type { SettingsState } from "./settings-types";

export const settingsIdle: SettingsState = { saved: false, error: null };
export const settingsOk: SettingsState = { saved: true, error: null };
