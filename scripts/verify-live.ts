import "dotenv/config";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
const base = process.env.APP_ORIGIN || "http://localhost:3000";
const login = await fetch(base + "/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: base },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }),
});
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie")!.split(";")[0];
const get = async (path: string) => {
  const r = await fetch(base + "/api" + path, { headers: { Cookie: cookie } });
  assert.equal(r.status, 200);
  return r.json();
};
const status = await get("/status");
assert(status.workerAlive);
assert(status.total > 0);
const articles = await get("/articles");
const sources = await get("/sources");
if(process.argv.includes('--background-fetch')) {
  const s=sources.find((s:any)=>s.enabled&&s.status==='ok'); assert(s);
  const old=s.last_success;
  const r=await fetch(base+'/api/sources/'+s.id+'/fetch',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,200);
  let completed=false;
  for(let attempt=0;attempt<25;attempt++){await new Promise(r=>setTimeout(r,1000));const current=(await get('/sources')).find((x:any)=>x.id===s.id);if(current.last_success!==old){completed=true;break;}}
  assert(completed,'Worker hat den eingeplanten Abruf nicht abgeschlossen.');
  console.log('Automatischer Hintergrundabruf ohne geöffnetes Dashboard erfolgreich.');
}
assert(sources.some((s: any) => s.status === "ok" && s.item_count > 0));
assert(articles.items.length > 0);
if (process.argv.includes("--after-restart")) {
  const before = JSON.parse(readFileSync("data/verification.json", "utf8"));
  assert.equal(status.total, before.total);
  console.log(
    `Neustart bestanden: ${status.total} Meldungen weiterhin vorhanden. Worker aktiv.`,
  );
} else {
  writeFileSync(
    "data/verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        total: status.total,
        sourceCount: sources.length,
        workerAlive: status.workerAlive,
      },
      null,
      2,
    ),
  );
  console.log(
    `Live-Prüfung: ${status.total} echte Meldungen, ${sources.length} Quellen, Worker aktiv.`,
  );
}
await fetch(base + "/api/logout", {
  method: "POST",
  headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" },
  body: "{}",
});
