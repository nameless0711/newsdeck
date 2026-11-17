import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "newsdeck-briefings-"));
process.env.DATABASE_URL = "";
process.env.SQLITE_PATH = join(dir, "briefings.sqlite");
process.env.BRIEFING_TIMEZONE = "Europe/Berlin";
const { db } = await import("../server/db.js");
const { briefingBounds, briefingDay, createBriefing, rebuildBriefing } = await import("../server/briefings.js");
const { ingest } = await import("../server/processing.js");
const { parseFeed, parseWebsite } = await import("../server/connectors.js");
const { publicationDate } = await import("../server/publication-date.js");

after(async () => {
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});

test("Publication metadata requires a valid, unambiguous instant", () => {
  for (const raw of [
    null, "", "2026-11-09", "2026-11-09T09:00:00", "09/11/2026 09:00",
    "2026-02-29T00:00:00Z", "2026-11-09T24:00:00Z", "2026-11-09T12:00:00+99:00",
    "Mon, 30 Oct 2026 09:00:00 GMT", "30 Oct 2026 09:00:00 CET",
  ]) assert.equal(publicationDate(raw), null, String(raw));
  assert.equal(publicationDate("2026-11-09T00:00:00+01:00"), "2026-11-08T23:00:00.000Z");
  assert.equal(publicationDate("Fri, 30 Oct 2026 09:00:00 +0100"), "2026-10-30T08:00:00.000Z");
  const atom = (metadata: string) => parseFeed(
    `<feed><entry><title>Test</title><link href="/artikel"/>${metadata}</entry></feed>`,
    "https://example.org",
  )[0].published_at;
  assert.equal(atom("<updated>2026-11-09T12:00:00Z</updated>"), null);
  assert.equal(atom("<published>2026-11-08T12:00:00Z</published><updated>2026-11-09T12:00:00Z</updated>"),
    "2026-11-08T12:00:00.000Z");
  const website = (metadata: string) => parseWebsite(
    `<h1>Test</h1><article>${"Inhalt ".repeat(20)}</article>${metadata}`,
    "https://example.org/artikel",
  )[0].published_at;
  assert.equal(website('<meta property="article:modified_time" content="2026-11-09T12:00:00Z">'), null);
  assert.equal(website('<meta property="article:published_time" content="2026-11-09T12:00:00Z">'),
    "2026-11-09T12:00:00.000Z");
  assert.equal(website('<meta property="article:published_time" content="2026-11-09T12:00:00Z"><script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-11-08T12:00:00Z"}</script>'), null);
});

test("Local calendar boundaries account for UTC date differences and both DST transitions", () => {
  assert.equal(briefingDay(new Date("2026-11-08T23:00:00Z")), "2026-11-09");
  assert.equal(briefingDay(new Date("2026-11-09T00:00:00Z"), "America/New_York"), "2026-11-08");
  assert.deepEqual(briefingBounds("2026-03-29"), {
    start: "2026-03-28T23:00:00.000Z",
    end: "2026-03-29T22:00:00.000Z",
  });
  assert.deepEqual(briefingBounds("2026-10-25"), {
    start: "2026-10-24T22:00:00.000Z",
    end: "2026-10-25T23:00:00.000Z",
  });
});

test("Migration preserves legacy snapshots and refreshes only the affected calendar days", async () => {
  await db.exec(readFileSync(new URL("../migrations/001_initial.sql", import.meta.url), "utf8"));
  await db.exec("CREATE TABLE migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO migrations VALUES(1,'before');");
  await db.query("INSERT INTO briefings VALUES('legacy','2026-11-07','[{}]','before')");
  await db.query(`INSERT INTO articles(id,source_name,url,title,published_at,fetched_at,updated_at,content_hash)
    VALUES('legacy','Quelle','https://example.org/legacy','Altbestand','2026-11-09T00:00:00.000Z','before','before','old')`);
  await db.migrate();
  await db.migrate();
  assert.equal((await db.query("SELECT content FROM briefing_legacy_backup"))[0].content, "[{}]");
  assert.equal((await db.query("SELECT published_at FROM articles WHERE id='legacy'"))[0].published_at, "2026-11-09T00:00:00.000Z");

  const source = { id: "source", name: "Quelle", priority: 6, topics: "[]" };
  await db.query("INSERT INTO sources(id,name,url,type,next_run,created_at) VALUES(?,?,?,?,?,?)",
    [source.id, source.name, "https://example.org/feed", "rss", "before", "before"]);
  const add = (title: string, published_at: string | null) => ingest(source, {
    title, url: "https://example.org/" + title, description: "Quellenauszug", content: "Beitragstext", published_at,
  });
  const clock = new Date("2026-11-09T12:00:00Z");
  const today = "2026-11-09";
  const yesterday = "2026-11-08";
  const read = async (day: string) => (await db.query("SELECT * FROM briefings WHERE day=?", [day]))[0];
  const titles = async (day: string) => JSON.parse((await read(day)).content)
    .flatMap((group: { items: { title: string }[] }) => group.items.map(item => item.title)).sort();

  await add("today", "2026-11-09T10:00:00Z");
  await add("yesterday", "2026-11-08T22:59:59.9999Z");
  await add("midnight", "2026-11-08T23:00:00Z");
  await add("next-midnight", "2026-11-09T23:00:00Z");
  await add("future", "2026-11-09T12:00:00.0001Z");
  await add("missing", null);
  await add("invalid", "2026-02-30T12:00:00Z");
  await add("ambiguous", "2026-11-09T10:00:00");
  await db.query("UPDATE articles SET fetched_at=? WHERE title IN ('today','yesterday')", [clock.toISOString()]);
  await Promise.all([createBriefing(clock), createBriefing(clock)]);
  assert.deepEqual(await titles(today), ["midnight", "today"]);
  assert.deepEqual(await titles(yesterday), ["yesterday"]);
  assert.deepEqual(await titles("2026-11-07"), []);
  assert.equal((await db.query("SELECT COUNT(*) AS total FROM briefings"))[0].total, 3);
  assert.equal((await db.query("SELECT COUNT(*) AS total FROM articles"))[0].total, 9);
  const first = await read(today);
  await createBriefing(new Date(+clock + 1));
  assert.deepEqual(await titles(today), ["future", "midnight", "today"]);
  const updated = await read(today);
  assert.equal(updated.id, first.id);
  assert.equal(updated.updated_at, "2026-11-09T12:00:00.001Z");
  await createBriefing(new Date(+clock + 2));
  assert.deepEqual(await read(today), updated);

  await add("later", "2026-11-09T11:00:00Z");
  await add("late", "2026-11-06T11:00:00Z");
  await db.query("UPDATE articles SET updated_at=?,summary=? WHERE title='yesterday'", [clock.toISOString(), "Neue Analyse"]);
  await createBriefing(new Date(+clock + 3));
  assert.deepEqual(await titles(today), ["future", "later", "midnight", "today"]);
  assert.deepEqual(await titles("2026-11-06"), ["late"]);
  assert.match((await read(yesterday)).content, /Neue Analyse/);
  const before = (await db.query("SELECT updated_at FROM articles WHERE title='late'"))[0];
  assert.equal(await add("late", "2026-11-09T08:00:00Z"), false);
  assert.deepEqual(await db.query("SELECT updated_at FROM articles WHERE title='late'"), [before]);
  await createBriefing(new Date(+clock + 4));
  assert.deepEqual(await titles("2026-11-06"), []);
  assert.deepEqual(await titles(today), ["future", "late", "later", "midnight", "today"]);

  const id = (await db.query("SELECT id FROM articles WHERE title='late'"))[0].id;
  await db.query("INSERT INTO topics(id,name,color) VALUES('topic','Rubrik','#345678')");
  await db.query("UPDATE articles SET manual_topics=1 WHERE id=?", [id]);
  await db.query("INSERT INTO article_topics VALUES(?,'topic')", [id]);
  await createBriefing(new Date(+clock + 5));
  const [group] = JSON.parse((await read(today)).content);
  assert.equal(group.topic, "Rubrik");
  assert.deepEqual(group.items.map((item: { title: string }) => item.title), ["late"]);
  await db.query("UPDATE topics SET name='Neue Rubrik' WHERE id='topic'");
  await createBriefing(new Date(+clock + 6));
  assert.match((await read(today)).content, /Neue Rubrik/);

  await add("yesterday", null);
  assert.equal(await rebuildBriefing(yesterday, new Date(+clock + 7)), true);
  assert.deepEqual(await titles(yesterday), []);
  await createBriefing(new Date("2026-11-09T23:00:00Z"));
  assert.deepEqual(await titles("2026-11-10"), ["next-midnight"]);
});

test("Relevance limit applies after date filtering and marks a shortened selection", async () => {
  const timestamp = "2026-11-11T00:00:00.000Z";
  await db.transaction(async (q) => {
    for (let i = 0; i <= 200; i++) {
      await q(`INSERT INTO articles(id,source_name,url,title,published_at,publication_verified,fetched_at,updated_at,content_hash,relevance)
        VALUES(?,'Quelle',?,?,?,?,?,?,?,?)`,
        [`bulk-${i}`, `https://example.org/bulk-${i}`, `Meldung ${i}`, timestamp, 1, timestamp, timestamp, "hash", i === 0 ? 1 : 9]);
    }
  });
  await createBriefing(new Date("2026-11-11T12:00:00Z"));
  const [briefing] = await db.query("SELECT content,truncated FROM briefings WHERE day='2026-11-11'");
  const [group] = JSON.parse(briefing.content);
  assert.equal(briefing.truncated, 1);
  assert.equal(group.items.length, 200);
  assert.equal(new Set(group.items.map((item: { id: string }) => item.id)).size, 200);
  assert(!group.items.some((item: { id: string }) => item.id === "bulk-0"));
});
