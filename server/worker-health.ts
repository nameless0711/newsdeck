import { db } from "./db.js";
const heartbeat = (
  await db.query("SELECT value FROM settings WHERE key='worker_heartbeat'")
)[0]?.value;
await db.close();
process.exit(
  heartbeat && Date.now() - new Date(heartbeat).getTime() < 120000 ? 0 : 1,
);
