import { parseFeed } from "./connectors.js";
export function instagramUsername(raw: string) {
  const u = new URL(raw);
  const parts = u.pathname.split("/").filter(Boolean);
  if (
    !/^(www\.)?instagram\.com$/i.test(u.hostname) ||
    parts.length !== 1 ||
    !/^[a-zA-Z0-9._]{1,30}$/.test(parts[0]) ||
    ["p", "reel", "reels", "stories", "explore", "accounts"].includes(
      parts[0].toLowerCase(),
    )
  )
    throw new Error(
      "Bitte die öffentliche Instagram-Profiladresse eingeben, z. B. https://www.instagram.com/nasa/.",
    );
  return parts[0];
}
export function rsshubFeedUrl(profile: string) {
  const username = instagramUsername(profile);
  const base = new URL(process.env.RSSHUB_BASE_URL || "http://127.0.0.1:1200");
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw new Error("RSSHUB_BASE_URL ist ungültig.");
  return new URL("/instagram/user/" + encodeURIComponent(username), base).href;
}
export async function fetchInstagramRsshub(profile: string) {
  const url = rsshubFeedUrl(profile);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(60000),
      headers: { Accept: "application/rss+xml" },
    });
  } catch {
    throw new Error(
      "Lokaler RSSHub-Dienst nicht erreichbar oder Zeitüberschreitung. Start und RSSHub-Protokoll prüfen.",
    );
  }
  const reader = response.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 3_000_000) {
        await reader.cancel();
        throw new Error("RSSHub-Antwort überschreitet 3 MB.");
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!response.ok) {
    let message = "Instagram-Abruf ohne Anmeldung fehlgeschlagen.";
    try {
      message = JSON.parse(text).error || message;
    } catch {}
    throw new Error(
      `RSSHub HTTP ${response.status}: ${String(message).slice(0, 500)}`,
    );
  }
  const items = parseFeed(text, url);
  if (!items.length)
    throw new Error(
      "RSSHub liefert keine Beiträge. Das Profil ist leer oder Instagram beschränkt den Zugriff ohne Anmeldung.",
    );
  return items;
}
