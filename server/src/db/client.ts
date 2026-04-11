import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

function applySchema(instance: Database.Database): void {
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  instance.exec(schema);
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH ?? path.join(__dirname, '../../data/sync.db');
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  applySchema(db);

  return db;
}

/** Substitui o singleton por uma instância fornecida. Uso exclusivo em testes. */
export function setDb(instance: Database.Database): void {
  db = instance;
}

/** Reseta o singleton. Uso exclusivo em testes. */
export function resetDb(): void {
  db = null;
}

/** Cria um banco em memória com o schema aplicado. Uso exclusivo em testes. */
export function createInMemoryDb(): Database.Database {
  const instance = new Database(':memory:');
  applySchema(instance);
  return instance;
}
