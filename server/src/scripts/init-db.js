// Initialise le schéma de la base à partir de src/db/schema.sql
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.resolve(__dirname, '../db/schema.sql'), 'utf8');

const conn = await mysql.createConnection({
  host: config.db.host, port: config.db.port,
  user: config.db.user, password: config.db.password,
  database: config.db.database, multipleStatements: true,
});
await conn.query(schema);
console.log('Schéma initialisé sur la base', config.db.database);
await conn.end();
