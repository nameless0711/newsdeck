import { parseWebsite } from "../server/connectors.js";
import { db } from "../server/db.js";
import { fetchPublic } from "../server/network.js";

try {
  const pending = await db.query(`
    SELECT a.id, a.url FROM articles a JOIN sources s ON s.id=a.source_id
    WHERE a.image_url IS NULL AND s.rights_confirmed=1
      AND s.type IN ('rss','website','instagram_rss','instagram_rsshub')
    ORDER BY a.fetched_at DESC
  `);
  const byHost = new Map<string, { id: string; url: string }[]>();
  for (const row of pending) {
    const url = URL.parse(row.url);
    if (!url || /(^|\.)(instagram\.com|instagr\.am)$/i.test(url.hostname)) continue;
    const group = byHost.get(url.hostname) ?? [];
    group.push({ id: row.id, url: row.url });
    byHost.set(url.hostname, group);
  }
  console.log(`Prüfe ${[...byHost.values()].reduce((n, rows) => n + rows.length, 0)} gespeicherte Meldungen.`);
  await Promise.all([...byHost].map(async ([host, rows]) => {
    let checked = 0, added = 0, empty = 0, restricted = 0;
    for (const article of rows) {
      checked++;
      try {
        const page = await fetchPublic(article.url);
        const image = parseWebsite(page.text, page.url)[0]?.image_url;
        if (image) {
          const updated = await db.query(
            "UPDATE articles SET image_url=? WHERE id=? AND image_url IS NULL RETURNING id",
            [image, article.id],
          );
          added += updated.length;
        } else empty++;
      } catch (error) {
        restricted++;
        if (/HTTP 429|robots\.txt nicht verfügbar/i.test((error as Error).message)) break;
      }
      if (checked % 25 === 0)
        console.log(`${host}: ${checked}/${rows.length} geprüft, ${added} ergänzt.`);
    }
    console.log({ host, checked, added, empty, restricted, remaining: rows.length - checked });
  }));
} finally {
  await db.close();
}
