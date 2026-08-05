// Met à niveau une base existante (colonnes ajoutées après la v1).
// Idempotent : chaque colonne/index n'est ajouté que s'il est absent.
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const conn = await mysql.createConnection({
  host: config.db.host, port: config.db.port,
  user: config.db.user, password: config.db.password,
  database: config.db.database,
});

async function hasColumn(table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.db.database, table, column]
  );
  return rows.length > 0;
}

async function hasIndex(table, index) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [config.db.database, table, index]
  );
  return rows.length > 0;
}

const steps = [
  { table: 'documents', column: 'is_favorite',
    sql: "ALTER TABLE documents ADD COLUMN is_favorite TINYINT(1) NOT NULL DEFAULT 0 AFTER expiry_date" },
  { table: 'documents', column: 'archived',
    sql: "ALTER TABLE documents ADD COLUMN archived TINYINT(1) NOT NULL DEFAULT 0 AFTER is_favorite" },
  { table: 'documents', column: 'archived_at',
    sql: "ALTER TABLE documents ADD COLUMN archived_at DATETIME DEFAULT NULL AFTER archived" },
];

for (const s of steps) {
  if (await hasColumn(s.table, s.column)) {
    console.log(`= ${s.table}.${s.column} déjà présent`);
  } else {
    await conn.query(s.sql);
    console.log(`+ ${s.table}.${s.column} ajouté`);
  }
}

if (await hasIndex('documents', 'idx_doc_archived')) {
  console.log('= index idx_doc_archived déjà présent');
} else {
  await conn.query('ALTER TABLE documents ADD KEY idx_doc_archived (archived)');
  console.log('+ index idx_doc_archived ajouté');
}

console.log('Migration terminée sur la base', config.db.database);
await conn.end();
