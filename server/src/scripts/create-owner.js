// Crée (ou met à jour) le compte propriétaire.
//   node src/scripts/create-owner.js <email> <mot_de_passe> "<Nom complet>"
import bcrypt from 'bcryptjs';
import { query, queryOne, pool } from '../config/db.js';

const [, , email, password, ...nameParts] = process.argv;
const fullName = nameParts.join(' ') || 'Propriétaire';

if (!email || !password) {
  console.error('Usage: node src/scripts/create-owner.js <email> <mot_de_passe> "<Nom complet>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Le mot de passe doit contenir au moins 8 caractères.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const existing = await queryOne('SELECT id FROM users WHERE email = :e', { e: email.toLowerCase() });

if (existing) {
  await query("UPDATE users SET password_hash=:h, role='owner', is_active=1, full_name=:n WHERE id=:id",
    { h: hash, n: fullName, id: existing.id });
  console.log('Compte propriétaire mis à jour :', email);
} else {
  await query("INSERT INTO users (email, password_hash, full_name, role) VALUES (:e, :h, :n, 'owner')",
    { e: email.toLowerCase(), h: hash, n: fullName });
  console.log('Compte propriétaire créé :', email);
}
await pool.end();
