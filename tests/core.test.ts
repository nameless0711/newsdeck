import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
const dir = mkdtempSync(join(tmpdir(), "newsdeck-tests-"));
process.env.SQLITE_PATH = join(dir, "test.sqlite");
process.env.DATABASE_URL = "";
process.env.NEWSDECK_LOCAL_NO_LOGIN = "false";
process.env.ADMIN_EMAIL = "tests@example.org";
process.env.ADMIN_PASSWORD = "test-password-not-for-production";
process.env.AI_BASE_URL = "http://127.0.0.1:1/v1";
process.env.AI_MODEL = "test-model";
const { db, Database } = await import("../server/db.js");
const { bootstrap, hashPassword, verifyPassword } = await import(
  "../server/auth.js"
);
const { parseFeed, parseWebsite, canonical, connectors } = await import(
  "../server/connectors.js"
);
const { publicAddress, robotsAllowed, validateUrl } = await import(
  "../server/network.js"
);
const { ingest, ruleTopics, similarity, analyze } = await import(
  "../server/processing.js"
);
const { claimSource, fetchSource } = await import(
  "../server/jobs.js"
);
const { createBriefing } = await import("../server/briefings.js");
const { makeApp } = await import("../server/api.js");
let server: ReturnType<ReturnType<typeof makeApp>["listen"]>;
let base: string;
let cookie = "";
let source: any;
let articleId: string;
before(async () => {
  await bootstrap();
  server = makeApp().listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.on("listening", r));
  base = "http://127.0.0.1:" + (server.address() as any).port;
  source = {
    id: randomUUID(),
    name: "TESTQUELLE (synthetisch)",
    url: "https://example.org/feed.xml",
    type: "rss",
    topics: "[]",
    priority: 7,
    interval_minutes: 30,
    rights_confirmed: 1,
    enabled: 1,
    next_run: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  await db.query(
    "INSERT INTO sources(id,name,url,type,topics,priority,interval_minutes,rights_confirmed,enabled,next_run,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    Object.values(source),
  );
});
after(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function request(
  path: string,
  method = "GET",
  body?: any,
  auth = true,
  origin = "http://localhost:3000",
) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, data: await r.json() };
}
const feed = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Bundestag beschließt neues Bildungsgesetz</title><link>https://example.org/news?utm_source=feed</link><description><![CDATA[<p>Der Bundestag beschließt neue Regeln für die Bildung.</p>]]></description><pubDate>Fri, 30 Oct 2026 09:00:00 GMT</pubDate></item></channel></rss>`;
test("Password hashes use salts and reject incorrect passwords", () => {
  const h = hashPassword("secret");
  assert(verifyPassword("secret", h));
  assert(!verifyPassword("other", h));
  assert.notEqual(h, hashPassword("secret"));
});
test("RSS extracts canonical URL, date and text", () => {
  const [i] = parseFeed(feed, "https://example.org/");
  assert.equal(i.url, "https://example.org/news");
  assert.equal(i.published_at, "2026-10-30T09:00:00.000Z");
  assert(!i.description.includes("<p>"));
});
test("Atom and absent dates", () => {
  const [i] = parseFeed(
    '<feed><entry><title>Atom-Test</title><link href="https://example.org/atom"/><summary>Test</summary><updated>2026-10-30</updated></entry></feed>',
    "https://example.org",
  );
  assert.equal(i.title, "Atom-Test");
  assert.equal(i.published_at, null);
});
test("Malformed feeds rejected", () =>
  assert.throws(() => parseFeed("<rss><broken>", "https://example.org")));
test("Feed previews choose images instead of video enclosures", () => {
  const xml = '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>Test</title><link>/article</link><enclosure url="/clip.mp4" type="video/mp4"/><media:group><media:thumbnail url="/preview.jpg?a=1&amp;b=2"/></media:group></item></channel></rss>';
  assert.equal(parseFeed(xml, "https://example.org/rss")[0].image_url, "https://example.org/preview.jpg?a=1&b=2");
  assert.equal(parseFeed(xml.replace(/<media:group>.*<\/media:group>/, ""), "https://example.org/rss")[0].image_url, null);
});
test("Website extraction removes navigation and scripts", () => {
  const [i] = parseWebsite(
    '<html><head><title>Testnachricht</title><meta property="og:image" content="/test.jpg"></head><body><nav>Navigation</nav><article><h1>Wichtige Nachricht</h1><p>' +
      "Eindeutig synthetischer Artikelinhalt für einen automatisierten Test. ".repeat(
        4,
      ) +
      "</p><script>hidden()</script></article></body></html>",
    "https://example.org/article",
  );
  assert(!i.content.includes("hidden"));
  assert(!i.content.includes("Navigation"));
  assert(i.content.length > 100);
  assert.equal(i.image_url, "https://example.org/test.jpg");
  assert.equal(i.published_at, null);
});
test("Paywall marker rejected", () =>
  assert.throws(() =>
    parseWebsite('<div class="paywall">locked</div>', "https://example.org"),
  ));
test("SSRF rejects loopback, private and reserved addresses", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "2001:db8::1",
  ])
    assert(!publicAddress(ip), ip);
  assert(publicAddress("8.8.8.8"));
  await assert.rejects(validateUrl("http://127.0.0.1"));
  await assert.rejects(validateUrl("file:///etc/passwd"));
  await assert.rejects(validateUrl("https://a:b@example.org"));
});
test("Robots longest matching rule and bot-specific group", () => {
  assert(!robotsAllowed("User-agent: *\nDisallow: /private", "/private/data"));
  assert(
    robotsAllowed("User-agent: *\nDisallow: /\nAllow: /public", "/public/news"),
  );
  assert(
    !robotsAllowed(
      "User-agent: NewsdeckBot\nDisallow: /\nUser-agent: *\nAllow: /",
      "/news",
    ),
  );
});
test("Authentication guards and wrong passwords", async () => {
  assert.equal((await request("/sources")).r.status, 401);
  assert.equal(
    (
      await request("/login", "POST", {
        email: "tests@example.org",
        password: "wrong",
      })
    ).r.status,
    401,
  );
  const { r } = await request("/login", "POST", {
    email: "tests@example.org",
    password: "test-password-not-for-production",
  });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie")!.split(";")[0];
  assert(r.headers.get("set-cookie")!.includes("HttpOnly"));
});
test("CSRF origin enforced", async () =>
  assert.equal(
    (await request("/seen", "POST", {}, true, "https://evil.example")).r.status,
    403,
  ));
test("Source URLs accept pasted spaces, missing scheme and international domains", async () => {
  const { sourceUrlSchema } = await import("../server/source-url.js");
  assert.equal(
    sourceUrlSchema.parse("  www.tagesschau.de/index~rss2.xml\n"),
    "https://www.tagesschau.de/index~rss2.xml",
  );
  assert.equal(
    sourceUrlSchema.parse("https://www.tagesschau.de/"),
    "https://www.tagesschau.de/",
  );
  assert.equal(
    sourceUrlSchema.parse("//example.org/feed?a=1&b=2"),
    "https://example.org/feed?a=1&b=2",
  );
  assert.equal(
    sourceUrlSchema.parse("https://münchen.de/"),
    "https://xn--mnchen-3ya.de/",
  );
  for (const invalid of [
    "",
    "https://",
    "https://example.org bad",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://a:b@example.org",
  ])
    assert.equal(sourceUrlSchema.safeParse(invalid).success, false, invalid);
  const error = await request("/sources/detect", "POST", { url: "https://" });
  assert.equal(error.r.status, 400);
  assert.match(error.data.error, /gültige Webadresse/);
});
test("Sources create, update, export, import and delete through API", async () => {
  const s = {
    name: "TEST API Quelle",
    url: " 8.8.8.8/test-feed ",
    type: "rss",
    enabled: false,
    rights_confirmed: false,
  };
  const created = await request("/sources", "POST", s);
  assert.equal(created.r.status, 201);
  assert.equal(
    (
      await request("/sources/" + created.data.id, "PUT", {
        ...s,
        name: "Bearbeitete Testquelle",
        interval_minutes: 60,
      })
    ).r.status,
    200,
  );
  const exported = await request("/sources/export");
  assert(exported.data.sources.some((x: any) => x.name === "Bearbeitete Testquelle"));
  assert.equal(
    exported.data.sources.find((x: any) => x.name === "Bearbeitete Testquelle").url,
    "https://8.8.8.8/test-feed",
  );
  assert.equal(
    (await request("/sources/" + created.data.id, "DELETE")).r.status,
    200,
  );
  const imported = await request("/sources/import", "POST", [s]);
  assert.equal(imported.data[0].ok, true);
  await request("/sources/" + imported.data[0].id, "DELETE");
});
test("Topics create, edit, cycle prevention", async () => {
  const r = await request("/topics", "POST", {
    name: "Testthema",
    color: "#123456",
    keywords: ["test"],
  });
  assert.equal(r.r.status, 201);
  assert.equal(
    (
      await request("/topics/" + r.data.id, "PUT", {
        name: "Geändert",
        color: "#123456",
        parent_id: r.data.id,
      })
    ).r.status,
    400,
  );
  assert.equal(
    (
      await request("/topics/" + r.data.id, "PUT", {
        name: "Geändert",
        color: "#654321",
      })
    ).r.status,
    200,
  );
});
test("Rules assign content topics and exclusions", async () => {
  const topics = await db.query("SELECT * FROM topics");
  const ids = ruleTopics(parseFeed(feed, "https://example.org")[0], topics);
  assert(ids.includes(topics.find((t) => t.name === "Politik")!.id));
  assert(ids.includes(topics.find((t) => t.name === "Gesellschaft")!.id));
  assert.deepEqual(
    ruleTopics(
      { title: "Politik", content: "Ausschluss" },
      [{ id: "t", keywords: '["Politik"]', exclusions: '["Ausschluss"]' }],
      ["t"],
    ),
    [],
  );
});
test("Ingestion persists and de-duplicates, source attribution survives", async () => {
  const item = parseFeed(feed, "https://example.org")[0];
  assert(await ingest(source, item));
  assert.equal(await ingest(source, { ...item, image_url: "https://example.org/preview.jpg" }), false);
  const rows = await db.query("SELECT * FROM articles");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source_name, source.name);
  assert.equal(rows[0].image_url, "https://example.org/preview.jpg");
  assert.equal((await db.query("SELECT * FROM revisions")).length, 0);
  articleId = rows[0].id;
  const reopened = new Database("", join(dir, "test.sqlite"));
  assert.equal(
    (await reopened.query("SELECT id FROM articles"))[0].id,
    articleId,
  );
  await reopened.close();
});
test("Changed articles create historical revisions", async () => {
  const item = parseFeed(feed, "https://example.org")[0];
  item.content += " Neue bestätigte Angaben in der synthetischen Testquelle.";
  assert(await ingest(source, item));
  assert.equal((await db.query("SELECT * FROM revisions")).length, 1);
});
test("Conservative duplicate clustering", () => {
  assert.equal(
    similarity(
      "Politik beschließt neue Regel",
      "Politik beschließt neue Regel",
    ),
    1,
  );
  assert(
    similarity("Politik beschließt neue Regel", "Sport gewinnt ein Turnier") <
      0.2,
  );
});
test("Search, date, relevance and topic filtering", async () => {
  let r = await request("/articles?q=Bundestag&min=7");
  assert.equal(r.data.total, 1);
  assert.equal(r.data.items[0].id, articleId);
  assert(r.data.items[0].topics.length);
  assert.equal((await request("/articles?q=unfindbar")).data.total, 0);
  assert.equal((await request("/articles?min=8")).data.total, 0);
  assert.equal((await request("/articles?to=2020-01-01")).data.total, 0);
});
test("Favorites and detail endpoint", async () => {
  assert.equal(
    (
      await request("/articles/" + articleId + "/favorite", "PUT", {
        enabled: true,
      })
    ).r.status,
    200,
  );
  assert.equal((await request("/articles?favorite=true")).data.total, 1);
  assert.equal(
    (await request("/articles/" + articleId)).data.revisions.length,
    1,
  );
});
test("AI outage keeps originals and schedules retry", async () => {
  const article = (
    await db.query("SELECT * FROM articles WHERE id=?", [articleId])
  )[0];
  assert.equal(await analyze(article), false);
  const updated = (
    await db.query("SELECT * FROM articles WHERE id=?", [articleId])
  )[0];
  assert.equal(updated.ai_status, "retry");
  assert(updated.content);
  assert(updated.ai_next_run);
});
test("AI summary leaves topic assignments and manual verification untouched", async () => {
  const { config } = await import("../server/config.js");
  const previousTopics = await db.query(
    "SELECT * FROM article_topics WHERE article_id=? ORDER BY topic_id", [articleId],
  );
  const mock = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary:
                  "Dies ist eine ausdrücklich synthetische Testzusammenfassung. Es wurden keine realen Fakten geprüft.",
                topics: ["invented-id"],
                relevance: 8,
                fact_status: "Einzelbericht",
                fact_note: "Nur eine Testquelle vorhanden.",
                development: "",
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", r));
  const oldBase = config.aiBase;
  config.aiBase = "http://127.0.0.1:" + (mock.address() as any).port;
  try {
    await request("/articles/" + articleId + "/fact", "PUT", {
      status: "Bestätigt",
      note: "Synthetische redaktionelle Prüfung für den Test.",
    });
    const a = (
      await db.query("SELECT * FROM articles WHERE id=?", [articleId])
    )[0];
    assert.equal(await analyze(a), true);
    const updated = (
      await db.query("SELECT * FROM articles WHERE id=?", [articleId])
    )[0];
    assert.equal(updated.ai_status, "done");
    assert.equal(updated.fact_status, "Bestätigt");
    assert.equal(updated.relevance, 8);
    assert.deepEqual(
      await db.query("SELECT * FROM article_topics WHERE article_id=? ORDER BY topic_id", [articleId]),
      previousTopics,
    );
  } finally {
    config.aiBase = oldBase;
    await new Promise<void>((r) => mock.close(() => r()));
  }
});
test("Only one worker claims a source", async () => {
  const a = await claimSource(source.id);
  assert(a);
  assert.equal(await claimSource(source.id), undefined);
  source = a;
});
test("Connector failure is logged and lease released", async () => {
  const original = connectors.rss;
  connectors.rss = {
    async fetch() {
      throw new Error("Simulierter Abruffehler");
    },
  };
  assert.equal(await fetchSource(source), 0);
  const s = (
    await db.query("SELECT * FROM sources WHERE id=?", [source.id])
  )[0];
  assert.equal(s.status, "error");
  assert.equal(s.lease_token, null);
  assert.equal(s.failures, 1);
  assert.equal(
    (await db.query("SELECT * FROM fetch_logs"))[0].error,
    "Simulierter Abruffehler",
  );
  connectors.rss = original;
});
test("Reader cannot create sources or users", async () => {
  await request("/users", "POST", {
    email: "reader@example.org",
    password: "reader-long-password",
    role: "reader",
  });
  const prior = cookie;
  const r = await request("/login", "POST", {
    email: "reader@example.org",
    password: "reader-long-password",
  });
  cookie = r.r.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await request("/sources", "POST", {})).r.status, 403);
  assert.equal((await request("/users", "POST", {})).r.status, 403);
  assert.equal((await request("/briefings/2026-10-30/rebuild", "POST")).r.status, 403);
  cookie = prior;
});
test("Briefings stored and daily idempotent", async () => {
  const clock = new Date("2026-10-30T12:00:00Z");
  await Promise.all([createBriefing(clock), createBriefing(clock)]);
  const rows = await db.query("SELECT * FROM briefings");
  assert.equal(rows.length, 1);
  assert(rows[0].content.includes("Bundestag"));
  const { data } = await request("/briefings");
  assert.equal(data[0].timezone, "Europe/Berlin");
  assert.equal((await request("/briefings/2026-10-30/rebuild", "POST")).r.status, 200);
  assert.equal((await request("/briefings/2026-02-30/rebuild", "POST")).r.status, 404);
});
test("Instagram RSS sources use RSS processing, retain type and reject profile URLs", async () => {
  assert.equal(connectors.instagram_rss, connectors.rss);
  const invalid = await request("/sources", "POST", {
    name: "Instagram Test",
    type: "instagram_rss",
    url: "https://www.instagram.com/test/",
    enabled: false,
  });
  assert.equal(invalid.r.status, 400);
  assert.match(invalid.data.error, /erzeugten RSS-Feed-Link/);
  const created = await request("/sources", "POST", {
    name: "Instagram RSS TEST",
    type: "instagram_rss",
    url: "https://8.8.8.8/instagram.xml",
    enabled: false,
  });
  assert.equal(created.r.status, 201);
  const source = (
    await db.query("SELECT * FROM sources WHERE id=?", [created.data.id])
  )[0];
  const [item] = parseFeed(
    "<rss><channel><item><title>InstagramTestbeitrag</title><link>https://www.instagram.com/p/TEST_ONLY/</link><description>Synthetischer Instagram-Text für den RSS-Test.</description></item></channel></rss>",
    source.url,
  );
  await ingest(source, item);
  const result = await request(
    "/articles?type=instagram_rss&q=InstagramTestbeitrag",
  );
  assert.equal(result.data.total, 1);
  assert.equal(
    result.data.items[0].url,
    "https://www.instagram.com/p/TEST_ONLY/",
  );
  const exported = await request("/sources/export");
  assert.equal(
    exported.data.sources.find((s: any) => s.name === "Instagram RSS TEST").type,
    "instagram_rss",
  );
  await db.query("DELETE FROM articles WHERE source_id=?", [source.id]);
  await request("/sources/" + source.id, "DELETE");
});
test("Local RSSHub only accepts Instagram profile paths and keeps internal URLs out of source input", async () => {
  const { instagramUsername, rsshubFeedUrl, fetchInstagramRsshub } =
    await import("../server/rsshub.js");
  assert.equal(instagramUsername("https://www.instagram.com/nasa/"), "nasa");
  for (const bad of [
    "http://127.0.0.1/admin",
    "https://evil.example/nasa",
    "https://www.instagram.com/p/abc",
    "https://www.instagram.com/stories/nasa",
  ])
    assert.throws(() => instagramUsername(bad));
  const old = process.env.RSSHUB_BASE_URL;
  const mock = createServer((req, res) => {
    if (req.url?.endsWith("/blocked")) {
      res
        .writeHead(502, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: "Instagram sperrt Gäste" }));
      return;
    }
    res.setHeader("Content-Type", "application/rss+xml");
    res.end(
      "<rss><channel><item><title>RSSHub Test</title><link>https://www.instagram.com/p/TEST_RSSHUB/</link><description>Test ohne Anmeldung</description></item></channel></rss>",
    );
  });
  await new Promise<void>((r) => mock.listen(0, "127.0.0.1", r));
  process.env.RSSHUB_BASE_URL =
    "http://127.0.0.1:" + (mock.address() as any).port;
  try {
    assert(
      rsshubFeedUrl("https://instagram.com/nasa/").endsWith(
        "/instagram/user/nasa",
      ),
    );
    const items = await fetchInstagramRsshub("https://instagram.com/nasa/");
    assert.equal(items[0].title, "RSSHub Test");
    const result = await request("/rsshub/test", "POST", {
      url: "https://instagram.com/nasa/",
    });
    assert.equal(result.r.status, 200);
    assert.equal(result.data.count, 1);
    await assert.rejects(
      fetchInstagramRsshub("https://instagram.com/blocked/"),
      /Instagram sperrt Gäste/,
    );
    const invalid = await request("/sources", "POST", {
      name: "Ungültiger RSSHub-Test",
      url: "http://127.0.0.1:1200/instagram/user/nasa",
      type: "instagram_rsshub",
      enabled: false,
    });
    assert.equal(invalid.r.status, 400);
  } finally {
    if (old === undefined) delete process.env.RSSHUB_BASE_URL;
    else process.env.RSSHUB_BASE_URL = old;
    await new Promise<void>((r) => mock.close(() => r()));
  }
});
test("Meta profile test checks the official API and keeps token errors private", async (t) => {
  const config = { META_ACCESS_TOKEN: "synthetic-token", META_GRAPH_VERSION: "v99.0", META_IG_USER_ID: "12345" };
  const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  Object.assign(process.env, config);
  const realFetch = globalThis.fetch;
  let expired = false;
  let calls = 0;
  t.mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
    if (!(input instanceof URL) || input.origin !== "https://graph.facebook.com") return realFetch(input, init);
    calls++;
    assert.equal(input.pathname, "/v99.0/12345");
    assert.match(input.searchParams.get("fields")!, /business_discovery\.username\(nasa\)/);
    assert.equal(input.searchParams.has("access_token"), false);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-token");
    return Promise.resolve(expired
      ? Response.json({ error: { code: 190, message: "synthetic-token" } }, { status: 400 })
      : Response.json({ business_discovery: { username: "nasa", media: { data: [
        { caption: "Synthetischer Beitrag", permalink: "https://www.instagram.com/p/TEST_META/", timestamp: "2026-11-09T10:00:00Z", media_type: "IMAGE" },
      ], paging: { next: "https://graph.facebook.com/?access_token=synthetic-token" } } } }));
  });
  const url = "https://www.instagram.com/nasa/";
  assert.equal((await request("/instagram/meta/test", "POST", { url }, false)).r.status, 401);
  assert.equal((await request("/instagram/meta/test", "POST", { url: "https://example.org/nasa" })).r.status, 400);
  assert.equal(calls, 0);
  const result = await request("/instagram/meta/test", "POST", { url });
  assert.equal(result.r.status, 200);
  assert.equal(result.data.count, 1);
  assert.equal(result.data.hasMore, true);
  assert.equal(result.data.sample[0].url, "https://www.instagram.com/p/TEST_META/");
  assert.equal((await connectors.instagram.fetch({ url }))[0].author, "nasa");
  assert.doesNotMatch(JSON.stringify(result.data), /synthetic-token/);
  expired = true;
  const error = await request("/instagram/meta/test", "POST", { url });
  assert.equal(error.r.status, 400);
  assert.match(JSON.stringify(error.data), /abgelaufen/);
  assert.doesNotMatch(JSON.stringify(error.data), /synthetic-token/);
});
test("Logout revokes server-side session", async () => {
  assert.equal((await request("/logout", "POST")).r.status, 200);
  assert.equal((await request("/me")).r.status, 401);
});
