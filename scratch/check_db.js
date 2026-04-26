const { dbAsync } = require('../database');

async function check() {
    try {
        const schema = await dbAsync.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'");
        console.log("Users Schema:", schema.sql);

        const users = await dbAsync.all("SELECT * FROM users LIMIT 5");
        console.log("Users Data:", users);

        const events = await dbAsync.all("SELECT * FROM events LIMIT 5");
        console.log("Events Data:", events);

    } catch (err) {
        console.error(err);
    }
}

check();
