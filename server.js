const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Инициализация базы данных SQLite
let db;
const dbPath = path.join(__dirname, 'forum.db');

function initDB() {
    const dbExists = require('fs').existsSync(dbPath);
    
    db = new Database(dbPath);
    
    // Включаем поддержку внешних ключей
    db.pragma('foreign_keys = ON');
    
    if (!dbExists) {
        // Создание таблиц
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                roblox_nick TEXT,
                rod TEXT,
                discord TEXT,
                avatar TEXT,
                avatar_url TEXT,
                role TEXT DEFAULT 'user',
                reputation INTEGER DEFAULT 0,
                is_email_verified INTEGER DEFAULT 0,
                is_roblox_verified INTEGER DEFAULT 0,
                is_banned INTEGER DEFAULT 0,
                ban_reason TEXT,
                roblox_user_id TEXT,
                email_code TEXT,
                email_code_expires TEXT,
                is_online INTEGER DEFAULT 0,
                last_seen TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                extra_data TEXT,
                author_id TEXT NOT NULL,
                views INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                is_hot INTEGER DEFAULT 0,
                status TEXT DEFAULT 'open',
                status_text TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                author_id TEXT NOT NULL,
                text TEXT NOT NULL,
                is_admin_action INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (post_id) REFERENCES posts(id),
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `);
        
        db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                content TEXT NOT NULL,
                is_read INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (sender_id) REFERENCES users(id),
                FOREIGN KEY (receiver_id) REFERENCES users(id)
            )
        `);
        
        // Создание админа по умолчанию
        const adminId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const now = new Date().toISOString();
        const stmt = db.prepare(`
            INSERT INTO users (id, username, email, password, roblox_nick, avatar, role, is_email_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(adminId, 'Admin', 'admin@unfilteredrp.com', hashPassword('admin123'), 'AdminRP', '👑', 'management', 1, now, now);
        
        console.log('База данных создана с админом по умолчанию (admin@unfilteredrp.com / admin123)');
    } else {
        console.log('База данных загружена');
    }
}

// Простой хеш пароля (в продакшене используйте bcrypt)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// API Routes
app.post('/api/auth/register', (req, res) => {
    try {
        const { username, email, password, robloxNick, rod } = req.body;
        
        if (!username || !email || !password || !robloxNick || !rod) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        // Проверка существующего пользователя
        const stmt = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?');
        const existing = stmt.all(username, email.toLowerCase());
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
        }
        
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const now = new Date().toISOString();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const insertStmt = db.prepare(`
            INSERT INTO users (id, username, email, password, roblox_nick, rod, avatar, role, email_code, email_code_expires, created_at, updated_at, is_online)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(id, username, email.toLowerCase(), hashPassword(password), robloxNick, rod, '🎮', 'user', emailCode, codeExpires, now, now, 1);
        
        res.json({
            token: 'token_' + id,
            user: {
                id,
                username,
                email: email.toLowerCase(),
                roblox_nick: robloxNick,
                rod,
                avatar: '🎮',
                role: 'user'
            },
            emailCode
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', (req, res) => {
    try {
        const { username, password } = req.body;
        
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const rows = stmt.all(username);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const user = rows[0];
        
        if (user.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        if (user.is_banned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован: ' + (user.ban_reason || 'Причина не указана') });
        }
        
        const updateStmt = db.prepare('UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?');
        updateStmt.run(new Date().toISOString(), user.id);
        
        res.json({
            token: 'token_' + user.id,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                roblox_nick: user.roblox_nick,
                rod: user.rod,
                discord: user.discord,
                avatar: user.avatar,
                avatar_url: user.avatar_url,
                role: user.role,
                reputation: user.reputation || 0,
                is_email_verified: user.is_email_verified,
                is_roblox_verified: user.is_roblox_verified,
                created_at: user.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Заглушки для остальных API (нужно будет доработать)
app.get('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

app.post('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    if (db) {
        db.close();
    }
    process.exit(0);
});

// Запуск сервера
initDB();
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   СЕРВЕР УСПЕШНО ЗАПУЩЕН! ✓          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Сервер работает на: http://localhost:${PORT}`);
    console.log(`📡 Порты: ${PORT}`);
    console.log('');
    console.log('✅ База данных подключена');
    console.log('✅ API готов к работе');
    console.log('');
    console.log('💡 Чтобы остановить сервер, нажмите: Ctrl + C');
    console.log('');
});
