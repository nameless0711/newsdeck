import { backup } from "node:sqlite";
import { db } from "./db.js";
import { mkdirSync } from "node:fs";
if (db.pool) throw new Error("PostgreSQL: scripts/backup.sh verwenden.");
mkdirSync("backups", { recursive: true });
const path =
  "backups/newsdeck-" +
  new Date().toISOString().replace(/[:.]/g, "-") +
  ".sqlite";
await backup(db.sqlite!, path);
await db.close();
console.log("Konsistentes Backup: " + path);
