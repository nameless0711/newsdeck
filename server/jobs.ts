import { randomUUID } from "node:crypto";
import { db, type Row } from "./db.js";
import { now, config } from "./config.js";
import { connectors } from "./connectors.js";
import { ingest, analyze } from "./processing.js";
import { notifications } from "./notifications.js";
import { backfillTopics, processTopicAnalysis } from "./topic-classification.js";
import { createBriefing } from "./briefings.js";
export async function claimSource(id: string) {
  const time = now(),
    token = randomUUID();
  return (
    await db.query(
      "UPDATE sources SET lease_token=?,lease_until=?,status='running',last_attempt=? WHERE id=? AND enabled=1 AND next_run<=? AND (lease_until IS NULL OR lease_until<?) RETURNING *",
      [
        token,
        new Date(Date.now() + 300000).toISOString(),
        time,
        id,
        time,
        time,
      ],
    )
  )[0];
}
export async function fetchSource(source: Row) {
  const start = now();
  let found = 0;
  const renewal = setInterval(() => {
    void db
      .query("UPDATE sources SET lease_until=? WHERE id=? AND lease_token=?", [
        new Date(Date.now() + 300000).toISOString(),
        source.id,
        source.lease_token,
      ])
      .catch(console.error);
  }, 30000);
  try {
    if (!source.rights_confirmed)
      throw new Error(
        "Bitte Nutzungsrechte und Abrufbedingungen der Quelle bestätigen.",
      );
    const items = await connectors[source.type].fetch(source);
    for (const item of items) if (await ingest(source, item)) found++;
    await db.query(
      "UPDATE sources SET status='ok',error=NULL,failures=0,last_success=?,next_run=?,lease_until=NULL,lease_token=NULL,item_count=(SELECT COUNT(*) FROM articles WHERE source_id=?) WHERE id=? AND lease_token=?",
      [
        now(),
        new Date(Date.now() + source.interval_minutes * 60000).toISOString(),
        source.id,
        source.id,
        source.lease_token,
      ],
    );
    await db.query("INSERT INTO fetch_logs VALUES(?,?,?,?,?,?,?,?)", [
      randomUUID(),
      source.id,
      source.name,
      start,
      now(),
      "ok",
      found,
      null,
    ]);
    return found;
  } catch (e) {
    const error = e instanceof Error ? e.message : "Abruf fehlgeschlagen";
    await db.query(
      "UPDATE sources SET status='error',error=?,failures=failures+1,next_run=?,lease_until=NULL,lease_token=NULL WHERE id=? AND lease_token=?",
      [
        error,
        new Date(
          Date.now() +
            Math.min(
              86400000,
              Math.max(
                source.interval_minutes * 60000,
                60000 * 2 ** Math.min(source.failures + 1, 10),
              ),
            ),
        ).toISOString(),
        source.id,
        source.lease_token,
      ],
    );
    await db.query("INSERT INTO fetch_logs VALUES(?,?,?,?,?,?,?,?)", [
      randomUUID(),
      source.id,
      source.name,
      start,
      now(),
      "error",
      found,
      error,
    ]);
    return 0;
  } finally {
    clearInterval(renewal);
  }
}
export async function tick() {
  await db.query(
    "INSERT INTO settings(key,value) VALUES('worker_heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [now()],
  );
  const due = await db.query(
    "SELECT id FROM sources WHERE enabled=1 AND next_run<=? AND (lease_until IS NULL OR lease_until<?) ORDER BY priority DESC LIMIT 10",
    [now(), now()],
  ); // Serial ingest keeps SQLite transactions isolated; each source has a bounded timeout.
  for (const s of due) {
    const claimed = await claimSource(s.id);
    if (claimed) await fetchSource(claimed);
  }
  await backfillTopics();
  await processTopicAnalysis();
  if (config.aiBase && config.aiModel) {
    const items = await db.query(
      "SELECT * FROM articles WHERE ai_status IN ('pending','retry') AND (ai_next_run IS NULL OR ai_next_run<=?) ORDER BY fetched_at DESC LIMIT 5",
      [now()],
    );
    for (const a of items) await analyze(a);
  }
  await createBriefing();
  await notifications();
  await db.query("DELETE FROM sessions WHERE expires_at<?", [now()]);
  await db.query("DELETE FROM fetch_logs WHERE finished_at<?", [
    new Date(Date.now() - 90 * 86400000).toISOString(),
  ]);
}
