export interface TimeEntryState {
  error: string | null;
  saved: boolean;
}

export const timeIdle: TimeEntryState = { error: null, saved: false };
