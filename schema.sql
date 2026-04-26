-- ================================================================
-- Evnt App — MySQL Schema
-- Run this in MySQL Workbench: File > Open SQL Script > Run All
-- ================================================================

CREATE DATABASE IF NOT EXISTS evnt_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evnt_db;

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    TEXT,
  google_id   VARCHAR(255) UNIQUE,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100),
  initials    VARCHAR(5),
  role        ENUM('member','admin') DEFAULT 'member',
  phone       VARCHAR(20),
  bio         TEXT,
  avatar_url  TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── USER PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNIQUE NOT NULL,
  company   VARCHAR(255),
  job_title VARCHAR(255),
  website   VARCHAR(255),
  linkedin  VARCHAR(255),
  twitter   VARCHAR(255),
  interests TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── EVENT CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_categories (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon        VARCHAR(50),
  color       VARCHAR(20),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ── EVENTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  organizer_id          INT NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  description           TEXT,
  category_id           INT,
  event_mode            ENUM('online','offline','hybrid') DEFAULT 'offline',
  visibility            ENUM('public','private') DEFAULT 'public',
  date_start            DATETIME NOT NULL,
  date_end              DATETIME NOT NULL,
  location              VARCHAR(255),
  address               TEXT,
  capacity              INT,
  price                 DECIMAL(10,2) DEFAULT 0.00,
  currency              VARCHAR(10) DEFAULT 'USD',
  image_url             TEXT,
  status                ENUM('draft','published','cancelled','completed') DEFAULT 'draft',
  is_featured           BOOLEAN DEFAULT FALSE,
  registration_deadline DATETIME,
  require_approval      BOOLEAN DEFAULT FALSE,
  show_attendees        BOOLEAN DEFAULT TRUE,
  send_reminders        BOOLEAN DEFAULT TRUE,
  enable_waitlist       BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ── EVENT IMAGES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_images (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  event_id  INT,
  image_url TEXT NOT NULL,
  is_cover  BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── REGISTRATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  event_id        INT NOT NULL,
  user_id         INT NOT NULL,
  status          ENUM('pending','confirmed','cancelled','waitlist','attended') DEFAULT 'confirmed',
  payment_amount  DECIMAL(10,2) DEFAULT 0.00,
  payment_status  ENUM('free','pending','paid','refunded') DEFAULT 'free',
  registered_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  notes           TEXT,
  UNIQUE (event_id, user_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── PAYMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT,
  event_id        INT,
  registration_id INT,
  amount          DECIMAL(10,2),
  currency        VARCHAR(10) DEFAULT 'USD',
  payment_method  VARCHAR(50),
  status          ENUM('pending','completed','failed','refunded') DEFAULT 'pending',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (registration_id) REFERENCES registrations(id)
) ENGINE=InnoDB;

-- ── REVIEWS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_reviews (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  event_id   INT,
  user_id    INT,
  rating     TINYINT CHECK (rating BETWEEN 1 AND 5),
  review     TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT,
  title      VARCHAR(255),
  message    TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── INDEXES ──────────────────────────────────────────────────────
CREATE INDEX idx_events_organizer    ON events(organizer_id);
CREATE INDEX idx_events_category     ON events(category_id);
CREATE INDEX idx_events_status       ON events(status);
CREATE INDEX idx_events_date         ON events(date_start);
CREATE INDEX idx_registrations_event ON registrations(event_id);
CREATE INDEX idx_registrations_user  ON registrations(user_id);
CREATE INDEX idx_users_email         ON users(email);

-- ── DEFAULT CATEGORIES ───────────────────────────────────────────
INSERT INTO event_categories (name, description, icon, color) VALUES
('conference','Professional conferences and seminars','briefcase','#6366f1'),
('workshop','Hands-on learning sessions','wrench','#8b5cf6'),
('meetup','Casual meetups and networking','users','#ec4899'),
('social','Social gatherings and parties','music','#f59e0b'),
('sports','Sports and fitness activities','zap','#10b981'),
('music','Music concerts and festivals','music','#ef4444'),
('art','Art exhibitions and galleries','palette','#f97316'),
('tech','Technology events and hackathons','cpu','#3b82f6'),
('business','Business networking events','briefcase','#6366f1'),
('education','Educational events and lectures','book','#14b8a6'),
('other','Other types of events','calendar','#6b7280')
ON DUPLICATE KEY UPDATE name=name;
