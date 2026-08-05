<h1 align="center">🔐 Coffre Familial</h1>

<p align="center">
  Coffre-fort documentaire sécurisé, mobile-first, pour vos documents personnels et ceux de votre famille.
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black">
  <img alt="MUI" src="https://img.shields.io/badge/MUI-5-007FFF?logo=mui&logoColor=white">
  <img alt="MySQL" src="https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white">
  <img alt="Chiffrement" src="https://img.shields.io/badge/Chiffrement-AES--256--GCM-2E7D32">
</p>

---

## 📖 Présentation

**Coffre Familial** permet de conserver au même endroit, en toute sécurité, les documents importants d'une famille : pièces d'identité, assurances, documents de santé, scolaires, financiers… Chaque fichier est **chiffré au repos**.

- Le **propriétaire** a accès à tous les documents.
- Chaque **membre** ne voit que **ses propres documents** et **ceux qui lui sont partagés**.

L'interface est pensée **mobile-first** (navigation basse, plein écran) et intègre un **lecteur PDF**.

## ✨ Fonctionnalités

- 📊 **Tableau de bord** adapté au rôle : statistiques et échéances à venir.
- 📁 **Documents** : recherche, filtres par catégorie, membre, type de fichier, plage de dates et favoris.
- 🔀 **Tri** : par date d'ajout, nom, taille ou expiration proche.
- 🗄️ **Archivage** : masquer un document des listes sans le supprimer (vue « Archivés » dédiée, désarchivage en un clic).
- ⭐ **Favoris** : épingler les documents importants.
- ⬆️ **Téléversement chiffré** avec dates d'émission et d'expiration.
- 👁️ **Lecteur intégré** : PDF (page par page) et images, directement dans l'app.
- 🤝 **Partages expirables et révocables** (lecture seule ou lecture + téléchargement).
- ⏰ **Rappels d'expiration** (CNI, passeport, assurance…).
- 👨‍👩‍👧 **Gestion des membres** de la famille (propriétaire).
- 📝 **Journal d'audit** horodaté (propriétaire).
- 🔔 **Notifications** et changement de mot de passe.

## 🧱 Stack technique

| Côté | Technologies |
|------|--------------|
| **Backend** | Node.js, Express, MySQL (mysql2), JWT, bcrypt, Helmet, express-rate-limit |
| **Frontend** | React, Vite, MUI (Material UI), Axios, React Router, pdf.js |
| **Chiffrement** | AES-256-GCM (Node.js `crypto`) |

## 🔒 Sécurité

- **Fichiers chiffrés au repos** en AES-256-GCM (avec tag d'authentification), stockés **hors de la racine web**. Le contenu n'est déchiffré qu'à la volée, en mémoire, pour un utilisateur autorisé. Une empreinte SHA-256 du clair est conservée pour vérifier l'intégrité.
- **Cloisonnement strict** vérifié côté serveur sur chaque route (y compris la consultation et le téléchargement) : un membre ne peut atteindre que ses documents ou ceux partagés avec lui.
- **Partages** avec date d'expiration optionnelle et révocation immédiate.
- **Journal d'audit** de toutes les actions sensibles.
- Mots de passe **bcrypt** (coût 12), **JWT** signé, en-têtes de sécurité (Helmet), **rate-limiting** sur la connexion.

> ⚠️ La clé `FILE_ENCRYPTION_KEY` chiffre tous les fichiers. **Si vous la perdez, les documents déjà chiffrés sont irrécupérables.** Conservez-la en sécurité, séparément de la base de données, et ne la committez jamais.

## 🚀 Démarrage rapide (local)

**Prérequis :** Node.js 18+ et MySQL 8 (ou MariaDB).

### 1. Backend

```bash
cd server
cp .env.example .env
```

Générez les secrets et renseignez la connexion MySQL dans `.env` :

```bash
openssl rand -hex 32   # -> JWT_SECRET
openssl rand -hex 32   # -> FILE_ENCRYPTION_KEY  (64 caractères hex, OBLIGATOIRE)
```

Puis :

```bash
npm install
npm run init-db                                       # crée les tables + catégories
npm run create-owner -- vous@exemple.com MotDePasse "Votre Nom"
npm start                                             # API sur http://127.0.0.1:4200
```

> **Base existante ?** Après une mise à jour du code, exécutez `npm run migrate`
> pour ajouter les nouvelles colonnes (archivage, favoris) sans toucher aux données.

### 2. Frontend

```bash
cd client
npm install
npm run dev                                           # http://localhost:5173
```

Le serveur de dev proxifie automatiquement `/api` vers `http://127.0.0.1:4200`. Ouvrez **http://localhost:5173** et connectez-vous avec le compte propriétaire créé ci-dessus.

## ⚙️ Variables d'environnement (`server/.env`)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PORT` | Port de l'API | `4200` |
| `CORS_ORIGINS` | Origines autorisées (frontend) | `http://localhost:5173` |
| `DB_HOST` / `DB_PORT` | Hôte / port MySQL | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_PASSWORD` | Identifiants MySQL | `coffre_user` / `…` |
| `DB_NAME` | Base de données | `coffre_famille` |
| `JWT_SECRET` | Secret de signature JWT | `openssl rand -hex 32` |
| `JWT_EXPIRES` | Durée de validité du token | `12h` |
| `FILE_ENCRYPTION_KEY` | Clé AES-256 (64 hex) | `openssl rand -hex 32` |
| `STORAGE_DIR` | Dossier des fichiers chiffrés (hors racine web) | `/var/lib/coffre/uploads` |
| `MAX_FILE_SIZE_MB` | Taille max d'un fichier | `25` |

## 🗂️ Structure du projet

```
coffre_famille/
├── server/                 API Node/Express
│   └── src/
│       ├── index.js
│       ├── config/         env.js, db.js
│       ├── middleware/     auth.js (JWT + rôles)
│       ├── routes/         auth, members, documents, shares, misc
│       ├── utils/          crypto.js (AES-256-GCM), access.js, audit.js
│       ├── db/schema.sql
│       └── scripts/        init-db.js, create-owner.js
└── client/                 SPA React + MUI (Vite)
    └── src/
        ├── pages/          Login, Dashboard, Documents, DocumentDetail, Members, Audit, Profile
        └── components/     DocViewer.jsx (lecteur PDF / images)
```

## 👥 Rôles & permissions

| Action | Propriétaire | Membre |
|--------|:-----------:|:------:|
| Voir tous les documents | ✔ | — |
| Voir ses propres documents | ✔ | ✔ |
| Voir les documents partagés avec lui | ✔ | ✔ |
| Téléverser (pour soi / pour un membre) | ✔ | ✔ (soi) |
| Partager / révoquer | ✔ | ✔ (ses docs) |
| Gérer les membres | ✔ | — |
| Journal d'audit | ✔ | — |

## 📄 Licence

Projet personnel — tous droits réservés. Réutilisation soumise à l'autorisation de l'auteur.
