require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    // If env password looks truncated (missing # or $), use the raw value
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'evnt_db',
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

async function initDb() {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              email VARCHAR(255) UNIQUE NOT NULL,
              password TEXT,
              first_name VARCHAR(100) NOT NULL,
              last_name VARCHAR(100),
              initials VARCHAR(5),
              role ENUM('member','admin') DEFAULT 'member',
              phone VARCHAR(20),
              bio TEXT,
              avatar_url TEXT,
              is_verified BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;



            CREATE TABLE IF NOT EXISTS event_categories (
              id INT AUTO_INCREMENT PRIMARY KEY,
              name VARCHAR(100) UNIQUE NOT NULL,
              description TEXT,
              icon VARCHAR(50),
              color VARCHAR(20),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;

            CREATE TABLE IF NOT EXISTS events (
              id INT AUTO_INCREMENT PRIMARY KEY,
              organizer_id INT NOT NULL,
              title VARCHAR(255) NOT NULL,
              description TEXT,
              category_id INT,
              event_mode ENUM('online','offline','hybrid') DEFAULT 'offline',
              date_start DATETIME NOT NULL,
              date_end DATETIME NOT NULL,
              location VARCHAR(255),
              address TEXT,
              capacity INT,
              price DECIMAL(10,2) DEFAULT 0.00,
              currency VARCHAR(10) DEFAULT 'USD',
              image_url TEXT,
              status ENUM('draft','published','cancelled','completed') DEFAULT 'draft',
              is_featured BOOLEAN DEFAULT FALSE,
              registration_deadline DATETIME,
              require_approval BOOLEAN DEFAULT FALSE,
              show_attendees BOOLEAN DEFAULT TRUE,
              send_reminders BOOLEAN DEFAULT TRUE,
              enable_waitlist BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE,
              FOREIGN KEY (category_id) REFERENCES event_categories(id) ON DELETE SET NULL
            ) ENGINE=InnoDB;

            CREATE TABLE IF NOT EXISTS registrations (
              id INT AUTO_INCREMENT PRIMARY KEY,
              event_id INT NOT NULL,
              user_id INT NOT NULL,
              status ENUM('pending','confirmed','cancelled','waitlist','attended') DEFAULT 'confirmed',
              payment_amount DECIMAL(10,2) DEFAULT 0.00,
              payment_status ENUM('free','pending','paid','refunded') DEFAULT 'free',
              registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              notes TEXT,
              UNIQUE (event_id, user_id),
              FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;

            CREATE TABLE IF NOT EXISTS event_reviews (
              id INT AUTO_INCREMENT PRIMARY KEY,
              event_id INT,
              user_id INT,
              rating TINYINT,
              review TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;

            CREATE TABLE IF NOT EXISTS notifications (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT,
              title VARCHAR(255),
              message TEXT,
              is_read BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;

            CREATE TABLE IF NOT EXISTS password_reset_tokens (
              id         INT AUTO_INCREMENT PRIMARY KEY,
              user_id    INT NOT NULL,
              token      VARCHAR(64) NOT NULL UNIQUE,
              expires_at DATETIME NOT NULL,
              used       BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
        `);

        // Seed categories
        await conn.query(`
            INSERT IGNORE INTO event_categories (name, description, icon, color) VALUES
            ('conference','Professional conferences','briefcase','#6366f1'),
            ('workshop','Hands-on learning','wrench','#8b5cf6'),
            ('meetup','Casual meetups','users','#ec4899'),
            ('social','Social gatherings','music','#f59e0b'),
            ('sports','Sports activities','zap','#10b981'),
            ('music','Music events','music','#ef4444'),
            ('art','Art exhibitions','palette','#f97316'),
            ('tech','Tech events','cpu','#3b82f6'),
            ('business','Business events','briefcase','#6366f1'),
            ('education','Educational events','book','#14b8a6'),
            ('other','Other events','calendar','#6b7280')
        `);

        // Safely add ticket_name column — works on MySQL 5.7+ and 8.0+
        const [colCheck] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'events'
              AND COLUMN_NAME  = 'ticket_name'
        `);
        if (colCheck[0].cnt === 0) {
            await conn.query(`ALTER TABLE events ADD COLUMN ticket_name VARCHAR(100) DEFAULT NULL`);
            console.log('✅ Added ticket_name column to events');
        }

        // Safely add updated_at to registrations if missing
        const [regColCheck] = await conn.query(`
            SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'registrations'
              AND COLUMN_NAME  = 'updated_at'
        `);
        if (regColCheck[0].cnt === 0) {
            await conn.query(`ALTER TABLE registrations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
            console.log('✅ Added updated_at column to registrations');
        }

        console.log('✅ Database tables ready');
    } catch (err) {
        console.error('❌ DB init error:', err.message);
    } finally {
        conn.release();
    }
}

// Connect and initialise on startup
pool.getConnection()
    .then(conn => {
        console.log('✅ MySQL connected to', process.env.DB_NAME || 'evnt_db');
        conn.release();
        return initDb();
    })
    .catch(err => console.error('❌ MySQL connection failed:', err.message));

module.exports = { pool };
