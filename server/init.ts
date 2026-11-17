import { bootstrap } from "./auth.js";
import { db } from "./db.js";
await bootstrap();
await db.close();
console.log("Datenbank bereit.");
