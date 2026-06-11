/**
 * Returns current UTC timestamp in SQLite datetime format: YYYY-MM-DD HH:MM:SS
 */
export function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}
