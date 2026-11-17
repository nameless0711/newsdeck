const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function publicationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2})(?::(\d{2})(\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})$/.exec(raw);
  const rss = /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(GMT|UT|UTC|[+-]\d{4})$/.exec(raw);
  if (!iso && !rss) return null;

  const pad = (part: number | string) => String(part).padStart(2, "0");
  const year = iso ? iso[1] : rss![4];
  const month = iso ? iso[2] : pad(months.indexOf(rss![3]) + 1);
  const day = iso ? iso[3] : pad(rss![2]);
  const hour = iso ? iso[4] : rss![5];
  const minute = iso ? iso[5] : rss![6];
  const second = (iso ? iso[6] : rss![7]) ?? "00";
  const fraction = iso?.[7] ?? "";
  const zone = iso ? iso[8].toUpperCase() : rss![8];
  const calendar = `${year}-${month}-${day}`;
  const civil = new Date(`${calendar}T00:00:00.000Z`);
  if (
    !Number.isFinite(+civil) ||
    civil.toISOString().slice(0, 10) !== calendar ||
    (rss?.[1] && weekdays[civil.getUTCDay()] !== rss[1]) ||
    Number(hour) >= 24 || Number(minute) >= 60 || Number(second) >= 60
  ) return null;

  const offset = /^[+-]/.test(zone) ? zone.replace(":", "") : null;
  const timestamp = Date.parse(`${calendar}T${hour}:${minute}:${second}${offset ?? "Z"}`);
  if (!Number.isFinite(timestamp)) return null;
  const normalized = new Date(timestamp).toISOString();
  const digits = fraction.slice(1).replace(/0+$/, "").padEnd(3, "0");
  return normalized.length === 24 ? normalized.slice(0, 20) + digits + "Z" : null;
}
