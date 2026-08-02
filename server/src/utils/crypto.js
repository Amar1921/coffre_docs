import crypto from 'node:crypto';
import { config } from '../config/env.js';

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(config.fileKeyHex, 'hex'); // 32 octets

/**
 * Chiffre un buffer (fichier en clair).
 * @returns {{ data: Buffer, iv: string, tag: string, sha256: string }}
 *   data = contenu chiffré ; iv/tag en hex ; sha256 = empreinte du CLAIR.
 */
export function encryptBuffer(plainBuffer) {
  const iv = crypto.randomBytes(12); // 96 bits recommandé pour GCM
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  const sha256 = crypto.createHash('sha256').update(plainBuffer).digest('hex');
  return {
    data: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    sha256,
  };
}

/**
 * Déchiffre un buffer chiffré.
 * @param {Buffer} encBuffer contenu chiffré
 * @param {string} ivHex IV (hex)
 * @param {string} tagHex tag d'authentification (hex)
 * @returns {Buffer} contenu en clair (lève une erreur si altéré)
 */
export function decryptBuffer(encBuffer, ivHex, tagHex) {
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(encBuffer), decipher.final()]);
}

/** Nom de fichier aléatoire pour le stockage sur disque */
export function randomStoredName(ext = '') {
  const base = crypto.randomBytes(24).toString('hex');
  return ext ? `${base}.enc` : `${base}.enc`;
}
