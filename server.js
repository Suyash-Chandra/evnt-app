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
        await q("INSERT INTO user_profiles (user_id) VALUES (?)", [result.insertId]);
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

/* ----------------------- CATEGORIES -------------------- */
app.get("/api/categories", async (req, res) => {
    try {
        const rows = await q("SELECT * FROM event_categories ORDER BY name");
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- EVENTS — PUBLIC --------------- */
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

/* ----------------------- EVENTS — PROTECTED ------------ */
app.post("/api/events", auth, async (req, res) => {
    const { title, description, category, type, startDate, endDate,
            location, address, capacity, price = 0, imageUrl,
            requireApproval, showAttendees, sendReminders, enableWaitlist } = req.body;
    if (!title || !startDate || !endDate || !category)
        return res.status(400).json({ error: "Title, dates and category are required" });
    if (new Date(startDate) >= new Date(endDate))
        return res.status(400).json({ error: "End date must be after start date" });
    try {
        const cat = await one("SELECT id FROM event_categories WHERE name=?", [category]);
        const result = await q(`
            INSERT INTO events (organizer_id,title,description,category_id,event_mode,date_start,date_end,
                                location,address,capacity,price,image_url,status,
                                require_approval,show_attendees,send_reminders,enable_waitlist)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'published',?,?,?,?)`,
            [req.user.id, title, description, cat?.id || null, type || "offline",
             startDate, endDate, location, address, capacity || null,
             parseFloat(price) || 0, imageUrl || null,
             requireApproval ? 1 : 0, showAttendees !== false ? 1 : 0,
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
        const cat = category ? await one("SELECT id FROM event_categories WHERE name=?", [category]) : null;
        await q(`UPDATE events SET title=?,description=?,category_id=?,event_mode=?,date_start=?,
                  date_end=?,location=?,address=?,capacity=?,price=?,image_url=? WHERE id=?`,
            [title, description, cat?.id || null, type, startDate, endDate, location, address,
             capacity || null, parseFloat(price) || 0, imageUrl || null, req.params.id]);
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
        if (event.organizer_id === req.user.id)
            return res.status(400).json({ error: "You cannot register for your own event" });
        if (event.capacity) {
            const [cnt] = await pool.query("SELECT COUNT(*) AS c FROM registrations WHERE event_id=? AND status != 'cancelled'", [eventId]);
            if (cnt[0].c >= event.capacity) return res.status(400).json({ error: "Event is fully booked" });
        }
        await q("INSERT INTO registrations (event_id,user_id,payment_amount,payment_status) VALUES (?,?,?,?)",
            [eventId, req.user.id, event.price || 0, event.price > 0 ? "pending" : "free"]);
        res.json({ message: "Registered successfully" });
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
                   up.company,up.job_title,up.website,up.linkedin,up.twitter,up.interests,
                   (SELECT COUNT(*) FROM events WHERE organizer_id=u.id) AS hosted_count,
                   (SELECT COUNT(*) FROM registrations WHERE user_id=u.id AND status!='cancelled') AS attending_count
            FROM users u LEFT JOIN user_profiles up ON u.id=up.user_id WHERE u.id=?`, [req.user.id]);
        res.json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/user/profile", auth, async (req, res) => {
    try {
        const { firstName, lastName, phone, bio, company, jobTitle, website, linkedin, twitter } = req.body;
        const initials = `${(firstName||"U")[0]}${lastName ? lastName[0] : ""}`.toUpperCase();
        await q("UPDATE users SET first_name=?,last_name=?,phone=?,bio=?,initials=? WHERE id=?",
            [firstName, lastName, phone, bio, initials, req.user.id]);
        await q(`INSERT INTO user_profiles (user_id,company,job_title,website,linkedin,twitter,interests)
                 VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
                 company=VALUES(company),job_title=VALUES(job_title),website=VALUES(website),
                 linkedin=VALUES(linkedin),twitter=VALUES(twitter)`,
            [req.user.id, company, jobTitle, website, linkedin, twitter, null]);
        res.json({ message: "Profile updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ----------------------- SERVE SPA --------------------- */
app.get("/{*path}", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(PORT, () => console.log(`\n?? Evnt App running at http://localhost:${PORT}\n`));
