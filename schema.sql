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

-- ── PASSWORD RESET TOKENS ─────────────────────────────────────────
-- Stores one-time tokens used for the forgot-password flow.
-- Each token expires after 1 hour and is marked used after redemption.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  token      VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used       BOOLEAN DEFAULT FALSE,
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


-- ================================================================
-- VIEWS
-- Read-only virtual tables that simplify complex reporting queries.
-- These are used for analytics and do NOT affect app write operations.
-- ================================================================

-- ── VIEW: v_event_summary ─────────────────────────────────────────
-- Full event info with organizer name, category, and live attendee count.
-- Replaces the multi-JOIN SELECT used in /api/events and /api/events/:id
CREATE OR REPLACE VIEW v_event_summary AS
SELECT
    e.id,
    e.title,
    e.description,
    e.event_mode,
    e.visibility,
    e.date_start,
    e.date_end,
    e.location,
    e.address,
    e.capacity,
    e.price,
    e.currency,
    e.image_url,
    e.status,
    e.is_featured,
    e.registration_deadline,
    e.require_approval,
    e.show_attendees,
    e.send_reminders,
    e.enable_waitlist,
    e.created_at,
    ec.name          AS category,
    ec.color         AS category_color,
    CONCAT(u.first_name, ' ', IFNULL(u.last_name, '')) AS organizer_name,
    u.id             AS organizer_id,
    (
        SELECT COUNT(*)
        FROM   registrations r
        WHERE  r.event_id = e.id
          AND  r.status != 'cancelled'
    )                AS attendee_count,
    CASE
        WHEN e.date_end < NOW()        THEN 'ended'
        WHEN e.date_start > NOW()      THEN 'upcoming'
        ELSE                                'ongoing'
    END              AS time_status
FROM  events e
JOIN  users u              ON e.organizer_id = u.id
LEFT JOIN event_categories ec ON e.category_id  = ec.id;


-- ── VIEW: v_user_stats ────────────────────────────────────────────
-- Per-user dashboard metrics: events hosted, attended, revenue earned.
-- Powers the profile page stats and organizer dashboard cards.
CREATE OR REPLACE VIEW v_user_stats AS
SELECT
    u.id,
    u.email,
    CONCAT(u.first_name, ' ', IFNULL(u.last_name, '')) AS full_name,
    u.initials,
    u.created_at                                        AS member_since,
    COUNT(DISTINCT e.id)                                AS events_hosted,
    COUNT(DISTINCT r.id)                                AS events_attended,
    IFNULL(SUM(CASE WHEN e2.organizer_id = u.id
                     AND reg2.status != 'cancelled'
                    THEN reg2.payment_amount ELSE 0 END), 0) AS total_revenue_earned
FROM  users u
LEFT JOIN events       e    ON e.organizer_id = u.id
LEFT JOIN registrations r   ON r.user_id = u.id AND r.status != 'cancelled'
LEFT JOIN events       e2   ON e2.organizer_id = u.id
LEFT JOIN registrations reg2 ON reg2.event_id = e2.id
GROUP BY u.id, u.email, u.first_name, u.last_name, u.initials, u.created_at;


-- ── VIEW: v_registration_details ─────────────────────────────────
-- Attendee list enriched with user info and event info.
-- Powers the organizer's attendee export and participant table.
CREATE OR REPLACE VIEW v_registration_details AS
SELECT
    reg.id               AS registration_id,
    reg.status           AS registration_status,
    reg.payment_amount,
    reg.payment_status,
    reg.registered_at,
    u.id                 AS user_id,
    u.email,
    CONCAT(u.first_name, ' ', IFNULL(u.last_name, '')) AS attendee_name,
    u.phone,
    e.id                 AS event_id,
    e.title              AS event_title,
    e.date_start,
    e.date_end,
    e.location,
    e.organizer_id,
    CONCAT(org.first_name, ' ', IFNULL(org.last_name, ''))  AS organizer_name
FROM  registrations reg
JOIN  users   u   ON reg.user_id   = u.id
JOIN  events  e   ON reg.event_id  = e.id
JOIN  users   org ON e.organizer_id = org.id;


-- ================================================================
-- SUPPORTING TABLE FOR TRIGGERS
-- ================================================================

-- ── REGISTRATION AUDIT LOG ────────────────────────────────────────
-- Stores a tamper-proof record of every registration state change.
-- Written to only by triggers — never by application code directly.
CREATE TABLE IF NOT EXISTS registration_audit (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    action      ENUM('REGISTERED','CANCELLED') NOT NULL,
    registration_id INT,
    event_id    INT NOT NULL,
    user_id     INT NOT NULL,
    amount      DECIMAL(10,2) DEFAULT 0.00,
    changed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note        VARCHAR(255)
) ENGINE=InnoDB;


-- ================================================================
-- TRIGGERS
-- Automatic server-side logic that fires on table events.
-- Zero changes to application code required — MySQL handles these.
-- ================================================================

-- Drop existing triggers first so this script is safely re-runnable
DROP TRIGGER IF EXISTS trg_notify_organizer_on_registration;
DROP TRIGGER IF EXISTS trg_auto_cancel_registrations_on_event_cancel;
DROP TRIGGER IF EXISTS trg_audit_on_registration_insert;
DROP TRIGGER IF EXISTS trg_audit_on_registration_cancel;

DELIMITER $$

-- ── TRIGGER 1: Notify organizer when someone registers ────────────
-- Fires AFTER every new confirmed registration is inserted.
-- Inserts a row into the notifications table so the organizer
-- sees an in-app alert on their dashboard.
CREATE TRIGGER trg_notify_organizer_on_registration
AFTER INSERT ON registrations
FOR EACH ROW
BEGIN
    DECLARE v_event_title   VARCHAR(255);
    DECLARE v_organizer_id  INT;
    DECLARE v_attendee_name VARCHAR(255);

    -- Fetch the event title and organizer
    SELECT e.title, e.organizer_id
    INTO   v_event_title, v_organizer_id
    FROM   events e
    WHERE  e.id = NEW.event_id;

    -- Fetch the registering user's display name
    SELECT CONCAT(first_name, ' ', IFNULL(last_name, ''))
    INTO   v_attendee_name
    FROM   users
    WHERE  id = NEW.user_id;

    -- Only notify if registration is confirmed (not cancelled/waitlist)
    IF NEW.status = 'confirmed' THEN
        INSERT INTO notifications (user_id, title, message)
        VALUES (
            v_organizer_id,
            'New Registration',
            CONCAT(v_attendee_name, ' just registered for "', v_event_title, '".')
        );
    END IF;
END$$


-- ── TRIGGER 2: Auto-cancel registrations when event is cancelled ──
-- Fires AFTER an event row is updated.
-- When an organizer cancels an event (status → 'cancelled'), all
-- non-cancelled registrations are automatically set to 'cancelled'
-- and attendees receive a notification.
CREATE TRIGGER trg_auto_cancel_registrations_on_event_cancel
AFTER UPDATE ON events
FOR EACH ROW
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        -- Cancel every active registration for this event
        UPDATE registrations
        SET    status = 'cancelled',
               updated_at = NOW()
        WHERE  event_id = NEW.id
          AND  status != 'cancelled';

        -- Notify each affected attendee
        INSERT INTO notifications (user_id, title, message)
        SELECT
            r.user_id,
            'Event Cancelled',
            CONCAT('"', NEW.title, '" has been cancelled by the organiser. Your registration has been removed.')
        FROM registrations r
        WHERE r.event_id = NEW.id;
    END IF;
END$$


-- ── TRIGGER 3: Audit log on new registration ──────────────────────
-- Fires AFTER every INSERT on registrations.
-- Writes an immutable audit record so you can always trace who
-- registered for what and when, even if the registration is later deleted.
CREATE TRIGGER trg_audit_on_registration_insert
AFTER INSERT ON registrations
FOR EACH ROW
BEGIN
    INSERT INTO registration_audit (action, registration_id, event_id, user_id, amount, note)
    VALUES (
        'REGISTERED',
        NEW.id,
        NEW.event_id,
        NEW.user_id,
        NEW.payment_amount,
        CONCAT('Status: ', NEW.status, ' | Payment: ', NEW.payment_status)
    );
END$$


-- ── TRIGGER 4: Audit log when a registration is cancelled ────────
-- Fires AFTER UPDATE on registrations when status changes to 'cancelled'.
-- Records who cancelled and at what time for dispute resolution.
CREATE TRIGGER trg_audit_on_registration_cancel
AFTER UPDATE ON registrations
FOR EACH ROW
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        INSERT INTO registration_audit (action, registration_id, event_id, user_id, amount, note)
        VALUES (
            'CANCELLED',
            NEW.id,
            NEW.event_id,
            NEW.user_id,
            OLD.payment_amount,
            CONCAT('Was: ', OLD.status, ' | Cancelled at: ', NOW())
        );
    END IF;
END$$

DELIMITER ;


-- ================================================================
-- STORED PROCEDURES WITH TRANSACTIONS
-- Multi-step operations wrapped in atomic transactions:
-- if any step fails the whole operation is rolled back cleanly.
-- ================================================================

DROP PROCEDURE IF EXISTS sp_safe_register;
DROP PROCEDURE IF EXISTS sp_cancel_event_safely;

DELIMITER $$

-- ── PROCEDURE: sp_safe_register ───────────────────────────────────
-- Atomically registers a user for an event.
-- Checks: event exists & published, not past, not organizer,
--         not already registered, capacity not exceeded.
-- On success: inserts registration (triggers fire automatically).
-- On any failure: rolls back — no partial writes.
--
-- Usage:
--   CALL sp_safe_register(user_id, event_id, @out_msg);
--   SELECT @out_msg;
CREATE PROCEDURE sp_safe_register(
    IN  p_user_id  INT,
    IN  p_event_id INT,
    OUT p_message  VARCHAR(255)
)
BEGIN
    DECLARE v_organizer_id   INT;
    DECLARE v_capacity       INT;
    DECLARE v_attendee_count INT;
    DECLARE v_date_end       DATETIME;
    DECLARE v_status         VARCHAR(20);
    DECLARE v_price          DECIMAL(10,2);
    DECLARE v_pay_status     VARCHAR(20);
    DECLARE v_existing       INT DEFAULT 0;
    DECLARE exit handler FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_message = 'ERROR: An unexpected database error occurred. Registration rolled back.';
    END;

    START TRANSACTION;

        -- 1. Fetch event details
        SELECT organizer_id, capacity, date_end, status, price
        INTO   v_organizer_id, v_capacity, v_date_end, v_status, v_price
        FROM   events
        WHERE  id = p_event_id
        FOR UPDATE;               -- row-level lock to prevent race conditions

        IF v_organizer_id IS NULL THEN
            ROLLBACK;
            SET p_message = 'ERROR: Event not found.';
        ELSEIF v_status != 'published' THEN
            ROLLBACK;
            SET p_message = 'ERROR: Event is not published.';
        ELSEIF v_date_end < NOW() THEN
            ROLLBACK;
            SET p_message = 'ERROR: This event has already ended.';
        ELSEIF v_organizer_id = p_user_id THEN
            ROLLBACK;
            SET p_message = 'ERROR: You cannot register for your own event.';
        ELSE
            -- 2. Check for existing registration
            SELECT COUNT(*) INTO v_existing
            FROM registrations
            WHERE event_id = p_event_id AND user_id = p_user_id;

            IF v_existing > 0 THEN
                ROLLBACK;
                SET p_message = 'ERROR: You are already registered for this event.';
            ELSE
                -- 3. Check capacity (if set)
                IF v_capacity IS NOT NULL THEN
                    SELECT COUNT(*) INTO v_attendee_count
                    FROM registrations
                    WHERE event_id = p_event_id AND status != 'cancelled';

                    IF v_attendee_count >= v_capacity THEN
                        ROLLBACK;
                        SET p_message = 'ERROR: This event is fully booked.';
                    END IF;
                END IF;

                -- 4. All checks passed — insert registration
                SET v_pay_status = IF(v_price > 0, 'pending', 'free');

                INSERT INTO registrations (event_id, user_id, payment_amount, payment_status)
                VALUES (p_event_id, p_user_id, v_price, v_pay_status);

                COMMIT;
                SET p_message = 'SUCCESS: Registered successfully.';
            END IF;
        END IF;
END$$


-- ── PROCEDURE: sp_cancel_event_safely ────────────────────────────
-- Atomically cancels an event and all its active registrations.
-- Only the organizer of the event may cancel it.
-- Triggers (trg_auto_cancel_registrations_on_event_cancel) then
-- automatically notify attendees.
--
-- Usage:
--   CALL sp_cancel_event_safely(organizer_user_id, event_id, @out_msg);
--   SELECT @out_msg;
CREATE PROCEDURE sp_cancel_event_safely(
    IN  p_organizer_id INT,
    IN  p_event_id     INT,
    OUT p_message      VARCHAR(255)
)
BEGIN
    DECLARE v_real_organizer INT;
    DECLARE v_current_status VARCHAR(20);
    DECLARE exit handler FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_message = 'ERROR: Database error. Cancellation rolled back.';
    END;

    START TRANSACTION;

        -- 1. Verify ownership and current status
        SELECT organizer_id, status
        INTO   v_real_organizer, v_current_status
        FROM   events
        WHERE  id = p_event_id
        FOR UPDATE;

        IF v_real_organizer IS NULL THEN
            ROLLBACK;
            SET p_message = 'ERROR: Event not found.';
        ELSEIF v_real_organizer != p_organizer_id THEN
            ROLLBACK;
            SET p_message = 'ERROR: Permission denied. You are not the organiser.';
        ELSEIF v_current_status = 'cancelled' THEN
            ROLLBACK;
            SET p_message = 'ERROR: Event is already cancelled.';
        ELSE
            -- 2. Cancel the event (trigger auto-cancels registrations & notifies attendees)
            UPDATE events
            SET    status     = 'cancelled',
                   updated_at = NOW()
            WHERE  id = p_event_id;

            COMMIT;
            SET p_message = 'SUCCESS: Event cancelled and all registrations have been revoked.';
        END IF;
END$$

DELIMITER ;
