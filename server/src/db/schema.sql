-- ============================================================================
--  Coffre-fort documentaire familial — schéma MySQL
-- ============================================================================
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(180) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `role` ENUM('owner','member') NOT NULL DEFAULT 'member',
  `relationship` VARCHAR(60) DEFAULT NULL,           -- ex: Épouse, Fils, Mère...
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL,
  `slug` VARCHAR(80) NOT NULL,
  `icon` VARCHAR(40) DEFAULT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cat_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `category_id` INT DEFAULT NULL,
  `owner_user_id` INT NOT NULL,          -- le membre à qui appartient le document
  `uploaded_by` INT DEFAULT NULL,        -- qui a téléversé (owner ou le membre)
  `original_name` VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(128) NOT NULL,   -- nom du fichier chiffré sur disque
  `mime_type` VARCHAR(150) NOT NULL,
  `extension` VARCHAR(20) DEFAULT NULL,
  `size_bytes` BIGINT NOT NULL,
  `checksum_sha256` CHAR(64) NOT NULL,   -- empreinte du fichier EN CLAIR
  `enc_iv` VARCHAR(32) NOT NULL,         -- IV AES-GCM (hex)
  `enc_tag` VARCHAR(32) NOT NULL,        -- tag d'authentification AES-GCM (hex)
  `issue_date` DATE DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,       -- pour CNI, passeport, assurance...
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_owner` (`owner_user_id`),
  KEY `idx_doc_category` (`category_id`),
  KEY `idx_doc_expiry` (`expiry_date`),
  CONSTRAINT `fk_doc_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_doc_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `document_shares` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `document_id` INT NOT NULL,
  `shared_with_user_id` INT NOT NULL,
  `permission` ENUM('view','download') NOT NULL DEFAULT 'view',
  `shared_by` INT DEFAULT NULL,
  `expires_at` DATETIME DEFAULT NULL,    -- NULL = pas d'expiration
  `revoked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_share` (`document_id`,`shared_with_user_id`),
  KEY `idx_share_user` (`shared_with_user_id`),
  CONSTRAINT `fk_share_doc` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_share_user` FOREIGN KEY (`shared_with_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` INT DEFAULT NULL,
  `action` VARCHAR(40) NOT NULL,         -- LOGIN, LOGOUT, UPLOAD, VIEW, DOWNLOAD, DELETE, SHARE, REVOKE, MEMBER_CREATE...
  `entity_type` VARCHAR(40) DEFAULT NULL,
  `entity_id` INT DEFAULT NULL,
  `ip` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `details` JSON DEFAULT NULL,
  `success` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `type` VARCHAR(30) NOT NULL DEFAULT 'info',   -- info, expiry, share
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT DEFAULT NULL,
  `entity_type` VARCHAR(40) DEFAULT NULL,
  `entity_id` INT DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_user` (`user_id`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Catégories par défaut
INSERT INTO `categories` (`name`,`slug`,`icon`,`sort_order`) VALUES
  ('Pièces d''identité','pieces-identite','badge',1),
  ('Assurances','assurances','shield',2),
  ('Santé','sante','favorite',3),
  ('Scolaire','scolaire','school',4),
  ('Finances','finances','account_balance',5),
  ('Logement','logement','home',6),
  ('Véhicule','vehicule','directions_car',7),
  ('Divers','divers','folder',8)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);
