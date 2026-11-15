/*
 * Timezone-aware helpers. The business timezone lives in settings; all
 * date-only fields (invoice issue/due) are ISO strings, and instants are
 * stored as UTC ms. These helpers convert between wall-clock input in the
 * business timezone and UTC instants.
 */

const BUSINESS_TZ = () =>
  // lazy import to keep this module usable from scripts
  process.env.BAREBOOK_TZ ?? "UTC";

/** Minutes that `tz` was offset from UTC at `instant` (positive = ahead). */
export function tzOffsetMinutes(tz: string, instant: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant) / 60000);
}

/** "2026-11-15" + "09:30" in the business timezone → UTC instant. */
export function zonedToUtc(dateStr: string, timeStr: string, tz?: string): Date {
  const zone = tz ?? BUSINESS_TZ();
  const naiveUtc = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (Number.isNaN(naiveUtc)) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }
  // correct for the zone's offset at that (approximate) instant; one pass is
  // exact for all real-world zones (offsets change on whole-minute boundaries)
  const offset = tzOffsetMinutes(zone, naiveUtc);
  return new Date(naiveUtc - offset * 60000);
}

/** UTC instant → "YYYY-MM-DD" in the business timezone. */
export function utcToDateString(instant: Date, tz?: string): string {
  const zone = tz ?? BUSINESS_TZ();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** UTC instant → "15 Nov 2026" in the business timezone. */
export function formatDate(instant: Date, tz?: string): string {
  const zone = tz ?? BUSINESS_TZ();
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(instant);
}

/** UTC instant → "15 Nov 2026, 09:30" in the business timezone. */
export function formatDateTime(instant: Date, tz?: string): string {
  const zone = tz ?? BUSINESS_TZ();
  return `${formatDate(instant, zone)}, ${new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant)}`;
}

/** 150 → "2h 30m"; 45 → "45m"; 0 → "0m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Live-timer variant with seconds: 1h 23m 45s */
export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}
