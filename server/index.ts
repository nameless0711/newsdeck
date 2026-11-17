import { bootstrap } from "./auth.js";
import { makeApp } from "./api.js";
import { config } from "./config.js";
import { db } from "./db.js";
import { createBriefing } from "./briefings.js";
await bootstrap();
await createBriefing();
const server = makeApp().listen(config.port, config.host, () =>
  console.log(`NEWSDECK: ${config.origin}`),
);
function shutdown() {
  server.close(() => {
    void db.close().then(() => process.exit(0));
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
