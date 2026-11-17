import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, type Query } from "./db.js";

const nameKey = (name: string) =>
  name.normalize("NFKC").trim().toLowerCase().toUpperCase().normalize("NFKC");
const reserved = new Set(["Alle Quellen", "Ohne Ordner"].map(nameKey));

export const folderName = z
  .string()
  .trim()
  .min(1, "Bitte einen Ordnernamen eingeben.")
  .max(80, "Ordnernamen dürfen höchstens 80 Zeichen haben.")
  .refine(
    (name) => nameKey(name).length > 0 && !reserved.has(nameKey(name)),
    "Dieser Ordnername ist reserviert.",
  );
export const folderId = z.uuid().nullable();

export async function createFolder(q: Query, name: string, reuse = false) {
  const key = nameKey(name);
  const id = randomUUID();
  const inserted = await q(
    "INSERT INTO source_folders(id,name,name_key) VALUES(?,?,?) ON CONFLICT(name_key) DO NOTHING RETURNING id",
    [id, name, key],
  );
  if (inserted.length) return id;
  if (reuse) {
    const existing = (
      await q("SELECT id FROM source_folders WHERE name_key=?", [key])
    )[0];
    if (existing) return existing.id as string;
  }
  throw new Error("Ein Ordner mit diesem Namen existiert bereits.");
}

export async function renameFolder(id: string, name: string) {
  const rows = await db.query(
    "UPDATE source_folders SET name=?,name_key=? WHERE id=? RETURNING id",
    [name, nameKey(name), id],
  );
  if (!rows.length) throw new Error("Quellenordner nicht gefunden.");
}

export async function requireFolder(q: Query, id: string | null | undefined) {
  if (
    id &&
    !(
      await q(
        "SELECT id FROM source_folders WHERE id=?" +
          (db.pool ? " FOR KEY SHARE" : ""),
        [id],
      )
    ).length
  )
    throw new Error("Quellenordner nicht gefunden.");
}

export async function moveSources(ids: string[], destination: string | null) {
  const unique = [...new Set(ids)];
  const list = unique.map(() => "?").join(",");
  await db.transaction(async (q) => {
    await requireFolder(q, destination);
    const found = await q(
      `SELECT id FROM sources WHERE id IN (${list}) ORDER BY id` +
        (db.pool ? " FOR UPDATE" : ""),
      unique,
    );
    if (found.length !== unique.length)
      throw new Error(
        "Mindestens eine der ausgewählten Quellen existiert nicht mehr.",
      );
    await q(`UPDATE sources SET folder_id=? WHERE id IN (${list})`, [
      destination,
      ...unique,
    ]);
  });
}
