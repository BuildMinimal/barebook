/**
 * Shared constant with zero imports — safe to use from the edge middleware,
 * which cannot touch better-sqlite3 or anything else node-native.
 */
export const SESSION_COOKIE = "barebook_session";
