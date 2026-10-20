-- ============================================================
-- Boutique SaaS multi-boutiques — schéma de référence MySQL
-- (Les tables sont créées automatiquement par Sequelize au
--  démarrage du backend ; ce fichier documente la structure
--  réelle de la base pour référence / audit / reprise en SQL pur.)
-- ============================================================

CREATE DATABASE IF NOT EXISTS electronicdb CHARACTER SET utf8mb4;
USE electronicdb;

CREATE TABLE boutiques (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,
  logo_url VARCHAR(255),
  couleur_principale VARCHAR(20) DEFAULT '#1F4D3A',
  formule_abonnement ENUM('essai_gratuit','forfait_mensuel','commission') DEFAULT 'essai_gratuit',
  statut ENUM('active','suspendue') DEFAULT 'active',
  adresse_retrait TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boutique_id INT NULL,
  nom VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  telephone VARCHAR(30),
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','admin','employe','client','livreur') NOT NULL DEFAULT 'client',
  permissions JSON NULL,
  statut ENUM('actif','suspendu') DEFAULT 'actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (boutique_id) REFERENCES boutiques(id)
);

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boutique_id INT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  famille ENUM('alimentation','cosmetique') NOT NULL,
  emoji VARCHAR(10) DEFAULT '🛒',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (boutique_id) REFERENCES boutiques(id)
);

CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boutique_id INT NOT NULL,
  category_id INT NOT NULL,
  nom VARCHAR(150) NOT NULL,
  description TEXT,
  prix DECIMAL(10,2) NOT NULL,
  prix_promo DECIMAL(10,2) NULL,
  unite VARCHAR(50),
  stock INT NOT NULL DEFAULT 0,
  seuil_alerte INT NOT NULL DEFAULT 5,
  cout_achat DECIMAL(10,2) DEFAULT 0,
  image_emoji VARCHAR(10) DEFAULT '🛒',
  ventes_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (boutique_id) REFERENCES boutiques(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boutique_id INT NOT NULL,
  client_id INT NOT NULL,
  statut ENUM('en_attente','validee','en_preparation','en_livraison','livree','annulee') DEFAULT 'en_attente',
  mode_livraison ENUM('domicile','retrait') DEFAULT 'domicile',
  adresse_livraison VARCHAR(255) NULL,
  moyen_paiement ENUM('orange_money','wave','carte','cash') NOT NULL,
  employe_assigne_id INT NULL,
  sous_total DECIMAL(10,2) NOT NULL,
  frais_livraison DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (boutique_id) REFERENCES boutiques(id),
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (employe_assigne_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantite INT NOT NULL,
  prix_unitaire DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  user_id INT NOT NULL,
  note TINYINT NOT NULL,
  commentaire TEXT,
  statut ENUM('publie','masque') DEFAULT 'publie',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_products_boutique ON products(boutique_id);
CREATE INDEX idx_orders_boutique ON orders(boutique_id);
CREATE INDEX idx_users_boutique ON users(boutique_id);
