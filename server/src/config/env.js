import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    console.error(`[config] Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

export const config = {
  port: parseInt(process.env.PORT || '4200', 10),
  env: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean),
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME', 'coffre_famille'),
  },
  jwtSecret: required('JWT_SECRET'),
  jwtExpires: process.env.JWT_EXPIRES || '12h',
  fileKeyHex: required('FILE_ENCRYPTION_KEY'),
  storageDir: process.env.STORAGE_DIR || path.resolve(__dirname, '../../storage'),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
};

// Validation de la clé de chiffrement (32 octets = 64 hex)
if (!/^[0-9a-fA-F]{64}$/.test(config.fileKeyHex)) {
  console.error('[config] FILE_ENCRYPTION_KEY doit être une chaîne hexadécimale de 64 caractères (32 octets). Générez-la avec: openssl rand -hex 32');
  process.exit(1);
}
