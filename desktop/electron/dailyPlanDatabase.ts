import { mkdirSync } from "node:fs";
import path from "node:path";
import type { DailyPlanSettings } from "../src/desktop/desktopTypes.js";
import {
  createDailyPlanFromSqliteRows,
  dailyPlanSqliteMigrations,
  getDailyPlanSqliteRows,
  type DailyPlanDaySqliteRow,
  type DailyPlanInfoSqliteRow,
} from "../src/domain/dailyPlanSqlite.js";
import type { DiagnosticsLogger } from "./diagnostics.js";

type StatementSyncLike = {
  run: (...values: unknown[]) => unknown;
  get: (...values: unknown[]) => unknown;
  all: (...values: unknown[]) => unknown[];
};

type DatabaseSyncLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementSyncLike;
  close: () => void;
};

type SqliteModuleLike = {
  DatabaseSync: new (filename: string) => DatabaseSyncLike;
};

export type DailyPlanDatabaseDiagnostics = {
  available: boolean;
  filePath: string;
  dayRows: number;
  migrations: string[];
  error?: string;
};

async function openSqliteDatabase(
  filePath: string,
): Promise<DatabaseSyncLike> {
  const importNativeModule = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<SqliteModuleLike>;
  const sqlite = await importNativeModule("node:sqlite");
  return new sqlite.DatabaseSync(filePath);
}

export class DailyPlanDatabase {
  private constructor(
    private readonly filePath: string,
    private readonly database: DatabaseSyncLike,
    private readonly diagnostics?: DiagnosticsLogger,
  ) {}

  static async open(
    filePath: string,
    diagnostics?: DiagnosticsLogger,
  ): Promise<DailyPlanDatabase | null> {
    try {
      mkdirSync(path.dirname(filePath), { recursive: true });
      const database = await openSqliteDatabase(filePath);
      const store = new DailyPlanDatabase(filePath, database, diagnostics);
      store.migrate();
      diagnostics?.info("daily_plan_database.opened", { filePath });
      return store;
    } catch (error) {
      diagnostics?.warn("daily_plan_database.unavailable", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  readSnapshot(fallback: DailyPlanSettings): DailyPlanSettings | null {
    try {
      const info = this.database.prepare(
        `SELECT title, target_minutes, start_date FROM daily_plan WHERE id = 1`,
      ).get() as DailyPlanInfoSqliteRow | undefined;
      const days = this.database.prepare(
        `SELECT date, status, remaining_ms FROM daily_plan_days ORDER BY date`,
      ).all() as DailyPlanDaySqliteRow[];

      return createDailyPlanFromSqliteRows(fallback, info, days);
    } catch (error) {
      this.diagnostics?.warn("daily_plan_database.read_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  writeSnapshot(plan: DailyPlanSettings): void {
    const rows = getDailyPlanSqliteRows(plan);
    const updatedAt = new Date().toISOString();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.prepare(
        `
          INSERT INTO daily_plan (id, title, target_minutes, start_date, updated_at)
          VALUES (1, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            target_minutes = excluded.target_minutes,
            start_date = excluded.start_date,
            updated_at = excluded.updated_at
        `,
      ).run(
        rows.info.title,
        rows.info.target_minutes,
        rows.info.start_date,
        updatedAt,
      );

      this.database.prepare("DELETE FROM daily_plan_days").run();
      const insertDay = this.database.prepare(
        `
          INSERT INTO daily_plan_days (date, status, remaining_ms, updated_at)
          VALUES (?, ?, ?, ?)
        `,
      );
      for (const day of rows.days) {
        insertDay.run(day.date, day.status, day.remaining_ms, updatedAt);
      }

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      this.diagnostics?.warn("daily_plan_database.write_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getDiagnostics(): DailyPlanDatabaseDiagnostics {
    try {
      const migrations = this.database.prepare(
        `SELECT id FROM schema_migrations ORDER BY id`,
      ).all() as Array<{ id: string }>;
      const row = this.database.prepare(
        `SELECT COUNT(*) AS dayRows FROM daily_plan_days`,
      ).get() as { dayRows: number };

      return {
        available: true,
        filePath: this.filePath,
        dayRows: row.dayRows,
        migrations: migrations.map((migration) => migration.id),
      };
    } catch (error) {
      return {
        available: true,
        filePath: this.filePath,
        dayRows: 0,
        migrations: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  close(): void {
    this.database.close();
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const hasMigration = this.database.prepare(
      "SELECT id FROM schema_migrations WHERE id = ?",
    );
    const insertMigration = this.database.prepare(
      "INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
    );

    for (const migration of dailyPlanSqliteMigrations) {
      if (hasMigration.get(migration.id)) {
        continue;
      }

      this.database.exec("BEGIN IMMEDIATE");
      try {
        this.database.exec(migration.sql);
        insertMigration.run(migration.id, new Date().toISOString());
        this.database.exec("COMMIT");
      } catch (error) {
        this.database.exec("ROLLBACK");
        throw error;
      }
    }
  }
}
