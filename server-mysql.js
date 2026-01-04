const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки подключения к MySQL
// Настройки подключения к MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'u3372230_default',
    password: process.env.DB_PASSWORD || '2zU57A3q7HdzliBz', // УКАЖИТЕ ПАРОЛЬ ОТ ПОЛЬЗОВАТЕЛЯ БД
    database: process.env.DB_NAME || 'u3372230_unfilteredrp-bd',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Создание пула подключений
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Простой хеш пароля (в продакшене используйте bcrypt!)
function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// Генерация ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// API Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, robloxNick, rod } = req.body;
        
        if (!username || !email || !password || !robloxNick || !rod) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        // Проверка существующего пользователя
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email.toLowerCase()]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Пользователь с таким именем или email уже существует' });
        }
        
        const id = generateId();
        const now = new Date();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000);
        
        await pool.execute(
            `INSERT INTO users (id, username, email, password, roblox_nick, rod, avatar, role, email_code, email_code_expires, created_at, updated_at, is_online)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, username, email.toLowerCase(), hashPassword(password), robloxNick, rod, '🎮', 'user', emailCode, codeExpires, now, now, 1]
        );
        
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
        console.error('Register error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        const user = users[0];
        
        if (user.password !== hashPassword(password)) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        
        if (user.is_banned) {
            return res.status(403).json({ error: 'Аккаунт заблокирован: ' + (user.ban_reason || 'Причина не указана') });
        }
        
        await pool.execute(
            'UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?',
            [new Date(), user.id]
        );
        
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
        console.error('Login error:', error);
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

// Проверка подключения к БД
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Подключение к MySQL успешно!');
        connection.release();
    } catch (error) {
        console.error('❌ Ошибка подключения к MySQL:', error.message);
        console.log('Проверьте настройки подключения в dbConfig');
    }
}

// Запуск сервера
testConnection();
app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════╗');
    console.log('║   СЕРВЕР УСПЕШНО ЗАПУЩЕН! ✓          ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Сервер работает на: http://localhost:${PORT}`);
    console.log(`📡 Порты: ${PORT}`);
    console.log('');
    console.log('✅ API готов к работе');
    console.log('');
    console.log('💡 Чтобы остановить сервер, нажмите: Ctrl + C');
    console.log('');
});

