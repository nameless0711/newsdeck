import { DatabaseSync } from "node:sqlite";
import pg from "pg";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "./config.js";
export type Row = Record<string, any>;
export type Query = (sql: string, args?: any[]) => Promise<Row[]>;
export class Database {
  sqlite?: DatabaseSync;
  pool?: pg.Pool;
  private sqliteTail = Promise.resolve();
  constructor(url = config.database, path = config.sqlite) {
    if (url) this.pool = new pg.Pool({ connectionString: url, max: 10 });
    else {
      mkdirSync(dirname(path), { recursive: true });
      this.sqlite = new DatabaseSync(path);
      this.sqlite.exec(
        "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;",
      );
    }
  }
  async query(sql: string, args: any[] = []): Promise<Row[]> {
    if (this.pool) {
      let i = 0;
      return (
        await this.pool.query(
          sql.replace(/\?/g, () => `$${++i}`),
          args,
        )
      ).rows;
    }
    return this.withSqlite(() => this.sqliteQuery(sql, args));
  }
  private sqliteQuery(sql: string, args: any[] = []) {
    return this.sqlite!.prepare(sql).all(...args) as Row[];
  }
  private async withSqlite<T>(fn: () => T | Promise<T>): Promise<T> {
    const previous = this.sqliteTail;
    let release!: () => void;
    this.sqliteTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  async exec(sql: string) {
    if (this.pool) await this.pool.query(sql);
    else await this.withSqlite(() => this.sqlite!.exec(sql));
  }
  async migrate() {
    await this.transaction(async (q) => {
      if (this.pool) await q("SELECT pg_advisory_xact_lock(848104, 1)");
      await q("CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
      if (this.pool) await q("LOCK TABLE migrations IN EXCLUSIVE MODE");
      const applied = new Set((await q("SELECT version FROM migrations")).map((row) => row.version));
      const migrations = [
        ["001_initial.sql"],
        ["002_article_image.sql"],
        ["003_article_topics.sql"],
        ["004_daily_briefings.sql", `004_daily_briefings.${this.pool ? "pg" : "sqlite"}.sql`],
        ["005_source_folders.sql"],
      ];
      for (const [index, files] of migrations.entries()) {
        const version = index + 1;
        if (applied.has(version)) continue;
        for (const filename of files) {
          const sql = readFileSync(new URL("../migrations/" + filename, import.meta.url), "utf8");
          if (this.sqlite) this.sqlite.exec(sql);
          else await q(sql);
        }
        await q("INSERT INTO migrations VALUES(?,?)", [version, new Date().toISOString()]);
      }
      if (this.pool) await q(
        "CREATE INDEX IF NOT EXISTS articles_search ON articles USING GIN(to_tsvector('simple',title || ' ' || content))",
      );
    });
  }
  async close() {
    if (this.sqlite) await this.withSqlite(() => this.sqlite!.close());
    await this.pool?.end();
  }
  async transaction<T>(
    fn: (q: Query) => Promise<T>,
  ): Promise<T> {
    if (this.pool) {
      const c = await this.pool.connect();
      try {
        await c.query("BEGIN");
        const result = await fn(async (sql, args = []) => {
          let i = 0;
          return (
            await c.query(
              sql.replace(/\?/g, () => `$${++i}`),
              args,
            )
          ).rows;
        });
        await c.query("COMMIT");
        return result;
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      } finally {
        c.release();
      }
    }
    return this.withSqlite(async () => {
      this.sqlite!.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(async (sql, args) => this.sqliteQuery(sql, args));
        this.sqlite!.exec("COMMIT");
        return result;
      } catch (e) {
        this.sqlite!.exec("ROLLBACK");
        throw e;
      }
    });
  }
}
export const db = new Database();
