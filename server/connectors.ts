import { XMLParser, XMLValidator } from "fast-xml-parser";
import { load } from "cheerio";
import { fetchPublic } from "./network.js";
import { fetchInstagramRsshub, instagramUsername } from "./rsshub.js";
import type { Row } from "./db.js";
import { publicationDate } from "./publication-date.js";
export type Item = {
  title: string;
  url: string;
  description: string;
  content: string;
  published_at: string | null;
  author?: string | null;
  media_type?: string | null;
  image_url?: string | null;
};
export interface Connector {
  fetch(source: Row): Promise<Item[]>;
}
const arr = (v: any): any[] => (v ? (Array.isArray(v) ? v : [v]) : []);
const str = (v: any): string =>
  typeof v === "object" ? String(v?.["#text"] || "") : String(v || "");
export const plain = (html: string) =>
  load(html || "")
    .text()
    .replace(/\s+/g, " ")
    .trim();
function date(...values: unknown[]) {
  const dates = values.filter(value => value != null && value !== "")
    .map(value => publicationDate(str(value)));
  return dates.length && dates.every(value => value === dates[0]) ? dates[0] : null;
}
export function canonical(raw: string, base?: string) {
  const u = new URL(raw, base);
  if (!["http:", "https:"].includes(u.protocol))
    throw new Error("Ungültiger Artikellink");
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/.test(key)) u.searchParams.delete(key);
  return u.href;
}
function imageUrl(raw: unknown, base?: string) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 4096) return null;
  try {
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}
function feedImage(entry: any, base: string) {
  const groups = [entry, ...arr(entry["media:group"])];
  const media = groups.flatMap(group => arr(group["media:content"]));
  const thumbnails = [...groups, ...media].flatMap(group => arr(group["media:thumbnail"]));
  const attachments = [
    ...media,
    ...arr(entry.enclosure),
    ...arr(entry.link).filter(link => link["@_rel"] === "enclosure"),
  ];
  const image = [
    ...thumbnails.map(m => m["@_url"]),
    ...attachments.filter(m => m["@_medium"] === "image" || /^image\//i.test(m["@_type"] || ""))
      .map(m => m["@_url"] || m["@_href"]),
    entry.image?.url,
  ].map(value => imageUrl(typeof value === "string" ? value.replaceAll("&amp;", "&") : value, base)).find(Boolean);
  if (image) return image;
  for (const value of [entry["content:encoded"], entry.content, entry.description, entry.summary]) {
    const text = str(value);
    const html = /&lt;img\b/i.test(text) ? load(text).text() : text;
    if (/<img\b/i.test(html)) {
      const embedded = imageUrl(load(html)("img[src]").first().attr("src"), base);
      if (embedded) return embedded;
    }
  }
  return null;
}
export function parseFeed(xml: string, base: string): Item[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("DTD und externe XML-Entitäten werden nicht unterstützt.");
  if (XMLValidator.validate(xml) !== true)
    throw new Error("Ungültiges RSS/Atom-XML.");
  const p = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
  }).parse(xml);
  if (!p.rss && !p.feed && !p["rdf:RDF"])
    throw new Error("Kein RSS- oder Atom-Feed gefunden.");
  return arr(p.rss?.channel?.item || p.feed?.entry || p["rdf:RDF"]?.item)
    .slice(0, 100)
    .flatMap((e) => {
      try {
        const link =
          typeof e.link === "string"
            ? e.link
            : arr(e.link).find(
                (l) => !l["@_rel"] || l["@_rel"] === "alternate",
              )?.["@_href"];
        if (!link || !e.title) return [];
        return [
          {
            title: plain(str(e.title)).slice(0, 1000),
            url: canonical(link, base),
            description: plain(str(e.description || e.summary)).slice(0, 2000),
            content: plain(
              str(
                e["content:encoded"] || e.content || e.description || e.summary,
              ),
            ).slice(0, 30000),
            published_at: p.feed ? date(e.published) : date(e.pubDate),
            image_url: feedImage(e, base),
            author:
              plain(str(e["dc:creator"] || e.author?.name || e.author)).slice(
                0,
                200,
              ) || null,
          },
        ];
      } catch {
        return [];
      }
    });
}
export function parseWebsite(html: string, url: string): Item[] {
  const $ = load(html);
  if ($('[class*="paywall"], [id*="paywall"]').length)
    throw new Error("Mögliche Zugriffsschranke erkannt; keine Extraktion.");
  const nodes: any[] = [];
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const j = JSON.parse($(el).text());
      nodes.push(...arr(j).flatMap((x) => x["@graph"] || x));
    } catch {}
  }
  const article = nodes.find((n) =>
    arr(n["@type"]).some((t) => /Article|BlogPosting/.test(t)),
  );
  $("script,style,nav,footer,header,aside,form").remove();
  const title = plain(
    article?.headline ||
      $('meta[property="og:title"]').attr("content") ||
      $("h1").first().text() ||
      $("title").text(),
  );
  const content = plain(
    article?.articleBody ||
      $("article").first().text() ||
      $("main").first().text(),
  );
  if (!title || content.length < 80)
    throw new Error(
      "Keine ausreichenden statischen Artikelinhalte gefunden. RSS oder eine einzelne Artikelseite verwenden.",
    );
  return [
    {
      title: title.slice(0, 1000),
      url: canonical(url),
      description: plain(
        $('meta[name="description"]').attr("content") || "",
      ).slice(0, 2000),
      content: content.slice(0, 30000),
      image_url: [
        $('meta[property="og:image:secure_url"]').attr("content"),
        $('meta[property="og:image"]').attr("content"),
        ...arr(article?.image).map(i => typeof i === "string" ? i : i?.url || i?.contentUrl),
        $('meta[name="twitter:image"]').attr("content"),
        $("article img[src],main img[src]").first().attr("src"),
      ].map(value => imageUrl(value, url)).find(Boolean) || null,
      published_at: date(
        article?.datePublished,
          $('meta[property="article:published_time"]').attr("content"),
      ),
      author:
        plain(
          article?.author?.name ||
            $('meta[name="author"]').attr("content") ||
            "",
        ) || null,
    },
  ];
}
export async function detect(url: string) {
  if (/(^|\.)instagram\.com$/.test(new URL(url).hostname))
    return {
      type: "instagram",
      url,
      note: "Nur freigegebene professionelle Accounts über Meta Business Discovery; private und gewöhnliche Consumer-Accounts werden nicht unterstützt.",
    };
  const r = await fetchPublic(url);
  try {
    parseFeed(r.text, r.url);
    return { type: "rss", url: r.url, note: "RSS/Atom-Feed erkannt." };
  } catch {}
  const $ = load(r.text);
  const feed = $(
    'link[type="application/rss+xml"],link[type="application/atom+xml"]',
  )
    .first()
    .attr("href");
  if (feed)
    return {
      type: "rss",
      url: canonical(feed, r.url),
      note: "Verknüpfter Nachrichtenfeed gefunden.",
    };
  return {
    type: "website",
    url: r.url,
    note: "Statische Website. Artikelseite oder Newsroom mit article-Elementen verwenden; kein Browser- oder Paywall-Zugriff.",
  };
}
const rss: Connector = {
  async fetch(s) {
    const r = await fetchPublic(s.url);
    return parseFeed(r.text, r.url);
  },
};
const website: Connector = {
  async fetch(s) {
    const r = await fetchPublic(s.url);
    const $ = load(r.text);
    const feed = $(
      'link[type="application/rss+xml"],link[type="application/atom+xml"]',
    )
      .first()
      .attr("href");
    if (feed) return rss.fetch({ ...s, url: canonical(feed, r.url) });
    const links = [
      ...new Set(
        $("article h2 a,article h3 a, .news-list h2 a")
          .toArray()
          .map((e) => $(e).attr("href"))
          .filter(Boolean)
          .map((u) => canonical(u!, r.url)),
      ),
    ]
      .filter((u) => new URL(u).origin === new URL(r.url).origin)
      .slice(0, 10);
    if (!links.length) return parseWebsite(r.text, r.url);
    const items: Item[] = [];
    for (const link of links) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const page = await fetchPublic(link);
        items.push(...parseWebsite(page.text, page.url));
      } catch {}
    }
    if (!items.length)
      throw new Error("Keine zugänglichen Artikel im Newsroom gefunden.");
    return items;
  },
};
export async function fetchInstagramMeta(profile: string) {
    const username = instagramUsername(profile);
    const {
      META_ACCESS_TOKEN: token,
      META_IG_USER_ID: id,
      META_GRAPH_VERSION: version,
    } = process.env;
    if (!token || !id || !version)
      throw new Error(
        "Meta-Zugang fehlt. Bitte die Graph-API-Version, den Zugangstoken und die Instagram-Konto-ID in NEWSDECK einrichten.",
      );
    if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(id))
      throw new Error("Meta-Konfiguration prüfen: API-Version im Format vNN.N und numerische Instagram-Konto-ID erforderlich.");
    const u = new URL(`https://graph.facebook.com/${version}/${id}`);
    u.searchParams.set(
      "fields",
      `business_discovery.username(${username}){username,media.limit(50){caption,permalink,timestamp,media_type,media_url,thumbnail_url}}`,
    );
    const r = await fetch(u, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const data: any = await r.json().catch(() => null);
    const code = data?.error?.code;
    if (code === 190 || r.status === 401)
      throw new Error("Meta-Zugangstoken ist ungültig oder abgelaufen. Bitte den Token erneuern.");
    if (r.status === 429 || [4, 17, 32, 613].includes(code))
      throw new Error("Meta hat das Abruflimit erreicht. Bitte später erneut versuchen.");
    if (r.status === 403 || [10, 200].includes(code))
      throw new Error("Meta verweigert den Zugriff. Bitte App-Freigabe, Kontoverknüpfung und Leseberechtigungen prüfen.");
    if (!r.ok || data?.error)
      throw new Error(`Meta konnte das Profil nicht abrufen (HTTP ${r.status}). Bitte Profilname, Kontotyp und App-Zugang prüfen.`);
    const discovery = data?.business_discovery;
    if (typeof discovery?.username !== "string" || discovery.username.toLowerCase() !== username.toLowerCase())
      throw new Error("Meta hat das angefragte Profil nicht bestätigt. Business Discovery unterstützt freigegebene Business- und Creator-Profile.");
    const media = discovery.media;
    if (media != null && !Array.isArray(media.data))
      throw new Error("Meta hat ein unerwartetes Beitragsformat geliefert.");
    const items: Item[] = (media?.data ?? []).map((m: any) => {
      if (typeof m?.permalink !== "string" || !/^https:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/[\w-]+\/?(?:[?#].*)?$/i.test(m.permalink))
        throw new Error("Meta hat einen ungültigen Instagram-Beitragslink geliefert.");
      const caption = typeof m.caption === "string" ? m.caption : "";
      return {
        title: (caption || `Beitrag von ${username}`).slice(0, 160),
        url: canonical(m.permalink),
        content: caption,
        description: caption,
        published_at: date(m.timestamp),
        author: discovery.username,
        media_type: typeof m.media_type === "string" ? m.media_type : null,
        image_url: imageUrl(m.thumbnail_url) || (m.media_type !== "VIDEO" ? imageUrl(m.media_url) : null),
      };
    });
    return { items, hasMore: Boolean(media?.paging?.next) };
}
const instagram: Connector = {
  async fetch(s) { return (await fetchInstagramMeta(s.url)).items; },
};
export const connectors: Record<string, Connector> = {
  rss,
  instagram_rss: rss,
  instagram_rsshub: { async fetch(s) { return fetchInstagramRsshub(s.url); } },
  website,
  instagram,
};
