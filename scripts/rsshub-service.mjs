// RSSHub runs separately from NEWSDECK, limited to public Instagram user feeds.
import http from "node:http";
import { download, robotsAllowed } from '../server/network.ts';
import { init, request } from "../.rsshub/node_modules/rsshub/dist-lib/pkg.mjs";
process.env.INSTAGRAM_COOKIE = "";
process.env.IG_COOKIE = "";
process.env.IG_USERNAME = "";
process.env.IG_PASSWORD = "";
await init({
  CACHE_TYPE: "memory",
  CACHE_EXPIRE: "3600",
  UA: "NewsdeckBot/1.0",
  NO_RANDOM_UA: "true",
  INSTAGRAM_COOKIE: "",
  IG_COOKIE: "",
  IG_USERNAME: "",
  IG_PASSWORD: "",
  LOGGER_LEVEL: "warn",
});
const escape = (s) =>
  String(s ?? "").replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const cache = new Map();
let active = false;
http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/healthz") {
      res.end(JSON.stringify({ ok: true, instagramLogin: false }));
      return;
    }
    if (!/^\/instagram\/user\/[a-zA-Z0-9._]{1,30}$/.test(path)) {
      res
        .writeHead(404)
        .end(
          JSON.stringify({
            error: "Nur öffentliche Instagram-Profilfeeds werden unterstützt.",
          }),
        );
      return;
    }
    const existing = cache.get(path);
    if (existing && existing.until > Date.now()) {
      res
        .writeHead(existing.status, { "Content-Type": existing.type })
        .end(existing.body);
      return;
    }
    if (active) {
      res
        .writeHead(429)
        .end(
          JSON.stringify({
            error:
              "RSSHub führt gerade einen Abruf aus. Bitte später erneut versuchen.",
          }),
        );
      return;
    }
    active = true;
    try {
      const robots = await download('https://www.instagram.com/robots.txt');
      if (robots.status !== 404 && (robots.status < 200 || robots.status >= 300)) throw new Error(`robots.txt nicht zugänglich (HTTP ${robots.status}).`);
      const username=path.split('/').at(-1);
      if(robots.status!==404 && !robotsAllowed(robots.text,`/${username}/`)) throw new Error('Instagram robots.txt schließt den Abruf mit NewsdeckBot aus.');
      const data = await request(path);
      if (!Array.isArray(data.item))
        throw new Error(JSON.stringify(data).slice(0, 800));
      const body =
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>' +
        escape(data.title) +
        "</title><link>" +
        escape(data.link) +
        "</link><description>" +
        escape(data.description) +
        "</description>" +
        data.item
          .map(
            (i) =>
              "<item><title>" +
              escape(i.title) +
              "</title><link>" +
              escape(i.link) +
              "</link><description>" +
              escape(i.description) +
              "</description>" +
              (typeof i.image === "string" ? '<media:thumbnail url="' + escape(i.image) + '"/>' : "") +
              (typeof i.pubDate === "string"
                ? "<pubDate>" + escape(i.pubDate) + "</pubDate>"
                : i.pubDate instanceof Date && Number.isFinite(+i.pubDate)
                ? "<pubDate>" + i.pubDate.toISOString() + "</pubDate>"
                : "") +
              "</item>",
          )
          .join("") +
        "</channel></rss>";
      cache.set(path, {
        until: Date.now() + 3600000,
        status: 200,
        type: "application/rss+xml; charset=utf-8",
        body,
      });
      res
        .writeHead(200, {
          "Content-Type": "application/rss+xml; charset=utf-8",
        })
        .end(body);
      console.log(
        JSON.stringify({
          at: new Date().toISOString(),
          path,
          count: data.item.length,
          login: false,
        }),
      );
    } catch (e) {
      const message =
        "Instagram liefert ohne Anmeldung keine zugänglichen Daten. " +
        String(e.message)
          .replace(/<[^>]+>/g, " ")
          .slice(0, 800);
      const body = JSON.stringify({ error: message });
      cache.set(path, {
        until: Date.now() + 300000,
        status: 502,
        type: "application/json",
        body,
      });
      res.writeHead(502).end(body);
      console.error(
        JSON.stringify({
          at: new Date().toISOString(),
          path,
          error: message,
          login: false,
        }),
      );
    } finally {
      active = false;
    }
  })
  .listen(Number(process.env.RSSHUB_PORT || 1200), "127.0.0.1", () =>
    console.log(
      "Lokaler RSSHub: http://127.0.0.1:1200 (ohne Instagram-Anmeldung)",
    ),
  );
