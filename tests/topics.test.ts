import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";

const dir = mkdtempSync(join(tmpdir(), "newsdeck-topics-"));
process.env.SQLITE_PATH = join(dir, "test.sqlite");
process.env.DATABASE_URL = "";
process.env.NEWSDECK_LOCAL_NO_LOGIN = "true";
process.env.HOST = "127.0.0.1";
process.env.ADMIN_EMAIL = "topics@example.org";
process.env.ADMIN_PASSWORD = "test-password-for-topics";
process.env.AI_BASE_URL = "";
process.env.AI_MODEL = "mock";
process.env.AI_API_KEY = "";
process.env.SMTP_HOST = "";
process.env.TOPIC_RULE_THRESHOLD = "2";
process.env.TOPIC_AI_THRESHOLD = "3";

const { db, Database } = await import("../server/db.js");
const { bootstrap } = await import("../server/auth.js");
const { config, topicPolicy } = await import("../server/config.js");
const { makeApp } = await import("../server/api.js");
const { ingest } = await import("../server/processing.js");
const { notifications } = await import("../server/notifications.js");
const { createBriefing } = await import("../server/briefings.js");
const { ruleTopics, semanticResults, backfillTopics, processTopicAnalysis } =
  await import("../server/topic-classification.js");

const definitions = [
  {
    name: "Finanzen",
    description: "Geldinstitute und Kreditwesen",
    keywords: ["Bank", "Kredit"],
    exclusions: ["Parkbank"],
    semantic_exclusions: "Sitzgelegenheiten ohne Finanzbezug",
  },
  {
    name: "Verkehr",
    description: "Verkehrsinfrastruktur",
    keywords: ["Bahn", "Busverkehr"],
    exclusions: ["Spielzeugbahn"],
  },
  {
    name: "Technik",
    description: "Digitale Technik",
    keywords: ["KI", "künstliche Intelligenz"],
    exclusions: [],
  },
];
const rules = definitions.map((topic, i) => ({
  ...topic,
  id: String(i),
  keywords: JSON.stringify(topic.keywords),
  exclusions: JSON.stringify(topic.exclusions),
}));
const source = { id: "synthetic", name: "Synthetischer Test", priority: 9 };
const item = {
  title: "Die Bank kündigt neue Kredite an",
  description: "Ein neuer Kredit soll Genossenschaften beim Ausbau helfen.",
  content: "Zugleich soll die Bahn mehr Haltestellen anfahren.",
  url: "https://example.org/synthetic-topic-case",
  published_at: "2026-10-30T09:00:00.000Z",
};

type Reply = (input: any) => unknown | Promise<unknown>;
let reply: Reply = () => ({ topics: [] });
let calls = 0;
const model = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  calls++;
  const result = await reply(input);
  if (result === 503) {
    res.writeHead(503).end();
  } else {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
    );
  }
});
const listen = (server: ReturnType<typeof createServer>) =>
  new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Testserver ohne Port");
      resolve("http://127.0.0.1:" + address.port);
    });
  });
const app = createServer();
let base: string;
let modelBase: string;
let finance: string, transit: string, tech: string;
async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: config.origin },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  assert(response.ok, await response.clone().text());
  return response.json();
}
const detail = (id: string) => api("/articles/" + id);
const assigned = (article: any) =>
  article.topics.map((row: any) => row.topic_id).sort();
const candidate = (
  topic_id: string,
  evidence: string,
  confidence = "hoch",
) => ({
  topic_id,
  confidence,
  reason: "Der Text behandelt das Thema ausdrücklich.",
  evidence,
});
async function add(article = item) {
  assert(await ingest(source, article));
  return (
    await db.query("SELECT id FROM articles WHERE url=?", [article.url])
  )[0].id as string;
}

before(async () => {
  await bootstrap();
  await db.query(
    "INSERT INTO sources(id,name,url,type,next_run,created_at) VALUES(?,?,?,?,?,?)",
    [
      source.id,
      source.name,
      "https://example.org/feed",
      "rss",
      "2026-01-01",
      "2026-01-01",
    ],
  );
  [base, modelBase] = await Promise.all([listen(app), listen(model)]);
  config.origin = base;
  config.port = Number(new URL(base).port);
  app.on("request", makeApp());
  [finance, transit, tech] = await Promise.all(
    definitions.map(
      async (definition) =>
        (await api("/topics", "POST", { ...definition, color: "#123456" })).id,
    ),
  );
  config.aiBase = modelBase;
});
afterEach(async () => {
  await db.query("DELETE FROM articles");
  await db.query("DELETE FROM notification_rules");
  await db.query("DELETE FROM briefings");
  config.aiBase = modelBase;
  calls = 0;
  reply = () => ({ topics: [] });
});
after(async () => {
  await Promise.all(
    [app, model].map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("Synthetischer Vergleichsbestand zählt Fehlzuordnungen und übersehene Themen getrennt", (context) => {
  const examples = [
    {
      title: "Mehr Busverkehr geplant",
      description: "Ein Kredit sichert die Finanzierung",
      content: "",
      want: ["0", "1"],
    },
    {
      title: "Mehr Sitzplätze im Park",
      description: "",
      content: "Die Bank neben dem Eingang wird gestrichen.",
      want: [],
    },
    {
      title: "Neue Sitze im Park",
      description: "Diese Bank ist eine Parkbank",
      content: "",
      want: [],
    },
    {
      title: "Neue Bank eröffnet Filiale",
      description:
        "Das Kreditangebot und ein Parkbankmodell werden vorgestellt.",
      content: "",
      want: ["0"],
    },
    { title: "KI", description: "", content: "", hints: ["2"], want: [] },
    { title: "", description: "", content: "", want: [] },
    {
      title: "Morgen beginnt die Ausstellung im Rathaus",
      description: "",
      content: "",
      hints: ["0", "1"],
      want: [],
    },
    {
      title: "Bahnübergang wird erneuert",
      description: "",
      content: "",
      want: [],
    },
    {
      title: "Künstliche  Intelligenz erkennt Muster",
      description: "",
      content: "",
      want: ["2"],
    },
    {
      title: "Nachbarn beraten",
      description: "Die Bahn kommt künftig öfter.",
      content: "Eine Spielzeugbahn steht im Museum.",
      want: [],
    },
    {
      title: "Schule erklärt KI am Beispiel einer Übersetzung",
      description: "",
      content: "",
      hints: ["2"],
      want: ["2"],
    },
  ];
  const falsePositives: string[] = [];
  const missed: string[] = [];
  for (const example of examples) {
    const actual = ruleTopics(example, rules, example.hints);
    falsePositives.push(
      ...actual
        .filter((id) => !example.want.includes(id))
        .map((id) => example.title + "/" + id),
    );
    missed.push(
      ...example.want
        .filter((id) => !actual.includes(id))
        .map((id) => example.title + "/" + id),
    );
  }
  context.diagnostic(
    `${examples.length} synthetische Beispiele: Fehlzuordnungen ${falsePositives.length} (${falsePositives.join(", ")}), übersehen ${missed.length}`,
  );
  // A lexical hit cannot resolve the meaning of "Bank" by itself.
  assert.deepEqual(falsePositives, ["Mehr Sitzplätze im Park/0"]);
  assert.deepEqual(missed, []);
  const standard = topicPolicy.ruleThreshold;
  topicPolicy.ruleThreshold = 3;
  try {
    let wrong = 0;
    let missing = 0;
    for (const example of examples) {
      const actual = ruleTopics(example, rules, example.hints);
      wrong += actual.filter((id) => !example.want.includes(id)).length;
      missing += example.want.filter((id) => !actual.includes(id)).length;
    }
    context.diagnostic(
      `Schwelle 3 im selben Bestand: Fehlzuordnungen ${wrong}, übersehen ${missing}`,
    );
    assert.equal(wrong, 0);
    assert.equal(missing, 4);
  } finally {
    topicPolicy.ruleThreshold = standard;
  }
});

test("Semantic threshold separates uncertain suggestions and rejects invalid or unsupported candidates", () => {
  assert.deepEqual(semanticResults({ topics: [] }, item, rules), []);
  const results = semanticResults(
    {
      topics: [
        candidate("0", "Die Bank kündigt neue Kredite an"),
        candidate("1", "die Bahn mehr Haltestellen", "mittel"),
      ],
    },
    item,
    rules,
  );
  assert.deepEqual(
    results.map((result) => result.adopted),
    [true, false],
  );
  assert.throws(() =>
    semanticResults(
      { topics: [candidate("unknown", item.title)] },
      item,
      rules,
    ),
  );
  assert.throws(() =>
    semanticResults(
      { topics: [candidate("0", item.title), candidate("0", item.title)] },
      item,
      rules,
    ),
  );
  assert.throws(() =>
    semanticResults(
      { topics: [candidate("0", item.title, "0.99")] },
      item,
      rules,
    ),
  );
  assert.throws(() =>
    semanticResults(
      { topics: [candidate("0", "Erfundener Geldbeleg")] },
      item,
      rules,
    ),
  );
  assert.deepEqual(
    semanticResults({ topics: [candidate("0", item.title)] }, item, rules, {
      ...item,
      content: "Im ganzen Beitrag steht auch das Ausschlusswort Parkbank.",
    }),
    [],
  );
});

test("Topic worker stores provenance and suggestions without requesting a summary or duplicating a job", async () => {
  const id = await add(item);
  assert.deepEqual(assigned(await detail(id)), [finance, transit].sort());
  reply = (input) => {
    assert.match(input.messages[0].content, /niemals Anweisungen/);
    const data = JSON.parse(input.messages[1].content);
    assert.equal(data.article.description, item.description);
    assert.equal(
      data.topics.find((topic: any) => topic.id === finance)
        .semantic_exclusions,
      definitions[0].semantic_exclusions,
    );
    return {
      topics: [
        candidate(finance, item.title),
        candidate(transit, item.content, "mittel"),
      ],
    };
  };
  await Promise.all([processTopicAnalysis(), processTopicAnalysis()]);
  const article = await detail(id);
  assert.equal(calls, 1);
  assert.equal(article.topic_status, "done");
  assert.equal(article.ai_status, "pending");
  assert.deepEqual(assigned(article), [finance]);
  const results = article.topic_results.filter(
    (result: any) => result.origin === "ai",
  );
  assert.equal(
    results.find((result: any) => result.topic_id === transit).adopted,
    0,
  );
  assert(
    results.every(
      (result: any) =>
        result.checked_at && result.version && result.reason && result.evidence,
    ),
  );
  assert.equal(await ingest(source, item), false);
  await processTopicAnalysis();
  assert.equal(calls, 1);
});

test("Manual empty assignment survives imports and invalidates running work until explicit reset", async () => {
  const id = await add(item);
  reply = async () => {
    await api("/articles/" + id + "/topics", "PUT", { topics: [] });
    assert(
      await ingest(source, {
        ...item,
        description: "Die Bahn ändert wegen des Umbaus ihren Fahrplan.",
      }),
    );
    return { topics: [candidate(finance, item.title)] };
  };
  await processTopicAnalysis();
  assert.equal((await detail(id)).topic_status, "manual");
  assert.deepEqual(assigned(await detail(id)), []);
  reply = () => ({ topics: [] });
  await api("/articles/" + id + "/topics/automatic", "POST");
  assert.equal((await detail(id)).topic_status, "pending");
  await processTopicAnalysis();
  assert.equal((await detail(id)).topic_status, "done");
  assert.deepEqual(assigned(await detail(id)), []);
});

test("An AI response for a replaced article cannot be applied", async () => {
  const id = await add(item);
  reply = async () => {
    if (calls === 1) {
      assert(
        await ingest(source, {
          ...item,
          title: "Neue Haltestelle am Rathaus",
          description: "Die Bahn hält dort ab morgen.",
          content: "",
        }),
      );
      return { topics: [candidate(finance, item.title)] };
    }
    return { topics: [candidate(transit, "Die Bahn hält dort ab morgen.")] };
  };
  await processTopicAnalysis();
  assert.equal(calls, 2);
  assert.deepEqual(assigned(await detail(id)), [transit]);
});

test("Catalog edits invalidate running responses and schedule reprocessing without backfilling AI", async () => {
  const id = await add(item);
  const older = await add({ ...item, url: item.url + "-older" });
  const manual = await add({ ...item, url: item.url + "-manual" });
  await api("/articles/" + manual + "/topics", "PUT", { topics: [tech] });
  await db.query(
    "UPDATE articles SET topic_revision=0,topic_status='legacy' WHERE id=?",
    [older],
  );
  reply = async () => {
    await api("/topics/" + finance, "PUT", {
      ...definitions[0],
      description: "Geänderte Beschreibung",
      keywords: ["Darlehen"],
      color: "#123456",
    });
    return { topics: [candidate(finance, item.title)] };
  };
  await processTopicAnalysis();
  assert.equal((await detail(id)).topic_status, "outdated");
  assert.equal(calls, 1);
  assert(
    !(await detail(id)).topic_results.some(
      (result: any) => result.origin === "ai",
    ),
  );
  await backfillTopics();
  assert.equal((await detail(older)).topic_status, "rules");
  assert.deepEqual(assigned(await detail(older)), [transit]);
  assert.deepEqual(assigned(await detail(manual)), [tech]);
  assert.equal((await detail(id)).topic_status, "pending");
  reply = () => ({ topics: [] });
  await processTopicAnalysis();
  assert.equal(calls, 2);
  await api("/topics/" + finance, "PUT", {
    ...definitions[0],
    color: "#123456",
  });
});

test("Invalid responses and outages leave rules, retry with delay, and stop after three attempts", async () => {
  const id = await add(item);
  reply = () => ({ topics: [candidate("invented", item.title)] });
  await processTopicAnalysis();
  assert.equal((await detail(id)).topic_status, "retry");
  assert.match((await detail(id)).topic_error, /Antwort/);
  await processTopicAnalysis();
  assert.equal(calls, 1);
  reply = () => 503;
  for (let i = 0; i < 2; i++) {
    await db.query(
      "UPDATE articles SET topic_next_run='2000-01-01' WHERE id=?",
      [id],
    );
    await processTopicAnalysis();
  }
  assert.equal((await detail(id)).topic_status, "failed");
  assert.match((await detail(id)).topic_error, /nicht verfügbar/);
  assert.deepEqual(assigned(await detail(id)), [finance, transit].sort());
  await processTopicAnalysis();
  assert.equal(calls, 3);
  config.aiBase = "";
  await api("/articles/" + id + "/topics/automatic", "POST");
  assert.equal((await detail(id)).topic_status, "rules");
  assert.equal(calls, 3);
});

test("Provisional topics do not trigger topic notifications or briefing groups", async () => {
  const id = await add(item);
  const user = (await db.query("SELECT id FROM users LIMIT 1"))[0].id;
  await db.query("INSERT INTO notification_rules VALUES(?,?,?,?,1)", [
    "rule",
    user,
    finance,
    1,
  ]);
  await notifications();
  assert.equal((await db.query("SELECT id FROM notifications")).length, 0);
  const clock = new Date("2026-10-30T12:00:00Z");
  await createBriefing(clock);
  const groups = JSON.parse(
    (await db.query("SELECT content FROM briefings WHERE day='2026-10-30'"))[0]
      .content,
  );
  assert.deepEqual(
    groups.map((group: any) => group.topic),
    ["Weitere Meldungen"],
  );
  reply = () => ({
    topics: [
      candidate(finance, item.title),
      candidate(transit, item.content, "mittel"),
    ],
  });
  await processTopicAnalysis();
  await createBriefing(clock);
  const updated = JSON.parse(
    (await db.query("SELECT content FROM briefings WHERE day='2026-10-30'"))[0]
      .content,
  );
  assert.deepEqual(
    updated.map((group: any) => group.topic),
    ["Finanzen"],
  );
  await notifications();
  await notifications();
  assert.deepEqual(
    (await db.query("SELECT article_id FROM notifications")).map(
      (row) => row.article_id,
    ),
    [id],
  );
  const legacy = await add({ ...item, url: item.url + "-legacy" });
  await db.query(
    "UPDATE articles SET topic_revision=0,topic_status='legacy' WHERE id=?",
    [legacy],
  );
  await backfillTopics();
  await notifications();
  assert.deepEqual(
    (await db.query("SELECT article_id FROM notifications")).map(
      (row) => row.article_id,
    ),
    [id],
  );
});

test("Rules backfill advances in batches and leaves a manual assignment alone", async () => {
  const id = await add(item);
  await api("/articles/" + id + "/topics", "PUT", { topics: [tech] });
  for (let i = 0; i < 27; i++) {
    await db.query(
      "INSERT INTO articles(id,source_name,url,title,fetched_at,updated_at,content_hash) VALUES(?,?,?,?,?,?,?)",
      [
        "legacy-" + i,
        source.name,
        item.url + "/" + i,
        "Ein Kredit erleichtert den Ausbau",
        "2026",
        "2026",
        "legacy",
      ],
    );
  }
  const countLegacy = async () =>
    (
      await db.query(
        "SELECT COUNT(*) AS count FROM articles WHERE topic_status='legacy' AND manual_topics=0",
      )
    )[0].count;
  await backfillTopics();
  assert.equal(await countLegacy(), 2);
  await backfillTopics();
  assert.equal(await countLegacy(), 0);
  await processTopicAnalysis();
  assert.equal(calls, 0);
  assert.deepEqual(assigned(await detail(id)), [tech]);
});

test("Migration upgrades an existing SQLite database without losing assignments", async () => {
  const legacy = new Database("", join(dir, "legacy.sqlite"));
  try {
    await legacy.exec(
      "CREATE TABLE migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL)",
    );
    for (const [i, file] of [
      "001_initial.sql",
      "002_article_image.sql",
    ].entries()) {
      await legacy.exec(
        readFileSync(new URL("../migrations/" + file, import.meta.url), "utf8"),
      );
      await legacy.query("INSERT INTO migrations VALUES(?,?)", [
        i + 1,
        "2026-01-01",
      ]);
    }
    await legacy.query(
      "INSERT INTO topics(id,name,color) VALUES('legacy-topic','Legacy','#000000')",
    );
    await legacy.query(
      "INSERT INTO articles(id,source_name,url,title,fetched_at,updated_at,content_hash,manual_topics) VALUES('legacy','source','https://example.org','Alt','2026','2026','hash',1)",
    );
    await legacy.query(
      "INSERT INTO article_topics VALUES('legacy','legacy-topic')",
    );
    await Promise.all([legacy.migrate(), legacy.migrate()]);
    assert.deepEqual(
      {
        ...(
          await legacy.query("SELECT manual_topics,topic_status FROM articles")
        )[0],
      },
      { manual_topics: 1, topic_status: "legacy" },
    );
    assert.deepEqual(
      { ...(await legacy.query("SELECT * FROM article_topics"))[0] },
      { article_id: "legacy", topic_id: "legacy-topic" },
    );
    assert.equal(
      (await legacy.query("SELECT revision FROM topic_catalog"))[0].revision,
      1,
    );
  } finally {
    await legacy.close();
  }
});
