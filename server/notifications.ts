import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { now } from "./config.js";
export async function notifications() {
  const rules = await db.query(
    "SELECT * FROM notification_rules WHERE enabled=1",
  );
  for (const r of rules) {
    const topicMatch = r.topic_id ? `AND EXISTS(
      SELECT 1 FROM article_topics t CROSS JOIN topic_catalog c
      WHERE t.article_id=a.id AND t.topic_id=? AND
      (a.manual_topics=1 OR (a.topic_notify=1 AND a.topic_revision=c.revision
        AND a.topic_status IN ('done','rules','failed')))
    )` : "";
    const filters = [
      r.min_relevance,
      new Date(Date.now() - 86400000).toISOString(),
      ...(r.topic_id ? [r.topic_id] : []),
    ];
    const rows = await db.query(
      `SELECT a.id FROM articles a WHERE a.relevance>=? AND a.fetched_at>? ${topicMatch}
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id=? AND n.article_id=a.id)
        ORDER BY a.fetched_at,a.id LIMIT 200`,
      [...filters, r.user_id],
    );
    for (const a of rows)
      await db.query(
        `INSERT INTO notifications(id,user_id,article_id,created_at)
         SELECT ?,?,a.id,? FROM articles a WHERE a.id=? AND a.relevance>=? AND a.fetched_at>? ${topicMatch}
         ON CONFLICT(user_id,article_id) DO NOTHING`,
        [randomUUID(), r.user_id, now(), a.id, ...filters],
      );
  }
  if (!process.env.SMTP_HOST) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  const pending = await db.query(
    "SELECT n.*,u.email,a.title,a.summary,a.description,a.url FROM notifications n JOIN users u ON u.id=n.user_id JOIN articles a ON a.id=n.article_id WHERE n.status='pending' AND n.attempts<8 AND (n.next_run IS NULL OR n.next_run<=?) LIMIT 20",
    [now()],
  );
  for (const n of pending) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM,
        to: n.email,
        subject: "NEWSDECK: " + n.title,
        text: `${n.title}\n\n${n.summary || n.description}\n\nOriginal: ${n.url}\n\nAutomatische Nachricht aufgrund Ihrer NEWSDECK-Regel.`,
        messageId: `<${n.id}@newsdeck.local>`,
      });
      await db.query(
        "UPDATE notifications SET status='sent',error=NULL WHERE id=?",
        [n.id],
      );
    } catch {
      await db.query(
        "UPDATE notifications SET attempts=attempts+1,next_run=?,error=? WHERE id=?",
        [
          new Date(
            Date.now() + Math.min(86400000, 60000 * 2 ** n.attempts),
          ).toISOString(),
          "SMTP-Versand fehlgeschlagen. Konfiguration und Serverprotokoll prüfen.",
          n.id,
        ],
      );
    }
  }
  transport.close();
}
