# Coffre Familial — coffre-fort documentaire sécurisé

Application pour conserver vos documents personnels et ceux de votre famille (pièces d'identité, assurances, santé, scolaire, finances…). Le **propriétaire** voit tout ; chaque **membre** ne voit que ses propres documents et ceux qui lui sont **partagés**. Interface **mobile-first**.

## Stack

- **Backend** : Node.js + Express, MySQL (mysql2), JWT, bcrypt, Helmet, rate-limiting.
- **Frontend** : React + Vite + MUI (Material UI), orienté mobile (navigation basse, plein écran).
- **Chiffrement** : fichiers chiffrés au repos en **AES-256-GCM** (avec tag d'authentification), stockés hors de la racine web.
- **Lecteur PDF intégré** : visualisation des PDF et images directement dans l'app (pdf.js, worker bundlé localement — fonctionne sur mobile).

## Sécurité

- Fichiers **chiffrés au repos** (AES-256-GCM). Le contenu n'est déchiffré qu'à la volée, en mémoire, pour un utilisateur autorisé. Une empreinte SHA-256 du clair est conservée pour l'intégrité.
- **Cloisonnement strict** : un membre ne peut accéder qu'à ses documents ou à ceux partagés avec lui (vérifié côté serveur sur chaque route, y compris consultation et téléchargement).
- **Partages expirables et révocables** : droit `lecture` ou `lecture+téléchargement`, date d'expiration optionnelle, révocation immédiate.
- **Journal d'audit** horodaté (connexion, consultation, téléchargement, ajout, suppression, partage, révocation…) consultable par le propriétaire.
- Mots de passe hachés **bcrypt** (coût 12), **JWT** signé, en-têtes de sécurité (Helmet + Apache), **rate-limiting** sur la connexion.
- Le dossier de stockage doit rester **hors racine web** (ex. `/var/lib/coffre/uploads`, droits `750` pour `www-data`).

## Fonctionnalités

Tableau de bord (statistiques adaptées au rôle, échéances à venir) · documents (recherche, filtres par catégorie et par membre) · téléversement chiffré avec dates d'émission/expiration · **visualisation intégrée** (PDF page par page + images) · téléchargement · partage owner→membre · rappels d'expiration (CNI, passeport, assurance…) · gestion des membres de la famille (propriétaire) · journal d'audit · notifications · changement de mot de passe.

## Arborescence

```
coffre_famille/
├── server/                 API Node/Express
│   ├── src/
│   │   ├── index.js
│   │   ├── config/         env.js, db.js
│   │   ├── middleware/     auth.js (JWT + rôles)
│   │   ├── routes/         auth, members, documents, shares, misc
│   │   ├── utils/          crypto.js (AES-256-GCM), access.js, audit.js
│   │   ├── db/schema.sql
│   │   └── scripts/        init-db.js, create-owner.js
│   └── .env.example
├── client/                 SPA React + MUI (Vite)
│   └── src/
│       ├── pages/          Login, Dashboard, Documents, DocumentDetail, Members, Audit, Profile
│       └── components/     DocViewer.jsx (lecteur PDF/images)
└── deploy/coffre.amarsyll.pro.conf   VirtualHost Apache
```

## Installation locale (développement)

Prérequis : Node.js 18+ et MySQL 8 (ou MariaDB).

```bash
# 1) Backend
cd server
cp .env.example .env
# Générez les secrets :
#   openssl rand -hex 32   -> JWT_SECRET
#   openssl rand -hex 32   -> FILE_ENCRYPTION_KEY   (32 octets = 64 hex, OBLIGATOIRE)
# Renseignez la connexion MySQL dans .env, puis :
npm install
npm run init-db                                   # crée les tables + catégories
npm run create-owner -- vous@exemple.com MotDePasse "Votre Nom"
npm start                                          # API sur http://127.0.0.1:4200

# 2) Frontend (dans un autre terminal)
cd client
npm install                                        # installe aussi pdfjs-dist (lecteur PDF)
npm run dev                                        # http://localhost:5173 (proxy /api -> 4200)
```

> ⚠️ Conservez précieusement `FILE_ENCRYPTION_KEY`. **Si vous la perdez, les fichiers déjà chiffrés sont irrécupérables.** Sauvegardez-la séparément de la base.

## Déploiement sur le VPS (coffre.amarsyll.pro)

### 1. Paquets

```bash
sudo apt install -y apache2 mysql-server nodejs npm
sudo npm install -g pm2
sudo a2enmod proxy proxy_http rewrite headers ssl
```

### 2. Base de données

```bash
sudo mysql -e "CREATE DATABASE coffre_famille CHARACTER SET utf8mb4;"
sudo mysql -e "CREATE USER 'coffre_user'@'localhost' IDENTIFIED BY 'MOT_DE_PASSE'; GRANT ALL ON coffre_famille.* TO 'coffre_user'@'localhost'; FLUSH PRIVILEGES;"
```

### 3. Code + stockage chiffré

> Transférez seulement le **code source** (pas `node_modules` ni `dist` : trop de fichiers, ça échoue en FTP). Les dépendances s'installent sur le serveur avec `npm ci`. Le plus simple : `git clone` ou `rsync` (le `.gitignore` exclut déjà `node_modules`).

```bash
sudo mkdir -p /var/www/coffre && sudo rsync -a coffre_famille/ /var/www/coffre/
sudo mkdir -p /var/lib/coffre/uploads         # stockage chiffré HORS racine web
sudo chown -R www-data:www-data /var/lib/coffre
sudo chmod -R 750 /var/lib/coffre
```

### 4. Backend (API)

```bash
cd /var/www/coffre/server
cp .env.example .env    # renseigner DB, secrets, STORAGE_DIR=/var/lib/coffre/uploads, CORS_ORIGINS=https://coffre.amarsyll.pro
npm ci --omit=dev
npm run init-db
npm run create-owner -- vous@exemple.com MotDePasse "Votre Nom"
pm2 start src/index.js --name coffre-api --cwd /var/www/coffre/server && pm2 save
```

### 5. Frontend (build statique)

```bash
cd /var/www/coffre/client
npm ci && npm run build          # génère client/dist servi par Apache
```

### 6. Apache + HTTPS

⚠️ Le vhost final référence des certificats SSL qui n'existent pas encore : il faut **obtenir le certificat d'abord** avec une config `:80` temporaire, sinon `apache2ctl configtest` échoue (`SSLCertificateFile … does not exist`). Assurez-vous que le DNS de `coffre.amarsyll.pro` pointe vers le VPS.

```bash
# a) Config temporaire (port 80 seulement) pour le challenge Let's Encrypt
sudo tee /etc/apache2/sites-available/coffre.amarsyll.pro.conf >/dev/null <<'EOF'
<VirtualHost *:80>
    ServerName coffre.amarsyll.pro
    DocumentRoot /var/www/coffre/client/dist
    <Directory /var/www/coffre/client/dist>
        AllowOverride All
        Require all granted
    </Directory>
    ErrorLog  ${APACHE_LOG_DIR}/coffre.amarsyll.pro-error.log
    CustomLog ${APACHE_LOG_DIR}/coffre.amarsyll.pro-access.log combined
</VirtualHost>
EOF
sudo a2ensite coffre.amarsyll.pro
sudo apache2ctl configtest && sudo systemctl reload apache2

# b) Obtenir le certificat SANS que certbot réécrive la config
#    (certonly : sinon le proxy /api et le fallback SPA seraient perdus)
sudo certbot certonly --apache -d coffre.amarsyll.pro

# c) Restaurer la config complète (proxy /api + SPA + SSL). Les certificats
#    existent maintenant, donc plus d'erreur SSLCertificateFile.
sudo cp /var/www/coffre/deploy/coffre.amarsyll.pro.conf /etc/apache2/sites-available/coffre.amarsyll.pro.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

## Rôles

| Action | Propriétaire | Membre |
|--------|:-----------:|:------:|
| Voir tous les documents | ✔ | — |
| Voir ses propres documents | ✔ | ✔ |
| Voir les documents partagés avec lui | ✔ | ✔ |
| Téléverser (pour soi / pour un membre) | ✔ | ✔ (soi) |
| Partager / révoquer | ✔ | ✔ (ses docs) |
| Gérer les membres | ✔ | — |
| Journal d'audit | ✔ | — |

## Dépannage

- **`ECONNREFUSED 127.0.0.1:4200`** : l'API Node n'est pas démarrée. Vérifiez `pm2 status` / `pm2 logs coffre-api`. Souvent dû à un `.env` incomplet — `FILE_ENCRYPTION_KEY` doit faire exactement 64 caractères hex, sinon le serveur quitte au démarrage.
- **`SSLCertificateFile … does not exist`** : certbot n'a pas encore tourné → suivez l'étape 6 (config `:80` temporaire puis `certonly`).
- **Page « Membres » vide** : vous êtes connecté avec un compte membre (réservé au propriétaire) ou l'API est injoignable ; le message d'erreur s'affiche désormais dans la page.
- **PDF qui ne s'affiche pas** : le worker pdf.js est bundlé localement par Vite (`npm run build`) — assurez-vous d'avoir rebuild le client après mise à jour.