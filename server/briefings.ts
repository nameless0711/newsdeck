import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { db, type Query, type Row } from "./db.js";

const dayMillis = 86_400_000;
const limit = 200;
// Compare against the millisecond prefix, then include the exact instant.
// Source timestamps may have more fractional digits than the worker clock.
const duePublication = "(published_at<? OR published_at=?)";
const formatters = new Map<string, Intl.DateTimeFormat>();

export function briefingDay(time: Date, timezone = config.briefingTimezone) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    });
    formatters.set(timezone, formatter);
  }
  return formatter.format(time);
}

export function briefingBounds(day: string, timezone = config.briefingTimezone) {
  const utc = new Date(day + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(+utc) ||
      utc.toISOString().slice(0, 10) !== day) return null;

  // Find each local day boundary independently, including skipped civil midnights.
  function startOfDay(label: string, anchor: number) {
    let low = anchor - 2 * dayMillis;
    let high = anchor + 2 * dayMillis;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (briefingDay(new Date(middle), timezone) < label) low = middle + 1;
      else high = middle;
    }
    return new Date(low).toISOString();
  }
  const next = new Date(+utc + dayMillis);
  return {
    start: startOfDay(day, +utc),
    end: startOfDay(next.toISOString().slice(0, 10), +next),
  };
}

async function lock(q: Query) {
  // SQLite serializes writers with BEGIN IMMEDIATE. Use a transaction lock on PostgreSQL.
  if (db.pool) await q("SELECT pg_advisory_xact_lock(848104, 4)");
}

async function saveBriefing(q: Query, day: string, time: Date) {
  const timezone = config.briefingTimezone;
  const { start, end } = briefingBounds(day, timezone)!;
  const cutoff = time.toISOString();
  const rows = await q(
    `WITH selected AS (
       SELECT id,title,summary,description,source_name,url,relevance,published_at,
         manual_topics,topic_revision,topic_status
       FROM articles
       WHERE publication_verified=1 AND published_at>=? AND published_at<? AND ${duePublication}
       ORDER BY relevance DESC,published_at DESC,id LIMIT ?
     )
     SELECT s.id,s.title,s.summary,s.description,s.source_name,s.url,s.relevance,s.published_at,
       t.id AS topic_id,t.name AS topic_name
     FROM selected s CROSS JOIN topic_catalog c
     LEFT JOIN article_topics a ON a.article_id=s.id AND
       (s.manual_topics=1 OR (s.topic_revision=c.revision AND s.topic_status IN ('done','rules','failed')))
     LEFT JOIN topics t ON t.id=a.topic_id
     ORDER BY s.relevance DESC,s.published_at DESC,s.id,t.id`,
    [start.slice(0, -1), end.slice(0, -1), cutoff.slice(0, -1), cutoff, limit + 1],
  );
  const groups = new Map<string, { id: string; topic: string; items: Row[] }>();
  const articles = new Set<string>();
  let truncated = false;
  for (const { topic_id, topic_name, ...item } of rows) {
    if (!articles.has(item.id) && articles.size === limit) {
      truncated = true;
      break;
    }
    articles.add(item.id);
    const key = topic_id ?? "";
    if (!groups.has(key)) groups.set(key, { id: key, topic: topic_name ?? "Weitere Meldungen", items: [] });
    groups.get(key)!.items.push(item);
  }
  const content = [...groups.values()].sort((a, b) =>
    Number(!a.id) - Number(!b.id) || a.topic.localeCompare(b.topic, "de") || a.id.localeCompare(b.id),
  );
  await q(
    `INSERT INTO briefings(id,day,content,created_at,timezone,updated_at,truncated) VALUES(?,?,?,?,?,?,?)
     ON CONFLICT(day) DO UPDATE SET content=excluded.content,timezone=excluded.timezone,
       updated_at=excluded.updated_at,truncated=excluded.truncated
     WHERE briefings.content<>excluded.content OR briefings.timezone IS DISTINCT FROM excluded.timezone
       OR briefings.truncated<>excluded.truncated`,
    [randomUUID(), day, JSON.stringify(content), cutoff, timezone, cutoff, Number(truncated)],
  );
}

export async function createBriefing(clock?: Date) {
  await db.transaction(async (q) => {
    await lock(q);
    const time = clock ?? new Date();
    const today = briefingDay(time);
    const days = new Set<string>();
    if (!(await q("SELECT id FROM briefings WHERE day=? AND timezone=?", [today, config.briefingTimezone])).length)
      days.add(today);
    for (const row of await q("SELECT day FROM briefings WHERE timezone IS NULL OR timezone<>?", [config.briefingTimezone]))
      days.add(row.day);
    const zone = (await q("SELECT value FROM settings WHERE key='briefing_timezone'"))[0]?.value;
    if (zone !== config.briefingTimezone) {
      // A timezone change can move already processed articles to adjacent days.
      await q("INSERT INTO briefing_changes(published_at) SELECT DISTINCT published_at FROM articles WHERE publication_verified=1");
      await q("INSERT INTO settings(key,value) VALUES('briefing_timezone',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [config.briefingTimezone]);
    }
    const cutoff = time.toISOString();
    const changed = await q(
      `DELETE FROM briefing_changes WHERE ${duePublication} RETURNING published_at`,
      [cutoff.slice(0, -1), cutoff],
    );
    for (const row of changed) days.add(briefingDay(new Date(row.published_at)));
    for (const day of [...days].sort()) await saveBriefing(q, day, time);
  });
}

export async function rebuildBriefing(day: string, clock?: Date) {
  return db.transaction(async (q) => {
    await lock(q);
    const time = clock ?? new Date();
    if (!briefingBounds(day) || day > briefingDay(time)) return false;
    if (!(await q("SELECT id FROM briefings WHERE day=?", [day])).length) return false;
    await saveBriefing(q, day, time);
    return true;
  });
}
