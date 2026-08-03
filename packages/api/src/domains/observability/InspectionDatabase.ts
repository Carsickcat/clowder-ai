import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import {
  PRAGMA_SETUP,
  SCHEMA_V10_INSPECTIONS,
  SCHEMA_V11_INSPECTION_INTEGRITY,
  SCHEMA_V12_INSPECTION_CANDIDATES,
  SCHEMA_V13_INSPECTION_REPORT_INTELLIGENCE,
} from '../memory/schema.js';

const INSPECTION_SCHEMA_VERSION = 13;

export interface OpenInspectionDatabaseOptions {
  readonly dataRoot: string;
}

export interface OpenedInspectionDatabase {
  readonly db: Database.Database;
  readonly path: string;
  close(): void;
}

function applyInspectionMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS inspection_schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const currentVersion =
    (
      db.prepare('SELECT MAX(version) AS version FROM inspection_schema_version').get() as {
        version: number | null;
      }
    ).version ?? 0;

  if (currentVersion < 10) {
    const applyV10 = db.transaction(() => {
      db.exec(SCHEMA_V10_INSPECTIONS);
      db.prepare('INSERT INTO inspection_schema_version (version, applied_at) VALUES (10, ?)').run(
        new Date().toISOString(),
      );
    });
    applyV10();
  }
  if (currentVersion < 11) {
    const applyV11 = db.transaction(() => {
      db.exec(SCHEMA_V11_INSPECTION_INTEGRITY);
      db.prepare('INSERT INTO inspection_schema_version (version, applied_at) VALUES (11, ?)').run(
        new Date().toISOString(),
      );
    });
    applyV11();
  }
  if (currentVersion < 12) {
    const applyV12 = db.transaction(() => {
      db.exec(SCHEMA_V12_INSPECTION_CANDIDATES);
      const revisionColumns = db.prepare('PRAGMA table_info(inspection_job_revisions)').all() as {
        name: string;
      }[];
      if (!revisionColumns.some((column) => column.name === 'origin_json')) {
        db.exec('ALTER TABLE inspection_job_revisions ADD COLUMN origin_json TEXT');
      }
      db.prepare('INSERT INTO inspection_schema_version (version, applied_at) VALUES (12, ?)').run(
        new Date().toISOString(),
      );
    });
    applyV12();
  }
  if (currentVersion < 13) {
    const applyV13 = db.transaction(() => {
      const reportColumns = db.prepare('PRAGMA table_info(inspection_reports)').all() as {
        name: string;
      }[];
      if (!reportColumns.some((column) => column.name === 'intelligence_json')) {
        db.exec(SCHEMA_V13_INSPECTION_REPORT_INTELLIGENCE);
      }
      db.prepare('INSERT INTO inspection_schema_version (version, applied_at) VALUES (13, ?)').run(
        new Date().toISOString(),
      );
    });
    applyV13();
  }

  const migratedVersion = (
    db.prepare('SELECT MAX(version) AS version FROM inspection_schema_version').get() as {
      version: number | null;
    }
  ).version;
  if (migratedVersion !== INSPECTION_SCHEMA_VERSION) {
    throw new Error(`Unsupported NOVA inspection schema version: ${String(migratedVersion)}`);
  }
}

export function openInspectionDatabase(options: OpenInspectionDatabaseOptions): OpenedInspectionDatabase {
  const dataRoot = resolve(options.dataRoot);
  const directory = resolve(dataRoot, 'nova-inspection');
  const path = resolve(directory, 'inspection.sqlite');
  mkdirSync(directory, { recursive: true });

  const db = new Database(path);
  try {
    db.exec(PRAGMA_SETUP);
    applyInspectionMigrations(db);
  } catch (error) {
    db.close();
    throw error;
  }

  return {
    db,
    path,
    close() {
      if (db.open) db.close();
    },
  };
}
