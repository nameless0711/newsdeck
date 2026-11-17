import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { db } from "./db.js";
import { now } from "./config.js";
import { catalogRevision } from "./topic-classification.js";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  const a = scryptSync(password, salt, 64);
  const b = Buffer.from(key, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
export async function bootstrap() {
  await db.migrate();
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (
    email &&
    password &&
    !(await db.query("SELECT id FROM users LIMIT 1")).length
  ) {
    if (password.length < 14)
      throw new Error("ADMIN_PASSWORD benötigt mindestens 14 Zeichen.");
    await db.query(
      "INSERT INTO users(id,email,password_hash,role,created_at) VALUES(?,?,?,?,?)",
      [
        randomUUID(),
        email.toLowerCase(),
        hashPassword(password),
        "admin",
        now(),
      ],
    );
  }
  await db.transaction(async (q) => {
    await catalogRevision(q, true);
    if ((await q("SELECT id FROM topics LIMIT 1")).length ||
        (await q("SELECT key FROM settings WHERE key='topics_seeded'")).length)
      return;
    for (const [name, color, keywords] of [
      [
        "Politik",
        "#8670b8",
        ["regierung", "wahl", "parlament", "minister", "bundestag"],
      ],
      [
        "Wirtschaft",
        "#c18b46",
        ["wirtschaft", "unternehmen", "inflation", "konjunktur", "markt"],
      ],
      [
        "Technologie",
        "#508ba1",
        [
          "technologie",
          "software",
          "forschung",
          "ki",
          "künstliche intelligenz",
        ],
      ],
      [
        "Gesellschaft",
        "#b67575",
        ["gesellschaft", "bildung", "gesundheit", "kultur"],
      ],
      ["Region", "#659b75", ["regional", "stadt", "kommune"]],
    ] as [string, string, string[]][])
      await q(
        "INSERT INTO topics(id,name,color,keywords) VALUES(?,?,?,?)",
        [randomUUID(), name, color, JSON.stringify(keywords)],
      );
    await q(
      "INSERT INTO settings(key,value) VALUES('topics_seeded','true') ON CONFLICT(key) DO NOTHING",
    );
    await q("UPDATE topic_catalog SET revision=revision+1 WHERE id=1");
  });
}
export async function newSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.query("INSERT INTO sessions VALUES(?,?,?)", [
    digest(token),
    userId,
    new Date(Date.now() + 7 * 86400000).toISOString(),
  ]);
  return token;
}
