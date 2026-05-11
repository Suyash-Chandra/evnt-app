require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "secret";

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

/* ----------------------- HELPERS ----------------------- */
const q = (sql, params = []) => pool.query(sql, params).then(([rows]) => rows);
const one = (sql, params = []) => q(sql, params).then(rows => rows[0] || null);

/* ----------------------- AUTH MIDDLEWARE --------------- */
const auth = async (req, res, next) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await one("SELECT id,email,first_name,last_name,role,initials FROM users WHERE id=?", [decoded.id]);
        if (!user) return res.status(401).json({ error: "User not found" });
        req.user = user;
        next();
    } catch { res.status(403).json({ error: "Invalid token" }); }
};

/* ----------------------- AUTH ROUTES ------------------- */
app.post("/api/auth/signup", async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName)
        return res.status(400).json({ error: "Email, password and first name required" });
    if (password.length < 6)
        return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
        const existing = await one("SELECT id FROM users WHERE email=?", [email.toLowerCase()]);
        if (existing) return res.status(400).json({ error: "Email already registered" });
        const hash = await bcrypt.hash(password, 10);
        const initials = `${firstName[0]}${lastName ? lastName[0] : ""}`.toUpperCase();
        const result = await q(
            "INSERT INTO users (email,password,first_name,last_name,initials,role) VALUES (?,?,?,?,?,?)",
            [email.toLowerCase(), hash, firstName, lastName || "", initials, "member"]
        );

        res.status(201).json({ message: "Account created successfully" });
    } catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ error: "Failed to create account" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    try {
        const user = await one("SELECT * FROM users WHERE email=?", [email.toLowerCase()]);
        if (!user || !user.password) return res.status(401).json({ error: "Invalid email or password" });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: "Invalid email or password" });
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
        res.cookie("auth_token", token, { httpOnly: true, maxAge: 7*24*60*60*1000, sameSite: "lax" });
        res.json({ user: { id: user.id, email: user.email, first_name: user.first_name, last_name: user.last_name, initials: user.initials, role: user.role } });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: req.user }));

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("auth_token");
    res.json({ message: "Logged out" });
});

/* ── Forgot password ─────────────────────────────────────────────
   Generates a secure random token, stores it in password_reset_tokens
   (expires in 1 hour), and returns it in the response.
   In a production app this token would be emailed — here it's returned
   directly so the demo works without an SMTP server.         */
app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    try {
        const user = await one("SELECT id, first_name FROM users WHERE email=?", [email.toLowerCase()]);
        // Always return success to prevent email enumeration
        if (!user) return res.json({ message: "If that email exists, a reset token has been generated." });

        // Expire any existing unused tokens for this user
        await q("UPDATE password_reset_tokens SET used=1 WHERE user_id=? AND used=0", [user.id]);

        // Generate a 32-byte hex token
        const crypto = require("crypto");
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await q(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?,?,?)",
            [user.id, token, expiresAt]
        );

        res.json({
            message: "Reset token generated.",
            token,           // returned for demo purposes (would be emailed in production)
            name: user.first_name
        });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ error: "Failed to generate reset token" });
    }
});

/* ── Reset password ──────────────────────────────────────────────
   Validates the token (must exist, be unused, and not expired),
   hashes the new password, updates the users table, and marks
   the token as used so it cannot be replayed.                */
app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    try {
        const record = await one(
            `SELECT prt.id, prt.user_id, prt.expires_at, prt.used
             FROM password_reset_tokens prt
             WHERE prt.token = ?`,
            [token]
        );
        if (!record)          return res.status(400).json({ error: "Invalid or expired reset token" });
        if (record.used)      return res.status(400).json({ error: "This reset link has already been used" });
        if (new Date(record.expires_at) < new Date())
                              return res.status(400).json({ error: "This reset link has expired. Please request a new one." });

        const hash = await bcrypt.hash(newPassword, 10);
        await q("UPDATE users SET password=?, updated_at=NOW() WHERE id=?", [hash, record.user_id]);
        await q("UPDATE password_reset_tokens SET used=1 WHERE id=?", [record.id]);

        res.json({ message: "Password updated successfully. You can now sign in." });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ error: "Failed to reset password" });
    }
});

/* ----------------------- CATEGORIES -------------------- */
app.get("/api/categories", async (req, res) => {
    try {
        const rows = await q("SELECT * FROM event_categories ORDER BY name");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- EVENTS � PUBLIC --------------- */
app.get("/api/events", async (req, res) => {
    try {
        const { category, type, search, featured, limit = 9, offset = 0 } = req.query;
        let where = "WHERE e.status = 'published'";
        const params = [];
        if (category) { where += " AND ec.name = ?"; params.push(category); }
        if (type) { where += " AND e.event_mode = ?"; params.push(type); }
        if (featured === "true") { where += " AND e.is_featured = 1"; }
        if (search) { where += " AND (e.title LIKE ? OR e.description LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        params.push(parseInt(limit), parseInt(offset));

        const events = await q(`
            SELECT e.*, ec.name AS category, ec.color AS category_color,
                   CONCAT(u.first_name,' ',IFNULL(u.last_name,'')) AS organizer_name,
                   (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id AND r.status != 'cancelled') AS attendee_count
            FROM events e
            JOIN users u ON e.organizer_id = u.id
            LEFT JOIN event_categories ec ON e.category_id = ec.id
            ${where}
            ORDER BY e.date_start ASC
            LIMIT ? OFFSET ?`, params);
        res.json(events);
    } catch (err) {
        console.error("Events error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/events/:id", async (req, res) => {
    try {
        const event = await one(`
            SELECT e.*, ec.name AS category, ec.color AS category_color,
                   CONCAT(u.first_name,' ',IFNULL(u.last_name,'')) AS organizer_name,
                   (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id AND r.status != 'cancelled') AS attendee_count
            FROM events e
            JOIN users u ON e.organizer_id = u.id
            LEFT JOIN event_categories ec ON e.category_id = ec.id
            WHERE e.id = ? AND e.status = 'published'`, [req.params.id]);
        if (!event) return res.status(404).json({ error: "Event not found" });
        res.json(event);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- EVENTS � PROTECTED ------------ */
app.post("/api/events", auth, async (req, res) => {
    const { title, description, category, type, startDate, endDate,
            location, address, capacity, price = 0, imageUrl,
            requireApproval, showAttendees, sendReminders, enableWaitlist } = req.body;

    // ── Required fields ─────────────────────────────────────────────
    if (!title || !startDate || !endDate || !category)
        return res.status(400).json({ error: "Title, dates and category are required" });

    // ── Date validations ─────────────────────────────────────────
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (start <= new Date())
        return res.status(400).json({ error: "Start date must be in the future" });
    if (end <= start)
        return res.status(400).json({ error: "End date must be after the start date" });

    // ── Capacity validation ─────────────────────────────────────
    const cap = capacity !== undefined && capacity !== null && capacity !== '' ? parseInt(capacity) : null;
    if (cap !== null && cap < 1)
        return res.status(400).json({ error: "Capacity must be at least 1, or leave it blank for unlimited" });

    // ── Price validation ─────────────────────────────────────────
    const parsedPrice = parseFloat(price) || 0;
    if (parsedPrice < 0)
        return res.status(400).json({ error: "Ticket price cannot be negative. Use 0 for a free event." });

    try {
        const cat = await one("SELECT id FROM event_categories WHERE name=?", [category]);
        const ticketName = req.body.ticketName ? String(req.body.ticketName).trim().slice(0, 100) : null;
        const result = await q(`
            INSERT INTO events (organizer_id,title,description,category_id,event_mode,date_start,date_end,
                                location,address,capacity,price,image_url,status,ticket_name,
                                require_approval,show_attendees,send_reminders,enable_waitlist)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?,?)`,
            [req.user.id, title, description, cat?.id || null,
             (modeMap => modeMap[type] || 'offline')({"in-person":"offline","offline":"offline","online":"online","hybrid":"hybrid"}),
             startDate, endDate, location, address, cap,
             parsedPrice, imageUrl || null, ticketName,
             requireApproval ? 1 : 0, 1,
             sendReminders !== false ? 1 : 0, enableWaitlist ? 1 : 0]);
        res.status(201).json({ id: result.insertId, message: "Event published successfully" });
    } catch (err) {
        console.error("Create event error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.put("/api/events/:id", auth, async (req, res) => {
    try {
        const event = await one("SELECT id FROM events WHERE id=? AND organizer_id=?", [req.params.id, req.user.id]);
        if (!event) return res.status(404).json({ error: "Event not found or permission denied" });

        const { title, description, category, type, startDate, endDate, location, address, capacity, price, imageUrl } = req.body;

        // ── Date validations (only if dates are being updated) ──────────────
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end   = new Date(endDate);
            if (start <= new Date())
                return res.status(400).json({ error: "Start date must be in the future" });
            if (end <= start)
                return res.status(400).json({ error: "End date must be after the start date" });
        }

        // ── Capacity validation ───────────────────────────────────────
        const cap = capacity !== undefined && capacity !== null && capacity !== '' ? parseInt(capacity) : null;
        if (cap !== null && cap < 1)
            return res.status(400).json({ error: "Capacity must be at least 1, or leave blank for unlimited" });

        const cat = category ? await one("SELECT id FROM event_categories WHERE name=?", [category]) : null;
        await q(`UPDATE events SET title=?,description=?,category_id=?,event_mode=?,date_start=?,
                  date_end=?,location=?,address=?,capacity=?,price=?,image_url=? WHERE id=?`,
            [title, description, cat?.id || null, type, startDate, endDate, location, address,
             cap, parseFloat(price) || 0, imageUrl || null, req.params.id]);
        res.json({ message: "Event updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/events/:id", auth, async (req, res) => {
    try {
        const event = await one("SELECT id FROM events WHERE id=? AND organizer_id=?", [req.params.id, req.user.id]);
        if (!event) return res.status(404).json({ error: "Event not found or permission denied" });
        await q("DELETE FROM events WHERE id=?", [req.params.id]);
        res.json({ message: "Event deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- REGISTRATIONS ----------------- */
app.post("/api/events/:id/register", auth, async (req, res) => {
    const eventId = parseInt(req.params.id);
    try {
        const event = await one("SELECT * FROM events WHERE id=? AND status='published'", [eventId]);
        if (!event) return res.status(404).json({ error: "Event not found" });

        // ── Time check: block registration after event has ended ──────────
        if (new Date(event.date_end) < new Date())
            return res.status(400).json({ error: "This event has already ended" });

        // ── Organizer check ───────────────────────────────────────────────
        if (event.organizer_id === req.user.id)
            return res.status(400).json({ error: "You cannot register for your own event" });

        // ── Capacity check (with waitlist support) ──────────────────────────
        if (event.capacity) {
            const [cnt] = await pool.query("SELECT COUNT(*) AS c FROM registrations WHERE event_id=? AND status NOT IN ('cancelled','waitlist')", [eventId]);
            if (cnt[0].c >= event.capacity) {
                if (event.enable_waitlist) {
                    // Add to waitlist instead of rejecting
                    await q("INSERT INTO registrations (event_id,user_id,payment_amount,payment_status,status) VALUES (?,?,?,?,?)",
                        [eventId, req.user.id, 0, 'free', 'waitlist']);
                    return res.json({ message: "Event is full — you've been added to the waitlist!", waitlisted: true });
                } else {
                    return res.status(400).json({ error: "This event is fully booked" });
                }
            }
        }

        // ── Determine registration status (approval required?) ──────────────
        const regStatus = event.require_approval ? 'pending' : 'confirmed';
        const payStatus = event.price > 0 ? 'paid' : 'free';

        await q("INSERT INTO registrations (event_id,user_id,payment_amount,payment_status,status) VALUES (?,?,?,?,?)",
            [eventId, req.user.id, event.price || 0, payStatus, regStatus]);

        const msg = event.require_approval
            ? "Registration submitted! The organizer will review and approve your request."
            : "Registered successfully!";
        res.json({ message: msg, pending: event.require_approval ? true : false });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") return res.status(400).json({ error: "Already registered" });
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/events/:id/register", auth, async (req, res) => {
    try {
        await q("UPDATE registrations SET status='cancelled' WHERE event_id=? AND user_id=?", [req.params.id, req.user.id]);
        res.json({ message: "Registration cancelled" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/events/:id/registration-status", auth, async (req, res) => {
    try {
        const reg = await one("SELECT status FROM registrations WHERE event_id=? AND user_id=?", [req.params.id, req.user.id]);
        res.json({ registered: !!reg && reg.status !== "cancelled", status: reg?.status || null });
    } catch { res.json({ registered: false, status: null }); }
});

/* ----------------------- DASHBOARD --------------------- */
app.get("/api/user/dashboard", auth, async (req, res) => {
    try {
        const myEvents = await q(`
            SELECT e.*, ec.name AS category,
                   (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id AND r.status!='cancelled') AS attendee_count
            FROM events e LEFT JOIN event_categories ec ON e.category_id=ec.id
            WHERE e.organizer_id=? ORDER BY e.created_at DESC`, [req.user.id]);

        const attending = await q(`
            SELECT e.*, ec.name AS category,
                   CONCAT(u.first_name,' ',IFNULL(u.last_name,'')) AS organizer_name,
                   reg.status AS registration_status
            FROM registrations reg
            JOIN events e ON reg.event_id=e.id
            JOIN users u ON e.organizer_id=u.id
            LEFT JOIN event_categories ec ON e.category_id=ec.id
            WHERE reg.user_id=? AND reg.status!='cancelled'
            ORDER BY e.date_start ASC`, [req.user.id]);

        const [totalAttendeesRow] = await pool.query(
            "SELECT COUNT(*) AS c FROM registrations r JOIN events e ON r.event_id=e.id WHERE e.organizer_id=? AND r.status!='cancelled'",
            [req.user.id]);

        const recentSignups = await q(`
            SELECT reg.registered_at, u.first_name, u.last_name, u.initials, e.title AS event_title
            FROM registrations reg
            JOIN users u ON reg.user_id=u.id
            JOIN events e ON reg.event_id=e.id
            WHERE e.organizer_id=? AND reg.status!='cancelled'
            ORDER BY reg.registered_at DESC LIMIT 5`, [req.user.id]);

        res.json({
            stats: {
                totalEvents: myEvents.length,
                totalAttendees: totalAttendeesRow[0]?.c || 0,
                upcomingEvents: myEvents.filter(e => new Date(e.date_start) > new Date()).length,
                attending: attending.length
            },
            myEvents, attending, recentSignups
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        res.status(500).json({ error: err.message });
    }
});

/* ----------------------- USER PROFILE ------------------ */
app.get("/api/user/profile", auth, async (req, res) => {
    try {
        const user = await one(`
            SELECT u.id,u.email,u.first_name,u.last_name,u.initials,u.bio,u.phone,u.avatar_url,u.created_at,
                   (SELECT COUNT(*) FROM events WHERE organizer_id=u.id) AS hosted_count,
                   (SELECT COUNT(*) FROM registrations WHERE user_id=u.id AND status!='cancelled') AS attending_count
            FROM users u WHERE u.id=?`, [req.user.id]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/user/profile", auth, async (req, res) => {
    try {
        const { firstName, lastName, phone, bio } = req.body;
        const initials = `${(firstName||"U")[0]}${lastName ? lastName[0] : ""}`.toUpperCase();
        await q("UPDATE users SET first_name=?,last_name=?,phone=?,bio=?,initials=? WHERE id=?",
            [firstName, lastName, phone, bio, initials, req.user.id]);
        res.json({ message: "Profile updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- REGISTERED EVENTS ------------- */
app.get("/api/user/registered-events", auth, async (req, res) => {
    try {
        const events = await q(`
            SELECT e.*, ec.name AS category, ec.color AS category_color,
                   CONCAT(u.first_name,' ',IFNULL(u.last_name,'')) AS organizer_name,
                   (SELECT COUNT(*) FROM registrations r2 WHERE r2.event_id=e.id AND r2.status!='cancelled') AS attendee_count,
                   reg.id AS registration_id, reg.registered_at, reg.payment_status,
                   CONCAT(me.first_name,' ',IFNULL(me.last_name,'')) AS attendee_name,
                   e.ticket_name
            FROM registrations reg
            JOIN events e ON reg.event_id = e.id
            JOIN users u ON e.organizer_id = u.id
            JOIN users me ON reg.user_id = me.id
            LEFT JOIN event_categories ec ON e.category_id = ec.id
            WHERE reg.user_id = ? AND reg.status != 'cancelled'
            ORDER BY e.date_start ASC`, [req.user.id]);

        const now = new Date();
        const upcoming = events.filter(e => new Date(e.date_start) >= now);
        const past = events.filter(e => new Date(e.date_start) < now);
        res.json({ upcoming, past });
    } catch (err) {
        console.error("Registered events error:", err);
        res.status(500).json({ error: err.message });
    }
});

/* ----------------------- ORGANIZER ATTENDEES ------------- */
app.get("/api/user/attendees", auth, async (req, res) => {
    try {
        const attendees = await q(`
            SELECT u.first_name, u.last_name, u.email, e.title AS event_title, e.id AS event_id, reg.registered_at, reg.payment_status
            FROM registrations reg
            JOIN users u ON reg.user_id = u.id
            JOIN events e ON reg.event_id = e.id
            WHERE e.organizer_id = ? AND reg.status != 'cancelled'
            ORDER BY reg.registered_at DESC`, [req.user.id]);
        res.json(attendees);
    } catch (err) {
        console.error("Attendees error:", err);
        res.status(500).json({ error: err.message });
    }
});

/* ----------------------- SERVE SPA --------------------- */
app.get("/{*path}", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`\n?? Evnt App running at http://localhost:${PORT}\n`));

