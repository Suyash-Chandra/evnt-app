require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'evnt_db',
    waitForConnections: true,
    connectionLimit: 10,
    // Enable SSL for deployment (e.g. Railway, PlanetScale)
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Verify connection on startup
pool.getConnection()
    .then(conn => { console.log('✅ MySQL connected to', process.env.DB_NAME || 'evnt_db'); conn.release(); })
    .catch(err => { console.error('❌ MySQL connection failed:', err.message); });

module.exports = { pool };
