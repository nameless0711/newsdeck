import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { now } from "./config.js";
import { tick } from "./jobs.js";
await db.migrate();
const token = randomUUID();
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
console.log("NEWSDECK Hintergrunddienst gestartet.");
while (!stop) {
  const lease = await db.query(
    "INSERT INTO worker_locks(name,token,expires_at) VALUES('scheduler',?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE worker_locks.expires_at<? OR worker_locks.token=? RETURNING token",
    [token, new Date(Date.now() + 120000).toISOString(), now(), token],
  );
  if (lease.length) {
    const heartbeat = setInterval(() => {
      void db
        .query(
          "UPDATE worker_locks SET expires_at=? WHERE name='scheduler' AND token=?",
          [new Date(Date.now() + 120000).toISOString(), token],
        )
        .catch(console.error);
      void db
        .query(
          "INSERT INTO settings(key,value) VALUES('worker_heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
          [now()],
        )
        .catch(console.error);
    }, 30000);
    try {
      await tick();
    } catch (e) {
      console.error(
        "Worker-Zyklus fehlgeschlagen:",
        e instanceof Error ? e.message : e,
      );
    } finally {
      clearInterval(heartbeat);
    }
  }
  await new Promise((r) => setTimeout(r, 5000));
}
await db.query("DELETE FROM worker_locks WHERE name='scheduler' AND token=?", [
  token,
]);
await db.close();
