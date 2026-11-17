import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) {
  console.log(
    ".env existiert bereits. Einstellungen dort ändern; kein Überschreiben.",
  );
  process.exit(0);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email =
  (await rl.question("Admin-E-Mail [admin@newsdeck.local]: ")) ||
  "admin@newsdeck.local";
const password = randomBytes(18).toString("base64url");
writeFileSync(
  ".env",
  `PORT=3000\nHOST=127.0.0.1\nAPP_ORIGIN=http://localhost:3000\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\nSQLITE_PATH=data/newsdeck.sqlite\nCOOKIE_SECURE=false\n`,
  { mode: 0o600 },
);
console.log(
  `Einrichtung gespeichert. Einmaliges Startpasswort: ${password}\nPasswort sicher verwahren. Mit npm run build und npm start starten; zusätzlich npm run worker.`,
);
rl.close();
