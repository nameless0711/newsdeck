import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { config, now } from "./config.js";
import { briefingDay, rebuildBriefing } from "./briefings.js";
import { digest, verifyPassword, newSession, hashPassword } from "./auth.js";
import { detect, fetchInstagramMeta } from "./connectors.js";
import { fetchPublic, validateUrl } from "./network.js";
import { sourceUrlSchema } from "./source-url.js";
import { instagramUsername, fetchInstagramRsshub } from "./rsshub.js";
import { articleLock, catalogRevision, classifyWithRules } from "./topic-classification.js";
import { createFolder, folderId, folderName, moveSources, renameFolder, requireFolder } from "./source-folders.js";
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        last_seen: string | null;
      };
    }
  }
}
const sourceSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().max(2000).default(""),
    url: sourceUrlSchema,
    type: z.enum([
      "rss",
      "website",
      "instagram",
      "instagram_rss",
      "instagram_rsshub",
    ]),
    topics: z.array(z.string()).max(100).default([]),
    priority: z.number().int().min(1).max(10).default(5),
    interval_minutes: z.number().int().min(5).max(10080).default(30),
    enabled: z.boolean().default(true),
    rights_confirmed: z.boolean().default(false),
    folder_id: folderId.optional(),
  })
  .superRefine((source, ctx) => {
    if (source.type === "instagram_rsshub" || source.type === "instagram") {
      try {
        instagramUsername(source.url);
      } catch (e) {
        ctx.addIssue({
          code: "custom",
          path: ["url"],
          message: (e as Error).message,
        });
      }
    }
    if (
      source.type === "instagram_rss" &&
      /(^|\.)(instagram\.com|instagr\.am)$/i.test(new URL(source.url).hostname)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message:
          "Bitte den erzeugten RSS-Feed-Link eintragen. Eine Instagram-Profil- oder Beitragsadresse ist kein RSS-Feed.",
      });
    }
  });
const topicSchema = z.object({
  name: z.string().trim().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  parent_id: z.string().nullable().default(null),
  description: z.string().max(2000).default(""),
  keywords: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  exclusions: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  semantic_exclusions: z.string().trim().max(2000).optional(),
});
const sourceImport = z.union([
  z.array(sourceSchema).max(500),
  z.object({
    version: z.literal(2),
    folders: z.array(folderName).max(500),
    sources: z.array(z.object({
      folder: folderName.nullable().default(null),
      topic_names: z.array(z.string().min(1).max(100)).max(100).default([]),
    }).loose()).max(500),
  }),
]);
export function makeApp() {
  const app = express();
  const localNoLogin = config.localNoLogin;
  const localAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (localNoLogin) {
    const origin = new URL(config.origin);
    if (
      config.host !== "127.0.0.1" ||
      !["localhost", "127.0.0.1"].includes(origin.hostname) ||
      origin.protocol !== "http:" || origin.origin !== config.origin ||
      Number(origin.port || 80) !== config.port || !localAdminEmail
    ) {
      throw new Error("Der Modus ohne Anmeldung benötigt eine lokale Adresse und ein eingerichtetes Administratorkonto.");
    }
    app.use((req, res, next) => {
      if (req.socket.remoteAddress !== "127.0.0.1" || req.headers.host !== origin.host) {
        res.status(403).json({ error: "NEWSDECK ist nur über seine lokale Adresse erreichbar." });
        return;
      }
      next();
    });
  }
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "data:", "https://*.cdninstagram.com", "https://*.fbcdn.net", "https://images.tagesschau.de", "https://images.sportschau.de"],
          "style-src": ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.get("/api/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== config.origin
    ) {
      res.status(403).json({ error: "Ungültiger Anfrageursprung." });
      return;
    }
    next();
  });
  app.post(
    "/api/login",
    rateLimit({ windowMs: 15 * 60000, limit: 15 }),
    async (req, res) => {
      const input = z
        .object({ email: z.email().max(250), password: z.string().max(500) })
        .parse(req.body);
      const u = (
        await db.query("SELECT * FROM users WHERE email=?", [
          input.email.toLowerCase(),
        ])
      )[0];
      const valid = verifyPassword(
        input.password,
        u?.password_hash || hashPassword("dummy-account-password"),
      );
      if (!u || !valid) {
        res.status(401).json({ error: "E-Mail oder Passwort stimmt nicht." });
        return;
      }
      const token = await newSession(u.id);
      res.cookie("newsdeck_session", token, {
        httpOnly: true,
        sameSite: "strict",
        secure: config.secure,
        maxAge: 7 * 86400000,
        path: "/",
      });
      res.json({ ok: true });
    },
  );
  app.use("/api", async (req, res, next) => {
    if (localNoLogin) {
      const [user] = await db.query(
        "SELECT id,email,role,last_seen FROM users WHERE email=? AND role='admin'",
        [localAdminEmail],
      );
      if (!user) {
        res.status(503).json({ error: "Das lokale NEWSDECK-Konto fehlt." });
        return;
      }
      req.user = user as NonNullable<express.Request["user"]>;
      next();
      return;
    }
    const token = req.cookies.newsdeck_session;
    if (!token) {
      res.status(401).json({ error: "Bitte anmelden." });
      return;
    }
    const u = (
      await db.query(
        "SELECT u.id,u.email,u.role,u.last_seen FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
        [digest(token), now()],
      )
    )[0];
    if (!u) {
      res.status(401).json({ error: "Sitzung abgelaufen." });
      return;
    }
    req.user = u as any;
    next();
  });
  const admin: express.RequestHandler = (req, res, next) => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Administratorrechte erforderlich." });
      return;
    }
    next();
  };
  app.get("/api/me", (req, res) => res.json({ ...req.user, localNoLogin }));
  app.post("/api/logout", async (req, res) => {
    if (req.cookies.newsdeck_session) {
      await db.query("DELETE FROM sessions WHERE token_hash=?", [
        digest(req.cookies.newsdeck_session),
      ]);
    }
    res.clearCookie("newsdeck_session", { path: "/" });
    res.json({ ok: true });
  });
  app.post("/api/seen", async (req, res) => {
    await db.query("UPDATE users SET last_seen=? WHERE id=?", [
      now(),
      req.user!.id,
    ]);
    res.json({ ok: true });
  });
  app.get("/api/status", async (req, res) => {
    const count = (await db.query("SELECT COUNT(*) AS total FROM articles"))[0];
    const recent = (
      await db.query(
        "SELECT COUNT(*) AS total FROM articles WHERE fetched_at>?",
        [req.user!.last_seen || new Date(Date.now() - 86400000).toISOString()],
      )
    )[0];
    const active = (
      await db.query("SELECT COUNT(*) AS total FROM sources WHERE enabled=1")
    )[0];
    const errors = (
      await db.query(
        "SELECT COUNT(*) AS total FROM sources WHERE status='error'",
      )
    )[0];
    const heartbeat = (
      await db.query("SELECT value FROM settings WHERE key='worker_heartbeat'")
    )[0]?.value;
    const last = (
      await db.query("SELECT MAX(last_success) AS value FROM sources")
    )[0]?.value;
    res.json({
      total: Number(count.total),
      newCount: Number(recent.total),
      sources: Number(active.total),
      errors: Number(errors.total),
      heartbeat,
      workerAlive:
        heartbeat && Date.now() - new Date(heartbeat).getTime() < 90000,
      lastSuccess: last,
      aiConfigured: !!(config.aiBase && config.aiModel),
      smtpConfigured: !!process.env.SMTP_HOST,
    });
  });
  app.get("/api/topics", async (_req, res) =>
    res.json(
      (
        await db.query(
          "SELECT t.*,(SELECT COUNT(*) FROM article_topics a WHERE a.topic_id=t.id) AS count FROM topics t ORDER BY t.name",
        )
      ).map((t) => ({
        ...t,
        keywords: JSON.parse(t.keywords),
        exclusions: JSON.parse(t.exclusions),
      })),
    ),
  );
  async function validateTopic(parent: string | null, id?: string) {
    const seen = new Set([id]);
    let next = parent;
    while (next) {
      if (seen.has(next)) throw new Error("Themen dürfen keinen Kreis bilden.");
      seen.add(next);
      const p = (
        await db.query("SELECT parent_id FROM topics WHERE id=?", [next])
      )[0];
      if (!p) throw new Error("Übergeordnetes Thema existiert nicht.");
      next = p.parent_id;
    }
  }
  app.post("/api/topics", admin, async (req, res) => {
    const t = topicSchema.parse(req.body);
    await validateTopic(t.parent_id);
    const id = randomUUID();
    await db.transaction(async (q) => {
      await catalogRevision(q, true);
      await q(
        "INSERT INTO topics(id,name,color,parent_id,description,keywords,exclusions,semantic_exclusions) VALUES(?,?,?,?,?,?,?,?)",
        [id, t.name, t.color, t.parent_id, t.description, JSON.stringify(t.keywords),
          JSON.stringify(t.exclusions), t.semantic_exclusions ?? ""],
      );
      await q("UPDATE topic_catalog SET revision=revision+1 WHERE id=1");
    });
    res.status(201).json({ id });
  });
  app.put("/api/topics/:id", admin, async (req, res) => {
    const t = topicSchema.parse(req.body);
    await validateTopic(t.parent_id, String(req.params.id));
    await db.transaction(async (q) => {
      await catalogRevision(q, true);
      const old = (await q("SELECT * FROM topics WHERE id=?", [req.params.id]))[0];
      if (!old) return;
      const keywords = JSON.stringify(t.keywords);
      const exclusions = JSON.stringify(t.exclusions);
      const semantic = t.semantic_exclusions ?? old.semantic_exclusions;
      await q(
        "UPDATE topics SET name=?,color=?,parent_id=?,description=?,keywords=?,exclusions=?,semantic_exclusions=? WHERE id=?",
        [t.name, t.color, t.parent_id, t.description, keywords, exclusions, semantic, req.params.id],
      );
      if (old.name !== t.name || old.description !== t.description || old.keywords !== keywords ||
          old.exclusions !== exclusions || old.semantic_exclusions !== semantic)
        await q("UPDATE topic_catalog SET revision=revision+1 WHERE id=1");
    });
    res.json({ ok: true });
  });
  app.delete("/api/topics/:id", admin, async (req, res) => {
    await db.transaction(async (q) => {
      await catalogRevision(q, true);
      const deleted = await q("DELETE FROM topics WHERE id=? RETURNING id", [req.params.id]);
      if (deleted.length) await q("UPDATE topic_catalog SET revision=revision+1 WHERE id=1");
    });
    res.json({ ok: true });
  });
  app.get("/api/source-folders", async (_req, res) => {
    const folders = await db.query(
      "SELECT f.id,f.name,(SELECT COUNT(*) FROM sources s WHERE s.folder_id=f.id) AS source_count FROM source_folders f ORDER BY f.name_key",
    );
    res.json(folders.map((folder) => ({ ...folder, source_count: Number(folder.source_count) })));
  });
  app.post("/api/source-folders", admin, async (req, res) => {
    const name = folderName.parse(req.body.name);
    res.status(201).json({ id: await createFolder(db.query.bind(db), name) });
  });
  app.put("/api/source-folders/:id", admin, async (req, res) => {
    await renameFolder(z.uuid().parse(req.params.id), folderName.parse(req.body.name));
    res.json({ ok: true });
  });
  app.delete("/api/source-folders/:id", admin, async (req, res) => {
    const deleted = await db.query("DELETE FROM source_folders WHERE id=? RETURNING id", [z.uuid().parse(req.params.id)]);
    if (!deleted.length) throw new Error("Quellenordner nicht gefunden.");
    res.json({ ok: true });
  });
  app.post("/api/sources/move", admin, async (req, res) => {
    const { source_ids, folder_id } = z.object({
      source_ids: z.array(z.string().min(1).max(100)).min(1).max(500),
      folder_id: folderId,
    }).parse(req.body);
    await moveSources(source_ids, folder_id);
    res.json({ ok: true });
  });
  app.get("/api/sources", async (_req, res) =>
    res.json(
      (await db.query("SELECT * FROM sources ORDER BY priority DESC,name")).map(
        (s) => ({
          ...s,
          topics: JSON.parse(s.topics),
          enabled: !!s.enabled,
          rights_confirmed: !!s.rights_confirmed,
        }),
      ),
    ),
  );
  async function saveSource(body: any, id?: string) {
    const s = sourceSchema.parse(body);
    const previousUrl = id ? (await db.query("SELECT url FROM sources WHERE id=?", [id]))[0]?.url : undefined;
    if (id && !previousUrl) throw new Error("Quelle nicht gefunden.");
    const validatedUrl = previousUrl !== s.url;
    if (validatedUrl) await validateUrl(s.url);
    const values = {
      name: s.name,
      description: s.description,
      url: s.url,
      type: s.type,
      topics: JSON.stringify(s.topics),
      priority: s.priority,
      interval_minutes: s.interval_minutes,
      enabled: Number(s.enabled),
      rights_confirmed: Number(s.rights_confirmed),
    };
    const sourceId = id ?? randomUUID();
    return db.transaction(async (q) => {
      await requireFolder(q, s.folder_id);
      const current = id ? (await q("SELECT * FROM sources WHERE id=?" + (db.pool ? " FOR UPDATE" : ""), [id]))[0] : undefined;
      if (id && !current) throw new Error("Quelle nicht gefunden.");
      if (current && Object.entries(values).every(([key, value]) => current[key] === value)) {
        if (s.folder_id !== undefined && s.folder_id !== current.folder_id)
          await q("UPDATE sources SET folder_id=? WHERE id=?", [s.folder_id, sourceId]);
        return sourceId;
      }
      if (current && !validatedUrl && current.url !== s.url)
        throw new Error("Die Quelle wurde inzwischen geändert. Bitte erneut öffnen.");
      if (current?.lease_until > now())
        throw new Error("Quelle wird gerade abgerufen. Bitte kurz warten.");
      for (const tid of s.topics)
        if (!(await q("SELECT id FROM topics WHERE id=?", [tid])).length)
          throw new Error("Unbekannte Themenzuordnung.");
      if (s.enabled && !s.rights_confirmed)
        throw new Error("Aktivierung benötigt bestätigte Abrufbedingungen.");
      const destination = s.folder_id === undefined ? current?.folder_id ?? null : s.folder_id;
      if (current) {
        await q(
          "UPDATE sources SET name=?,description=?,url=?,type=?,topics=?,priority=?,interval_minutes=?,enabled=?,rights_confirmed=?,next_run=?,folder_id=? WHERE id=?",
          [...Object.values(values), now(), destination, sourceId],
        );
      } else {
        await q(
          "INSERT INTO sources(name,description,url,type,topics,priority,interval_minutes,enabled,rights_confirmed,next_run,folder_id,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
          [...Object.values(values), now(), destination, sourceId, now()],
        );
      }
      return sourceId;
    });
  }
  app.post("/api/sources/detect", admin, async (req, res) =>
    res.json(
      await detect(z.object({ url: sourceUrlSchema }).parse(req.body).url),
    ),
  );
  app.post(
    "/api/instagram/meta/test",
    admin,
    rateLimit({ windowMs: 60000, limit: 5 }),
    async (req, res) => {
      const { url } = z.object({ url: sourceUrlSchema }).parse(req.body);
      const { items, hasMore } = await fetchInstagramMeta(url);
      res.json({
        type: "instagram",
        url,
        note: `Meta hat das Profil bestätigt. ${items.length} Beiträge auf der ersten Ergebnisseite verfügbar.${hasMore ? " Meta meldet weitere Ergebnisse." : ""}`,
        count: items.length,
        hasMore,
        sample: items.slice(0, 3).map(({ title, url, published_at, image_url }) => ({ title, url, published_at, has_image: !!image_url })),
      });
    },
  );
  app.post(
    "/api/rsshub/test",
    admin,
    rateLimit({ windowMs: 60000, limit: 5 }),
    async (req, res) => {
      const { url } = z.object({ url: sourceUrlSchema }).parse(req.body);
      const items = await fetchInstagramRsshub(url);
      res.json({
        type: "instagram_rsshub",
        url,
        note: `RSSHub: ${items.length} Beiträge ohne Instagram-Anmeldung abgerufen.`,
        count: items.length,
        sample: items
          .slice(0, 3)
          .map((i) => ({
            title: i.title,
            url: i.url,
            published_at: i.published_at,
          })),
      });
    },
  );
  app.post("/api/sources/import", admin, async (req, res) => {
    const input = sourceImport.parse(req.body);
    const portable = !Array.isArray(input);
    const rows = portable ? input.sources : input;
    const topics = portable ? await db.query("SELECT id,name FROM topics") : [];
    const folderByName = (name: string) => createFolder(db.query.bind(db), name, true);
    if (portable) for (const name of input.folders) await folderByName(name);
    const result = [];
    for (const s of rows) {
      const name = typeof s.name === "string" && s.name.trim() ? s.name : "Quelle ohne Namen";
      try {
        const source = "topic_names" in s ? {
          ...s,
          topics: s.topic_names.map((name) => {
            const matching = topics.filter((topic) => topic.name === name);
            if (matching.length !== 1) throw new Error(`Thema „${name}“ fehlt oder ist mehrdeutig.`);
            return matching[0].id;
          }),
          folder_id: s.folder ? await folderByName(s.folder) : null,
        } : { ...s, folder_id: undefined };
        const id = await saveSource(source);
        result.push({ name, id, ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Importfehler";
        result.push({
          name,
          ok: false,
          error: e instanceof z.ZodError
            ? e.issues.map((issue) => issue.path.join(".") + ": " + issue.message).join("; ")
            : /unique|duplicate/i.test(message) ? "Eine Quelle mit dieser URL existiert bereits." : message,
        });
      }
    }
    res.json(result);
  });
  app.get("/api/sources/export", admin, async (_req, res) => {
    const rows = await db.query(
      "SELECT s.name,s.description,s.url,s.type,s.topics,s.priority,s.interval_minutes,s.enabled,s.rights_confirmed,f.name AS folder FROM sources s LEFT JOIN source_folders f ON f.id=s.folder_id ORDER BY s.name,s.id",
    );
    const folders = await db.query("SELECT name FROM source_folders ORDER BY name_key");
    const topicNames = new Map((await db.query("SELECT id,name FROM topics")).map((topic) => [topic.id, topic.name]));
    res.attachment("newsdeck-quellen.json").json({
      version: 2,
      folders: folders.map((folder) => folder.name),
      sources: rows.map(({ topics, ...s }) => ({
        ...s,
        topic_names: (JSON.parse(topics) as string[]).flatMap((id) => topicNames.has(id) ? [topicNames.get(id)] : []),
        enabled: !!s.enabled,
        rights_confirmed: !!s.rights_confirmed,
      })),
    });
  });
  app.post("/api/sources", admin, async (req, res) =>
    res.status(201).json({ id: await saveSource(req.body) }),
  );
  app.put("/api/sources/:id", admin, async (req, res) =>
    res.json({ id: await saveSource(req.body, String(req.params.id)) }),
  );
  app.delete("/api/sources/:id", admin, async (req, res) => {
    if (
      (
        await db.query("SELECT id FROM sources WHERE id=? AND lease_until>?", [
          req.params.id,
          now(),
        ])
      ).length
    )
      throw new Error("Quelle wird gerade abgerufen. Bitte kurz warten.");
    await db.query("DELETE FROM sources WHERE id=?", [req.params.id]);
    res.json({ ok: true });
  });
  app.post("/api/sources/:id/fetch", admin, async (req, res) => {
    await db.query("UPDATE sources SET next_run=? WHERE id=?", [
      now(),
      req.params.id,
    ]);
    res.json({
      ok: true,
      note: "Abruf eingeplant; der Hintergrunddienst übernimmt.",
    });
  });
  app.get("/api/articles", async (req, res) => {
    const input = z
      .object({
        q: z.string().max(300).default(""),
        topic: z.string().optional(),
        source: z.string().optional(),
        folder: z.union([z.literal("unfiled"), z.uuid()]).optional(),
        type: z
          .enum([
            "rss",
            "website",
            "instagram",
            "instagram_rss",
            "instagram_rsshub",
          ])
          .optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        min: z.coerce.number().min(1).max(10).default(1),
        favorite: z.string().optional(),
        sort: z.enum(["latest", "relevance"]).default("latest"),
        page: z.coerce.number().int().min(1).max(100000).default(1),
      })
      .parse(req.query);
    const where = ["a.relevance>=?"];
    const args: any[] = [input.min];
    if (input.q) {
      if (db.pool) {
        where.push(
          "to_tsvector('simple',a.title || ' ' || a.content) @@ plainto_tsquery('simple',?)",
        );
        args.push(input.q);
      } else {
        where.push("LOWER(a.title || ' ' || a.content) LIKE ? ESCAPE '\\'");
        args.push("%" + input.q.toLowerCase().replace(/[\\%_]/g, "\\$&") + "%");
      }
    }
    if (input.topic) {
      where.push(
        "EXISTS(SELECT 1 FROM article_topics at WHERE at.article_id=a.id AND at.topic_id=?)",
      );
      args.push(input.topic);
    }
    if (input.source) {
      where.push("a.source_id=?");
      args.push(input.source);
    }
    if (input.folder === "unfiled") {
      where.push("s.id IS NOT NULL AND s.folder_id IS NULL");
    } else if (input.folder) {
      where.push("s.folder_id=?");
      args.push(input.folder);
    }
    if (input.type) {
      where.push("s.type=?");
      args.push(input.type);
    }
    if (input.from) {
      where.push("COALESCE(a.published_at,a.fetched_at)>=?");
      args.push(input.from);
    }
    if (input.to) {
      where.push("COALESCE(a.published_at,a.fetched_at)<?");
      args.push(
        new Date(new Date(input.to).getTime() + 86400000).toISOString().slice(0, -1),
      );
    }
    if (input.favorite === "true") {
      where.push(
        "EXISTS(SELECT 1 FROM favorites f WHERE f.article_id=a.id AND f.user_id=?)",
      );
      args.push(req.user!.id);
    }
    const clause = where.join(" AND ");
    const { total, rows } = await db.transaction(async (q) => {
      if (db.pool) await q("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const total = (
        await q(
          `SELECT COUNT(*) AS total FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE ${clause}`,
          args,
        )
      )[0].total;
      const rows = await q(
        `SELECT a.*,s.type AS source_type,EXISTS(SELECT 1 FROM favorites f WHERE f.article_id=a.id AND f.user_id=?) AS favorite,(SELECT COUNT(*) FROM articles c WHERE c.cluster_id=a.cluster_id) AS cluster_count FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE ${clause} ORDER BY ${input.sort === "relevance" ? "a.relevance DESC," : ""}COALESCE(a.published_at,a.fetched_at) DESC,a.fetched_at DESC,a.id LIMIT 30 OFFSET ?`,
        [req.user!.id, ...args, (input.page - 1) * 30],
      );
      return { total, rows };
    });
    for (const a of rows) {
      a.topics = await db.query(
        "SELECT t.* FROM topics t JOIN article_topics at ON at.topic_id=t.id WHERE at.article_id=?",
        [a.id],
      );
      delete a.content;
    }
    res.json({ items: rows, total: Number(total), page: input.page });
  });
  app.get("/api/articles/:id/image", async (req, res) => {
    const [article] = await db.query(
      "SELECT a.image_url,s.type,s.url AS source_url FROM articles a LEFT JOIN sources s ON s.id=a.source_id WHERE a.id=?",
      [req.params.id],
    );
    if (article?.image_url) {
      try {
        const url = new URL(article.image_url);
        const metaImage = article.type === "instagram" && /\.(?:cdninstagram\.com|fbcdn\.net)$/i.test(url.hostname);
        const ardImage = article.type === "rss" && ["images.tagesschau.de", "images.sportschau.de"].includes(url.hostname) &&
          /^(?:www\.)?(?:tagesschau|sportschau)\.de$/i.test(new URL(article.source_url).hostname);
        if ((metaImage || ardImage) && url.protocol === "https:" && !url.port && !url.username && !url.password) {
          // Let the browser display image links supplied by the official API or feed.
          res.set("Cache-Control", "private, max-age=300").redirect(302, url.href);
          return;
        }
        const image = await fetchPublic(article.image_url);
        const type = image.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
        if (type && /^image\/(?:jpeg|png|webp|gif|avif)$/.test(type)) {
          res.set("Cache-Control", "private, max-age=3600").type(type).send(image.body);
          return;
        }
      } catch { /* A missing preview should not affect the article. */ }
    }
    res.set("Cache-Control", "private, max-age=60").status(404).end();
  });
  app.get("/api/articles/:id", async (req, res) => {
    const a = (
      await db.query("SELECT a.*,c.revision AS current_topic_revision FROM articles a CROSS JOIN topic_catalog c WHERE a.id=?", [req.params.id])
    )[0];
    if (!a) {
      res.status(404).json({ error: "Meldung nicht gefunden." });
      return;
    }
    a.related = await db.query(
      "SELECT id,title,url,source_name,published_at,fetched_at FROM articles WHERE cluster_id=? ORDER BY fetched_at DESC",
      [a.cluster_id],
    );
    a.revisions = await db.query(
      "SELECT * FROM revisions WHERE article_id=? ORDER BY changed_at DESC",
      [a.id],
    );
    a.analyses = await db.query(
      "SELECT * FROM analyses WHERE article_id=? ORDER BY created_at DESC LIMIT 5",
      [a.id],
    );
    a.topics = await db.query(
      "SELECT topic_id FROM article_topics WHERE article_id=?",
      [a.id],
    );
    a.topic_results = a.manual_topics ? [] : await db.query(
      "SELECT r.*,t.name FROM article_topic_results r JOIN topics t ON t.id=r.topic_id WHERE r.article_id=? ORDER BY t.name",
      [a.id],
    );
    a.topic_status = a.manual_topics ? "manual"
      : a.topic_revision !== a.current_topic_revision ? "outdated" : a.topic_status;
    res.json(a);
  });
  app.put("/api/articles/:id/topics", admin, async (req, res) => {
    const ids = z.array(z.string()).max(100).parse(req.body.topics);
    const found = await db.transaction(async (q) => {
      await catalogRevision(q);
      const locked = await q(
        "UPDATE articles SET manual_topics=1,topic_token=NULL,topic_next_run=NULL,topic_error=NULL WHERE id=? RETURNING id",
        [req.params.id],
      );
      if (!locked.length) return false;
      await q("DELETE FROM article_topics WHERE article_id=?", [req.params.id]);
      for (const id of ids)
        await q(
          "INSERT INTO article_topics(article_id,topic_id) VALUES(?,?) ON CONFLICT DO NOTHING",
          [req.params.id, id],
        );
      return true;
    });
    if (!found) {
      res.status(404).json({ error: "Meldung nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  });
  app.post("/api/articles/:id/topics/automatic", admin, async (req, res) => {
    const found = await db.transaction(async (q) => {
      const revision = await catalogRevision(q);
      const article = (await q("SELECT * FROM articles WHERE id=?" + articleLock(), [req.params.id]))[0];
      if (!article) return false;
      if (!article.manual_topics && article.topic_revision === revision &&
          ["pending", "running", "retry"].includes(article.topic_status)) return true;
      await q("UPDATE articles SET manual_topics=0 WHERE id=?", [article.id]);
      await classifyWithRules(q, article, revision, true, false);
      return true;
    });
    if (!found) {
      res.status(404).json({ error: "Meldung nicht gefunden." });
      return;
    }
    res.json({ ok: true });
  });
  app.put("/api/articles/:id/favorite", async (req, res) => {
    const enabled = z.boolean().parse(req.body.enabled);
    if (enabled)
      await db.query(
        "INSERT INTO favorites VALUES(?,?) ON CONFLICT DO NOTHING",
        [req.user!.id, req.params.id],
      );
    else
      await db.query("DELETE FROM favorites WHERE user_id=? AND article_id=?", [
        req.user!.id,
        req.params.id,
      ]);
    res.json({ ok: true });
  });
  app.put("/api/articles/:id/fact", admin, async (req, res) => {
    const value = z
      .object({
        status: z.enum([
          "Bestätigt",
          "Einzelbericht",
          "Unbestätigte Behauptung",
          "Widersprüchliche Angaben",
        ]),
        note: z.string().min(10).max(1500),
      })
      .parse(req.body);
    await db.query("UPDATE articles SET fact_status=?,fact_note=? WHERE id=?", [
      value.status,
      "Redaktionelle Prüfung: " + value.note,
      req.params.id,
    ]);
    res.json({ ok: true });
  });
  app.get("/api/jobs", admin, async (_req, res) =>
    res.json(
      await db.query(
        "SELECT * FROM fetch_logs ORDER BY started_at DESC LIMIT 100",
      ),
    ),
  );
  app.get("/api/briefings", async (_req, res) => {
    const today = briefingDay(new Date());
    res.json(
      (
        await db.query("SELECT * FROM briefings WHERE timezone=? AND day<=? ORDER BY day DESC LIMIT 30", [
          config.briefingTimezone, today,
        ])
      ).map((b) => ({ ...b, is_today: b.day === today, content: JSON.parse(b.content) })),
    );
  });
  app.post("/api/briefings/:day/rebuild", admin, async (req, res) => {
    if (await rebuildBriefing(String(req.params.day))) res.json({ ok: true });
    else res.status(404).json({ error: "Kein Briefing für diesen Kalendertag vorhanden." });
  });
  app.get("/api/rules", async (req, res) =>
    res.json(
      await db.query("SELECT * FROM notification_rules WHERE user_id=?", [
        req.user!.id,
      ]),
    ),
  );
  app.post("/api/rules", async (req, res) => {
    const v = z
      .object({
        topic_id: z.string().nullable(),
        min_relevance: z.number().int().min(1).max(10),
      })
      .parse(req.body);
    const id = randomUUID();
    await db.query("INSERT INTO notification_rules VALUES(?,?,?,?,1)", [
      id,
      req.user!.id,
      v.topic_id,
      v.min_relevance,
    ]);
    res.status(201).json({ id });
  });
  app.delete("/api/rules/:id", async (req, res) => {
    await db.query("DELETE FROM notification_rules WHERE id=? AND user_id=?", [
      req.params.id,
      req.user!.id,
    ]);
    res.json({ ok: true });
  });
  app.get("/api/notifications", async (req, res) =>
    res.json(
      await db.query(
        "SELECT n.*,a.title FROM notifications n JOIN articles a ON a.id=n.article_id WHERE n.user_id=? ORDER BY n.created_at DESC LIMIT 100",
        [req.user!.id],
      ),
    ),
  );
  app.get("/api/export", admin, async (_req, res) => {
    res.attachment("newsdeck-archiv.json").json({
      exported_at: now(),
      articles: await db.query("SELECT * FROM articles"),
      topics: await db.query("SELECT * FROM topics"),
      sources: await db.query("SELECT id,name,description,url,type,topics,priority,interval_minutes,enabled,rights_confirmed,folder_id FROM sources"),
      source_folders: await db.query("SELECT id,name FROM source_folders"),
      assignments: await db.query("SELECT * FROM article_topics"),
      revisions: await db.query("SELECT * FROM revisions"),
      briefings: await db.query("SELECT * FROM briefings"),
    });
  });
  app.get("/api/users", admin, async (_req, res) =>
    res.json(await db.query("SELECT id,email,role,created_at FROM users")),
  );
  app.post("/api/users", admin, async (req, res) => {
    const v = z
      .object({
        email: z.email(),
        password: z.string().min(14).max(500),
        role: z.enum(["admin", "reader"]),
      })
      .parse(req.body);
    await db.query("INSERT INTO users VALUES(?,?,?,?,?,?)", [
      randomUUID(),
      v.email.toLowerCase(),
      hashPassword(v.password),
      v.role,
      null,
      now(),
    ]);
    res.status(201).json({ ok: true });
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Nicht gefunden." }),
  );
  app.use(express.static("dist"));
  app.get("/{*path}", (_req, res) =>
    res.sendFile("index.html", { root: "dist" }),
  );
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof z.ZodError) {
        res.status(400).json({
          error: err.issues
            .map((i) => i.path.join(".") + ": " + i.message)
            .join("; "),
        });
        return;
      }
      console.error("Anfrage fehlgeschlagen:", err.message);
      res.status(400).json({
        error: /unique|duplicate/i.test(err.message)
          ? "Dieser Eintrag existiert bereits."
          : /foreign key/i.test(err.message)
            ? "Verknüpfter Eintrag existiert nicht."
            : String(err.message).slice(0, 350),
      });
    },
  );
  return app;
}
