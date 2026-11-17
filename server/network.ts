import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
export const AGENT = "NewsdeckBot/1.0";
export function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return !(
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && [0, 168].includes(p[1])) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && [18, 19, 51].includes(p[1])) ||
      (p[0] === 203 && p[1] === 0)
    );
  }
  return (
    isIP(ip) === 6 &&
    /^2[0-9a-f]{3}:/i.test(ip) &&
    !ip.toLowerCase().startsWith("2001:db8:")
  );
}
export async function validateUrl(raw: string) {
  const u = new URL(raw);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !["80", "443"].includes(u.port))
  )
    throw new Error(
      "Nur öffentliche HTTP/HTTPS-Adressen auf Standardports sind zulässig.",
    );
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error(
      "Interne oder reservierte Netzwerkadressen sind nicht zulässig.",
    );
  return { url: u, address: addresses[0] };
}
export async function download(
  raw: string,
  redirects = 0,
  respectRobots = false,
): Promise<{
  text: string;
  body: Buffer;
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
}> {
  if (redirects > 4) throw new Error("Zu viele Weiterleitungen.");
  const { url, address } = await validateUrl(raw);
  return new Promise((resolve, reject) => {
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": AGENT,
          Accept:
            "application/rss+xml,application/atom+xml,text/html,application/xml;q=0.9,*/*;q=0.5",
          "Accept-Encoding": "identity",
        },
        lookup: ((_host: any, options: any, cb: any) =>
          options?.all
            ? cb(null, [address])
            : cb(null, address.address, address.family)) as any,
      },
      (res) => {
        const code = res.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
          res.resume();
          const target = new URL(res.headers.location, url).href;
          (respectRobots
            ? fetchPublic(target, redirects + 1)
            : download(target, redirects + 1)
          ).then(resolve, reject);
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c) => {
          size += c.length;
          if (size > 3_000_000) {
            req.destroy(new Error("Antwort überschreitet 3 MB."));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            text: body.toString("utf8"),
            body,
            url: url.href,
            status: code,
            headers: res.headers,
          });
        });
        res.on("error", reject);
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("Abruf nach 20 Sekunden abgebrochen.")),
      20_000,
    );
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
}
const robotsCache = new Map<string, { until: number; text: string }>();
export function robotsAllowed(text: string, path: string) {
  const groups: {
    agents: string[];
    rules: { allow: boolean; path: string }[];
  }[] = [];
  let g:
    | { agents: string[]; rules: { allow: boolean; path: string }[] }
    | undefined;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.split("#")[0].trim();
    const i = clean.indexOf(":");
    if (i < 0) continue;
    const key = clean.slice(0, i).trim().toLowerCase(),
      value = clean.slice(i + 1).trim();
    if (key === "user-agent") {
      if (!g || g.rules.length) {
        g = { agents: [], rules: [] };
        groups.push(g);
      }
      g.agents.push(value.toLowerCase());
    } else if (g && ["allow", "disallow"].includes(key) && value)
      g.rules.push({ allow: key === "allow", path: value });
  }
  const specific = groups.filter((g) =>
    g.agents.some((a) => a !== "*" && AGENT.toLowerCase().startsWith(a)),
  );
  const selected = specific.length
    ? specific
    : groups.filter((g) => g.agents.includes("*"));
  const rules = selected
    .flatMap((g) => g.rules)
    .filter((r) =>
      new RegExp(
        "^" +
          r.path
            .split("*")
            .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*")
            .replace(/\\\$$/, "$"),
      ).test(path),
    )
    .sort(
      (a, b) =>
        b.path.length - a.path.length || Number(b.allow) - Number(a.allow),
    );
  return !rules.length || rules[0].allow;
}
const lastRequest = new Map<string, number>();
export async function fetchPublic(
  raw: string,
  redirects = 0,
): Promise<{
  text: string;
  body: Buffer;
  url: string;
  status: number;
  headers: http.IncomingHttpHeaders;
}> {
  if (redirects > 4) throw new Error("Zu viele Weiterleitungen.");
  const u = new URL(raw);
  let cached = robotsCache.get(u.origin);
  if (!cached || cached.until < Date.now()) {
    const r = await download(u.origin + "/robots.txt");
    if (r.status >= 500 || [401, 403, 429].includes(r.status))
      throw new Error("robots.txt nicht verfügbar oder Zugriff eingeschränkt.");
    cached = {
      until: Date.now() + 3600_000,
      text: r.status === 404 ? "" : r.text,
    };
    robotsCache.set(u.origin, cached);
  }
  if (!robotsAllowed(cached.text, u.pathname + u.search))
    throw new Error("Abruf durch robots.txt ausgeschlossen.");
  const delays = [...cached.text.matchAll(/^crawl-delay:\s*([\d.]+)/gim)].map(
    (m) => Number(m[1]) * 1000,
  );
  const delay = Math.max(1000, ...delays);
  if (delay > 60000)
    throw new Error(
      "Quelle verlangt eine Crawl-Verzögerung über 60 Sekunden; separaten Connector konfigurieren.",
    );
  const wait = Math.max(
    0,
    (lastRequest.get(u.origin) || 0) + delay - Date.now(),
  );
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastRequest.set(u.origin, Date.now());
  const r = await download(raw, redirects, true);
  if (r.status < 200 || r.status >= 300)
    throw new Error(`Quelle antwortet mit HTTP ${r.status}.`);
  return r;
}
