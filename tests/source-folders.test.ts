import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const dir = mkdtempSync(join(tmpdir(), "newsdeck-folders-"));
const adminEmail = "folders@example.org";
const readerEmail = "reader-folders@example.org";
const password = "synthetic-folder-test-password";
Object.assign(process.env, {
  SQLITE_PATH: join(dir, "test.sqlite"),
  DATABASE_URL: "",
  APP_ORIGIN: "http://localhost:3000",
  NEWSDECK_LOCAL_NO_LOGIN: "false",
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: password,
  AI_BASE_URL: "",
  AI_MODEL: "",
});
const { db, Database } = await import("../server/db.js");
const { bootstrap } = await import("../server/auth.js");
const { makeApp } = await import("../server/api.js");
const { ingest } = await import("../server/processing.js");
const server = createServer(makeApp());
let base: string;
let administrator: string;
let reader: string;

async function api(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = administrator,
) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      Origin: "http://localhost:3000",
      "Content-Type": "application/json",
      Cookie: cookie || "",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}
async function login(email: string) {
  const { response } = await api("/login", "POST", { email, password }, "");
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie")!.split(";")[0];
}
async function addFolder(name: string) {
  const { response, data } = await api("/source-folders", "POST", { name });
  assert.equal(response.status, 201, JSON.stringify(data));
  return data.id as string;
}
const sourceInfo = (name: string, type = "rss") => ({
  name,
  url: "https://8.8.8.8/" + randomUUID(),
  type,
  description: "Synthetische Quelle",
  topics: [] as string[],
  priority: 8,
  interval_minutes: 90,
  enabled: true,
  rights_confirmed: true,
});
async function addSource(
  name: string,
  folder_id: string | null = null,
  type = "rss",
) {
  const input = sourceInfo(name, type);
  const { response, data } = await api("/sources", "POST", {
    ...input,
    folder_id,
  });
  assert.equal(response.status, 201, JSON.stringify(data));
  return { id: data.id as string, ...input };
}
const folderRows = async () =>
  (await api("/source-folders")).data as {
    id: string;
    name: string;
    source_count: number;
  }[];
const sourceRow = async (id: string) => ({
  ...(await db.query("SELECT * FROM sources WHERE id=?", [id]))[0],
});

before(async () => {
  await bootstrap();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  administrator = await login(adminEmail);
  assert.equal(
    (
      await api("/users", "POST", {
        email: readerEmail,
        password,
        role: "reader",
      })
    ).response.status,
    201,
  );
  reader = await login(readerEmail);
});
after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("Migration 005 preserves source state, articles, topic assignments and briefing snapshots", async () => {
  const legacy = new Database("", join(dir, "before-folders.sqlite"));
  try {
    await legacy.exec(
      "CREATE TABLE migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const files = [
      "001_initial.sql",
      "002_article_image.sql",
      "003_article_topics.sql",
      "004_daily_briefings.sql",
    ];
    for (const [index, file] of files.entries()) {
      await legacy.exec(
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      );
      await legacy.query("INSERT INTO migrations VALUES(?,?)", [
        index + 1,
        "2026-01-01",
      ]);
    }
    await legacy.exec(
      readFileSync(
        new URL(
          "../migrations/004_daily_briefings.sqlite.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await legacy.query(
      "INSERT INTO sources(id,name,url,type,next_run,created_at,lease_token,status) VALUES('s','Quelle','https://example.org/feed','rss','2026','2026','lease','running')",
    );
    await legacy.query(
      "INSERT INTO articles(id,source_id,source_name,url,title,fetched_at,updated_at,content_hash) VALUES('a','s','Quelle','https://example.org/a','Alt','2026','2026','hash')",
    );
    await legacy.query(
      "INSERT INTO topics(id,name,color) VALUES('t','Thema','#000000')",
    );
    await legacy.query(
      "INSERT INTO article_topics(article_id,topic_id) VALUES('a','t')",
    );
    await legacy.query(
      "INSERT INTO briefings(id,day,content,created_at) VALUES('b','2026-01-01','[]','2026')",
    );
    const before = (await legacy.query("SELECT * FROM sources"))[0];
    await legacy.migrate();
    await legacy.migrate();
    assert.deepEqual(
      { ...(await legacy.query("SELECT * FROM sources"))[0] },
      { ...before, folder_id: null },
    );
    assert.equal(
      (await legacy.query("SELECT source_id FROM articles"))[0].source_id,
      "s",
    );
    assert.equal(
      (await legacy.query("SELECT topic_id FROM article_topics"))[0].topic_id,
      "t",
    );
    assert.equal((await legacy.query("SELECT id FROM briefings"))[0].id, "b");
    assert.equal(
      (await legacy.query("SELECT COUNT(*) AS count FROM source_folders"))[0]
        .count,
      0,
    );
    assert.equal((await legacy.query("PRAGMA foreign_key_check")).length, 0);
  } finally {
    await legacy.close();
  }
});

test("Folder names are trimmed, normalized, unique and reserved views cannot be created", async () => {
  const id = await addFolder("  Übersicht  ");
  assert.deepEqual(
    (await folderRows()).find((folder) => folder.id === id),
    { id, name: "Übersicht", source_count: 0 },
  );
  for (const name of [
    " ",
    "ÜBERSICHT",
    "U\u0308bersicht",
    "Alle Quellen",
    " OHNE ORDNER ",
    "Ｏｈｎｅ　Ｏｒｄｎｅｒ",
    "a".repeat(81),
  ])
    assert.equal(
      (await api("/source-folders", "POST", { name })).response.status,
      400,
      name,
    );
  const rival = await addFolder("Anderer Ordner");
  await addFolder("Straße");
  assert.equal(
    (await api("/source-folders", "POST", { name: "STRAẞE" })).response.status,
    400,
  );
  assert.equal(
    (await api("/source-folders", "POST", { name: "STRASSE" })).response.status,
    400,
  );
  assert.equal(
    (await api("/source-folders/" + id, "PUT", { name: "ANDERER ORDNER" }))
      .response.status,
    400,
  );
  assert.equal(
    (await api("/source-folders/" + id, "PUT", { name: " Nachrichten " }))
      .response.status,
    200,
  );
  assert.equal(
    (await folderRows()).find((folder) => folder.id === id)?.name,
    "Nachrichten",
  );
  for (const invalid of ["not-an-id", randomUUID()]) {
    assert.equal(
      (await api("/source-folders/" + invalid, "PUT", { name: "Gültig" }))
        .response.status,
      400,
    );
    assert.equal(
      (await api("/source-folders/" + invalid, "DELETE")).response.status,
      400,
    );
    assert.equal(
      (
        await api("/sources", "POST", {
          ...sourceInfo("Ungültiges Ziel"),
          folder_id: invalid,
        })
      ).response.status,
      400,
    );
  }
  assert.equal(
    (await api("/source-folders/" + rival, "DELETE")).response.status,
    200,
  );
});

test("Individual and atomic bulk moves preserve an active fetch, legacy edits preserve folders", async () => {
  const folder = await addFolder("Abrufordner");
  const alternate = await addFolder("Anderes Ziel");
  const a = await addSource("Laufender Abruf", folder);
  const b = await addSource("Weitere Quelle");
  const lease = new Date(Date.now() + 60_000).toISOString();
  await db.query(
    "UPDATE sources SET status='running',lease_until=?,lease_token='lease',error='vorheriger Fehler' WHERE id=?",
    [lease, a.id],
  );
  const before = await sourceRow(a.id);
  assert.equal(
    (await api("/sources/" + a.id, "PUT", { ...a, folder_id: alternate }))
      .response.status,
    200,
  );
  assert.deepEqual(await sourceRow(a.id), { ...before, folder_id: alternate });
  assert.equal(
    (await api("/sources/" + a.id, "PUT", { ...a, folder_id: null })).response
      .status,
    200,
  );
  assert.deepEqual(await sourceRow(a.id), { ...before, folder_id: null });
  assert.equal(
    (
      await api("/sources/move", "POST", {
        source_ids: [a.id, randomUUID()],
        folder_id: folder,
      })
    ).response.status,
    400,
  );
  assert.equal(
    (
      await api("/sources/move", "POST", {
        source_ids: [a.id, b.id],
        folder_id: randomUUID(),
      })
    ).response.status,
    400,
  );
  assert.equal(
    (await api("/sources/move", "POST", { source_ids: [], folder_id: null }))
      .response.status,
    400,
  );
  assert.equal((await sourceRow(a.id)).folder_id, null);
  assert.equal((await sourceRow(b.id)).folder_id, null);
  assert.equal(
    (
      await api("/sources/move", "POST", {
        source_ids: [a.id, b.id, b.id],
        folder_id: folder,
      })
    ).response.status,
    200,
  );
  assert.deepEqual(await sourceRow(a.id), before);
  assert.equal(
    (await folderRows()).find((row) => row.id === folder)?.source_count,
    2,
  );
  assert.equal(
    (
      await api("/sources/" + a.id, "PUT", {
        ...a,
        name: "Bearbeitet im Abruf",
      })
    ).response.status,
    400,
  );
  assert.equal(
    (await api("/sources/" + b.id, "PUT", { ...b, name: "Legacy bearbeitet" }))
      .response.status,
    200,
  );
  assert.equal((await sourceRow(b.id)).folder_id, folder);
  assert.equal(
    (
      await api("/sources/move", "POST", {
        source_ids: [a.id, b.id],
        folder_id: null,
      })
    ).response.status,
    200,
  );
  assert.deepEqual(await sourceRow(a.id), { ...before, folder_id: null });
});

test("Feed intersects folder, source and other filters before counting and pagination", async () => {
  const folder = await addFolder("Feedordner");
  const a = await addSource("Feed A", folder);
  const b = await addSource("Feed B", null, "website");
  const orphan = await addSource("Gelöschte Quelle");
  const topic = (
    await db.query("SELECT id FROM topics WHERE name='Politik'")
  )[0].id;
  const entry = {
    title: "Synthetikmeldung Bundestag meldet neue Details",
    description: "",
    content: "Diese Meldung wurde für den Ordnerfilter erfunden.",
    published_at: "2026-10-30T10:30:00.000Z",
  };
  for (const [source, count] of [
    [a, 32],
    [b, 1],
    [orphan, 1],
  ] as const) {
    for (let i = 0; i < count; i++)
      await ingest(source, { ...entry, url: source.url + "/" + i });
  }
  const parameters = new URLSearchParams({
    folder,
    q: "Synthetikmeldung",
    type: "rss",
    topic,
    min: "8",
    from: "2026-10-30",
    to: "2026-10-30",
  });
  const page = async (num: number) =>
    (
      await api(
        "/articles?" + parameters + "&page=" + num,
        "GET",
        undefined,
        reader,
      )
    ).data;
  const first = await page(1);
  const second = await page(2);
  assert.equal(first.total, 32);
  assert.equal(second.total, 32);
  assert.equal(first.items.length, 30);
  assert.equal(second.items.length, 2);
  const articles = [...first.items, ...second.items];
  assert.equal(new Set(articles.map((item) => item.id)).size, 32);
  assert(articles.every((item) => item.source_id === a.id));
  assert.equal(
    (await api("/articles?" + parameters + "&source=" + b.id)).data.total,
    0,
  );
  assert.equal(
    (await api("/articles?" + parameters + "&source=" + a.id)).data.total,
    32,
  );
  assert.equal(
    (await api("/articles?" + parameters + "&favorite=true")).data.total,
    0,
  );
  await api("/articles/" + articles[0].id + "/favorite", "PUT", {
    enabled: true,
  });
  assert.equal(
    (await api("/articles?" + parameters + "&favorite=true")).data.total,
    1,
  );
  assert.equal(
    (await api("/sources/" + orphan.id, "DELETE")).response.status,
    200,
  );
  const count = async (filter = "") =>
    (await api("/articles?q=Synthetikmeldung" + filter)).data.total;
  assert.equal(await count(), 34);
  assert.equal(await count("&folder=unfiled"), 1);
  assert.equal(await count("&folder=" + folder), 32);
  const article = {
    ...(
      await db.query("SELECT * FROM articles WHERE id=?", [articles[0].id])
    )[0],
  };
  assert.equal(
    (await api("/source-folders/" + folder, "DELETE")).response.status,
    200,
  );
  assert.equal(await count("&folder=unfiled"), 33);
  assert.equal(await count("&folder=" + folder), 0);
  assert.equal(await count(), 34);
  assert.equal((await sourceRow(a.id)).folder_id, null);
  assert.deepEqual(
    {
      ...(await db.query("SELECT * FROM articles WHERE id=?", [article.id]))[0],
    },
    article,
  );
  assert.equal((await api("/articles?folder=broken")).response.status, 400);
});

test("Readers can list and filter folders and cannot mutate folders or assignments", async () => {
  const folder = await addFolder("Leseberechtigung");
  const source = await addSource("Lesbare Quelle");
  const call = (path: string, method: string, body?: unknown) =>
    api(path, method, body, reader);
  assert.equal((await call("/source-folders", "GET")).response.status, 200);
  assert.equal(
    (await call("/articles?folder=" + folder, "GET")).response.status,
    200,
  );
  assert.equal(
    (await call("/source-folders", "POST", { name: "Verboten" })).response
      .status,
    403,
  );
  assert.equal(
    (await call("/source-folders/" + folder, "PUT", { name: "Verboten" }))
      .response.status,
    403,
  );
  assert.equal(
    (await call("/source-folders/" + folder, "DELETE")).response.status,
    403,
  );
  assert.equal(
    (
      await call("/sources/" + source.id, "PUT", {
        ...source,
        folder_id: folder,
      })
    ).response.status,
    403,
  );
  assert.equal(
    (
      await call("/sources/move", "POST", {
        source_ids: [source.id],
        folder_id: folder,
      })
    ).response.status,
    403,
  );
});

test("Portable export and import preserve empty folders, named associations and legacy imports", async () => {
  const folder = await addFolder("Rundlauf");
  const empty = await addFolder("Leerer Rundlauf");
  const a = await addSource("Rundlauf Quelle", folder);
  const b = await addSource("Rundlauf ohne Ordner");
  const topic = (
    await db.query("SELECT id FROM topics WHERE name='Politik'")
  )[0].id;
  await api("/sources/" + a.id, "PUT", { ...a, topics: [topic] });
  const exported = (await api("/sources/export")).data;
  assert.equal(exported.version, 2);
  assert(exported.folders.includes("Leerer Rundlauf"));
  const sources = exported.sources.filter(
    (row: any) => row.url === a.url || row.url === b.url,
  );
  assert.deepEqual(sources.find((row: any) => row.url === a.url).topic_names, [
    "Politik",
  ]);
  assert(!("topics" in sources[0]) && !("folder_id" in sources[0]));
  assert.equal(sources.find((row: any) => row.url === b.url).folder, null);
  const archive = (await api("/export")).data;
  assert(archive.source_folders.some((row: any) => row.id === empty));
  assert.equal(
    archive.sources.find((row: any) => row.id === a.id).folder_id,
    folder,
  );
  await api("/sources/" + a.id, "DELETE");
  await api("/sources/" + b.id, "DELETE");
  await api("/source-folders/" + empty, "DELETE");
  await api("/source-folders/" + folder, "PUT", { name: "RUNDLAUF" });
  const portable = {
    version: 2,
    folders: ["Rundlauf", "Leerer Rundlauf"],
    sources: sources.map((row: any) => ({
      ...row,
      folder_id: randomUUID(),
      topics: [randomUUID()],
      id: randomUUID(),
    })),
  };
  const imported = (await api("/sources/import", "POST", portable)).data;
  assert(
    imported.every((row: any) => row.ok),
    JSON.stringify(imported),
  );
  const newA = await sourceRow(
    imported.find((row: any) => row.name === a.name).id,
  );
  const newB = await sourceRow(
    imported.find((row: any) => row.name === b.name).id,
  );
  assert.notEqual(newA.id, a.id);
  assert.equal(newA.folder_id, folder);
  assert.deepEqual(JSON.parse(newA.topics), [topic]);
  assert.equal(newB.folder_id, null);
  assert.equal(
    (await folderRows()).find((row) => row.name === "Leerer Rundlauf")
      ?.source_count,
    0,
  );
  const legacy = sourceInfo("Alter Import");
  const repeated = (
    await api("/sources/import", "POST", [
      legacy,
      legacy,
      sourceInfo("Noch eine Altquelle"),
    ])
  ).data;
  assert.deepEqual(
    repeated.map((row: any) => row.ok),
    [true, false, true],
  );
  assert.match(repeated[1].error, /URL existiert bereits/);
  assert.equal((await sourceRow(repeated[0].id)).folder_id, null);
});
