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

// Middleware для проверки авторизации
async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const token = authHeader.substring(7); // Убираем "Bearer "
        if (!token.startsWith('token_')) {
            return res.status(401).json({ error: 'Invalid token format' });
        }
        
        const userId = token.replace('token_', '');
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = users[0];
        req.userId = userId;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: error.message });
    }
}

// Форматирование пользователя для ответа
function formatUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        roblox_nick: user.roblox_nick,
        rod: user.rod || null,
        discord: user.discord || null,
        avatar: user.avatar,
        avatar_url: user.avatar_url,
        role: user.role,
        reputation: user.reputation || 0,
        is_email_verified: user.is_email_verified || false,
        is_roblox_verified: user.is_roblox_verified || false,
        is_muted: user.is_muted || false,
        mute_reason: user.mute_reason || null,
        mute_expires_at: user.mute_expires_at || null,
        created_at: user.created_at
    };
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

// ===== AUTH ENDPOINTS =====
app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
        res.json(formatUser(req.user));
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?',
            [new Date(), req.userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== POSTS ENDPOINTS =====
app.get('/api/posts', async (req, res) => {
    try {
        const { category, status, search, page = 1, limit = 20 } = req.query;
        let query = 'SELECT p.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE 1=1';
        const params = [];
        
        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }
        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }
        if (search) {
            query += ' AND (p.title LIKE ? OR p.content LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
        
        const [posts] = await pool.execute(query, params);
        
        // Форматируем посты
        const formattedPosts = posts.map(post => ({
            ...post,
            author: {
                username: post.author_username,
                avatar: post.author_avatar,
                avatar_url: post.author_avatar_url
            }
        }));
        
        // Получаем общее количество
        let countQuery = 'SELECT COUNT(*) as total FROM posts WHERE 1=1';
        const countParams = [];
        if (category) {
            countQuery += ' AND category = ?';
            countParams.push(category);
        }
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        if (search) {
            countQuery += ' AND (title LIKE ? OR content LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm);
        }
        
        const [countResult] = await pool.execute(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({ posts: formattedPosts, total });
    } catch (error) {
        console.error('Get posts error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await pool.execute(
            'SELECT p.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?',
            [id]
        );
        
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const post = posts[0];
        res.json({
            ...post,
            author: {
                username: post.author_username,
                avatar: post.author_avatar,
                avatar_url: post.author_avatar_url
            }
        });
    } catch (error) {
        console.error('Get post error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const [comments] = await pool.execute(
            'SELECT c.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC',
            [id]
        );
        
        const formattedComments = comments.map(comment => ({
            ...comment,
            author: {
                username: comment.author_username,
                avatar: comment.author_avatar,
                avatar_url: comment.author_avatar_url
            }
        }));
        
        res.json(formattedComments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/posts', requireAuth, async (req, res) => {
    try {
        const { category, title, content } = req.body;
        
        if (!category || !title || !content) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        // Проверка на мут
        if (req.user.is_muted) {
            return res.status(403).json({ 
                error: `Вы замучены и не можете создавать темы. Причина: ${req.user.mute_reason || 'Не указана'}.` 
            });
        }
        
        const id = generateId();
        const now = new Date();
        
        await pool.execute(
            'INSERT INTO posts (id, author_id, category, title, content, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, req.userId, category, title, content, 'pending', now, now]
        );
        
        // Логируем действие
        await pool.execute(
            'INSERT INTO activity_log (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [generateId(), req.userId, 'post_create', `Создана тема: ${title}`, now]
        );
        
        const [newPost] = await pool.execute(
            'SELECT p.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.id = ?',
            [id]
        );
        
        res.json({
            ...newPost[0],
            author: {
                username: newPost[0].author_username,
                avatar: newPost[0].author_avatar,
                avatar_url: newPost[0].author_avatar_url
            }
        });
    } catch (error) {
        console.error('Create post error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/posts/:id/comments', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Текст комментария обязателен' });
        }
        
        // Проверка на мут
        if (req.user.is_muted) {
            return res.status(403).json({ 
                error: `Вы замучены и не можете оставлять комментарии. Причина: ${req.user.mute_reason || 'Не указана'}.` 
            });
        }
        
        // Проверяем существование поста
        const [posts] = await pool.execute('SELECT id FROM posts WHERE id = ?', [id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const commentId = generateId();
        const now = new Date();
        
        await pool.execute(
            'INSERT INTO comments (id, post_id, author_id, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [commentId, id, req.userId, text.trim(), now, now]
        );
        
        const [newComment] = await pool.execute(
            'SELECT c.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?',
            [commentId]
        );
        
        res.json({
            ...newComment[0],
            author: {
                username: newComment[0].author_username,
                avatar: newComment[0].author_avatar,
                avatar_url: newComment[0].author_avatar_url
            }
        });
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/posts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Получаем пост
        const [posts] = await pool.execute('SELECT * FROM posts WHERE id = ?', [id]);
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const post = posts[0];
        
        // Проверка прав: автор или модератор+
        if (post.author_id !== req.userId) {
            const userLevel = getRoleLevel(req.user.role);
            if (userLevel < 2) { // Модератор = 2
                return res.status(403).json({ error: 'Ранг не доступен. Удалять темы могут только модераторы и выше.' });
            }
        }
        
        // Удаляем комментарии
        await pool.execute('DELETE FROM comments WHERE post_id = ?', [id]);
        
        // Удаляем пост
        await pool.execute('DELETE FROM posts WHERE id = ?', [id]);
        
        // Логируем
        await pool.execute(
            'INSERT INTO activity_log (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [generateId(), req.userId, 'post_delete', `Удалена тема: ${post.title}`, new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete post error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== USERS ENDPOINTS =====
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(formatUser(users[0]));
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/:id/posts', async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await pool.execute(
            'SELECT p.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE p.author_id = ? ORDER BY p.created_at DESC',
            [id]
        );
        
        const formattedPosts = posts.map(post => ({
            ...post,
            author: {
                username: post.author_username,
                avatar: post.author_avatar,
                avatar_url: post.author_avatar_url
            }
        }));
        
        res.json(formattedPosts);
    } catch (error) {
        console.error('Get user posts error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== STATS ENDPOINT =====
app.get('/api/stats', async (req, res) => {
    try {
        const [postCount] = await pool.execute('SELECT COUNT(*) as total FROM posts');
        const [userCount] = await pool.execute('SELECT COUNT(*) as total FROM users');
        const [commentCount] = await pool.execute('SELECT COUNT(*) as total FROM comments');
        const [onlineCount] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE is_online = 1');
        
        res.json({
            totalPosts: postCount[0].total,
            totalUsers: userCount[0].total,
            totalComments: commentCount[0].total,
            onlineUsers: onlineCount[0].total
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== HELPER FUNCTIONS =====
function getRoleLevel(role) {
    const roleLevels = {
        'user': 0,
        'helper': 1,
        'moderator': 2,
        'admin': 3,
        'senior_admin': 3.5,
        'manager': 4,
        'management': 5
    };
    return roleLevels[role] || 0;
}

// ===== AUTH ADDITIONAL ENDPOINTS =====
app.get('/api/auth/email-code', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        
        // Генерируем новый код, если его нет или истёк
        let emailCode = user.email_code;
        let codeExpires = user.email_code_expires;
        
        if (!emailCode || (codeExpires && new Date(codeExpires) < new Date())) {
            emailCode = Math.floor(100000 + Math.random() * 900000).toString();
            codeExpires = new Date(Date.now() + 15 * 60 * 1000);
            
            await pool.execute(
                'UPDATE users SET email_code = ?, email_code_expires = ? WHERE id = ?',
                [emailCode, codeExpires, req.userId]
            );
        }
        
        res.json({ email: user.email, code: emailCode });
    } catch (error) {
        console.error('Get email code error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/verify-email', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        const user = req.user;
        
        if (user.email_code !== code) {
            return res.status(400).json({ error: 'Неверный код' });
        }
        
        await pool.execute(
            'UPDATE users SET is_email_verified = 1, email_code = NULL, email_code_expires = NULL WHERE id = ?',
            [req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/resend-email-code', requireAuth, async (req, res) => {
    try {
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000);
        
        await pool.execute(
            'UPDATE users SET email_code = ?, email_code_expires = ? WHERE id = ?',
            [emailCode, codeExpires, req.userId]
        );
        
        res.json({ code: emailCode });
    } catch (error) {
        console.error('Resend email code error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/verify-roblox-userid', requireAuth, async (req, res) => {
    try {
        const { robloxUserId } = req.body;
        const user = req.user;
        
        if (!robloxUserId || !/^\d+$/.test(robloxUserId.toString())) {
            return res.status(400).json({ error: 'User ID должен быть числом' });
        }
        
        // Проверяем, есть ли уже активная заявка
        const [existing] = await pool.execute(
            'SELECT id FROM roblox_verifications WHERE user_id = ? AND status = ?',
            [req.userId, 'pending']
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ error: 'У вас уже есть заявка на верификацию, ожидающая рассмотрения' });
        }
        
        // Обновляем User ID
        await pool.execute(
            'UPDATE users SET roblox_user_id = ? WHERE id = ?',
            [robloxUserId.toString(), req.userId]
        );
        
        // Создаем заявку на верификацию
        const verId = generateId();
        await pool.execute(
            'INSERT INTO roblox_verifications (id, user_id, roblox_nick, roblox_user_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [verId, req.userId, user.roblox_nick, robloxUserId.toString(), 'pending', new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Verify roblox error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== POST STATUS UPDATE =====
app.put('/api/posts/:id/status', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, statusText } = req.body;
        
        await pool.execute(
            'UPDATE posts SET status = ?, status_text = ?, updated_at = ? WHERE id = ?',
            [status, statusText, new Date(), id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update post status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== FAVORITES ENDPOINTS =====
app.get('/api/favorites', requireAuth, async (req, res) => {
    try {
        const [favorites] = await pool.execute(
            'SELECT p.*, u.username as author_username, u.avatar as author_avatar, u.avatar_url as author_avatar_url FROM favorites f JOIN posts p ON f.post_id = p.id LEFT JOIN users u ON p.author_id = u.id WHERE f.user_id = ? ORDER BY f.created_at DESC',
            [req.userId]
        );
        
        const formattedPosts = favorites.map(post => ({
            ...post,
            isFavorite: true,
            author: {
                username: post.author_username,
                avatar: post.author_avatar,
                avatar_url: post.author_avatar_url
            }
        }));
        
        res.json(formattedPosts);
    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/favorites/:postId', requireAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        
        // Проверяем, есть ли уже в избранном
        const [existing] = await pool.execute(
            'SELECT id FROM favorites WHERE user_id = ? AND post_id = ?',
            [req.userId, postId]
        );
        
        if (existing.length === 0) {
            await pool.execute(
                'INSERT INTO favorites (id, user_id, post_id, created_at) VALUES (?, ?, ?, ?)',
                [generateId(), req.userId, postId, new Date()]
            );
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add favorite error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/favorites/:postId', requireAuth, async (req, res) => {
    try {
        const { postId } = req.params;
        
        await pool.execute(
            'DELETE FROM favorites WHERE user_id = ? AND post_id = ?',
            [req.userId, postId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Remove favorite error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== MESSAGES ENDPOINTS =====
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        // Получаем список диалогов
        const [conversations] = await pool.execute(
            `SELECT DISTINCT 
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_user_id,
                u.username as other_username,
                u.avatar as other_avatar,
                u.avatar_url as other_avatar_url,
                MAX(m.created_at) as last_message_time
            FROM messages m
            JOIN users u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
            WHERE m.sender_id = ? OR m.receiver_id = ?
            GROUP BY other_user_id, u.username, u.avatar, u.avatar_url
            ORDER BY last_message_time DESC`,
            [req.userId, req.userId, req.userId, req.userId]
        );
        
        res.json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;
        
        const [messages] = await pool.execute(
            'SELECT * FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at ASC',
            [req.userId, userId, userId, req.userId]
        );
        
        // Помечаем сообщения как прочитанные
        await pool.execute(
            'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
            [userId, req.userId]
        );
        
        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages', requireAuth, async (req, res) => {
    try {
        const { receiverId, content } = req.body;
        
        if (!receiverId || !content || !content.trim()) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }
        
        // Проверка на мут
        if (req.user.is_muted) {
            return res.status(403).json({ 
                error: `Вы замучены и не можете отправлять сообщения. Причина: ${req.user.mute_reason || 'Не указана'}.` 
            });
        }
        
        const messageId = generateId();
        await pool.execute(
            'INSERT INTO messages (id, sender_id, receiver_id, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [messageId, req.userId, receiverId, content.trim(), 0, new Date()]
        );
        
        res.json({ success: true, id: messageId });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/unread/count', requireAuth, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0',
            [req.userId]
        );
        
        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Get unread messages count error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== NOTIFICATIONS ENDPOINTS =====
app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const [notifications] = await pool.execute(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.userId]
        );
        
        res.json(notifications);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/notifications/unread/count', requireAuth, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.userId]
        );
        
        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Get unread notifications count error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark all notifications read error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== USER UPDATE =====
app.put('/api/users/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        if (id !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const updates = req.body;
        const allowedFields = ['username', 'email', 'roblox_nick', 'rod', 'discord', 'avatar', 'avatar_url'];
        const updateFields = [];
        const updateValues = [];
        
        // Если меняется roblox_nick, сбрасываем верификацию
        if (updates.robloxNick && updates.robloxNick !== req.user.roblox_nick) {
            updateFields.push('roblox_nick = ?', 'is_roblox_verified = ?');
            updateValues.push(updates.robloxNick, 0);
        } else if (updates.robloxNick) {
            updateFields.push('roblox_nick = ?');
            updateValues.push(updates.robloxNick);
        }
        
        if (updates.email) {
            updateFields.push('email = ?');
            updateValues.push(updates.email.toLowerCase());
        }
        
        if (updates.rod !== undefined) {
            updateFields.push('rod = ?');
            updateValues.push(updates.rod);
        }
        
        if (updates.discord !== undefined) {
            updateFields.push('discord = ?');
            updateValues.push(updates.discord);
        }
        
        if (updates.avatar) {
            updateFields.push('avatar = ?');
            updateValues.push(updates.avatar);
        }
        
        if (updates.avatar_url !== undefined) {
            updateFields.push('avatar_url = ?');
            updateValues.push(updates.avatar_url);
        }
        
        updateFields.push('updated_at = ?');
        updateValues.push(new Date());
        updateValues.push(id);
        
        if (updateFields.length > 1) {
            await pool.execute(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
        }
        
        // Получаем обновленного пользователя
        const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
        res.json(formatUser(users[0]));
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/online/list', async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, username, avatar, avatar_url, role FROM users WHERE is_online = 1 ORDER BY last_seen DESC LIMIT 50'
        );
        
        res.json(users);
    } catch (error) {
        console.error('Get online users error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN MIDDLEWARE =====
function requireAdmin(req, res, next) {
    const userLevel = getRoleLevel(req.user.role);
    if (userLevel < 1) { // Минимум хелпер
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    next();
}

// ===== ADMIN STATS =====
app.get('/api/admin/stats', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [postCount] = await pool.execute('SELECT COUNT(*) as total FROM posts');
        const [userCount] = await pool.execute('SELECT COUNT(*) as total FROM users');
        const [commentCount] = await pool.execute('SELECT COUNT(*) as total FROM comments');
        const [onlineCount] = await pool.execute('SELECT COUNT(*) as total FROM users WHERE is_online = 1');
        const [pendingPosts] = await pool.execute('SELECT COUNT(*) as total FROM posts WHERE status = ?', ['pending']);
        const [pendingApps] = await pool.execute('SELECT COUNT(*) as total FROM admin_applications WHERE status = ?', ['pending']);
        
        res.json({
            totalPosts: postCount[0].total,
            totalUsers: userCount[0].total,
            totalComments: commentCount[0].total,
            onlineUsers: onlineCount[0].total,
            pendingPosts: pendingPosts[0].total,
            pendingApplications: pendingApps[0].total
        });
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN USERS =====
app.get('/api/admin/users/list', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { search, role, limit = 50 } = req.query;
        let query = 'SELECT * FROM users WHERE 1=1';
        const params = [];
        
        if (search) {
            query += ' AND (username LIKE ? OR email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        if (role) {
            query += ' AND role = ?';
            params.push(role);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [users] = await pool.execute(query, params);
        res.json({ users: users.map(formatUser) });
    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users/search/:username', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username } = req.params;
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username LIKE ? LIMIT 1',
            [`%${username}%`]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(formatUser(users[0]));
    } catch (error) {
        console.error('Search user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/admin/users/:id/role', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        await pool.execute(
            'UPDATE users SET role = ?, updated_at = ? WHERE id = ?',
            [role, new Date(), id]
        );
        
        // Логируем
        await pool.execute(
            'INSERT INTO activity_log (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [generateId(), req.userId, 'change_role', `Изменена роль пользователя ${id} на ${role}`, new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Change user role error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:id/ban', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Причина бана обязательна' });
        }
        
        await pool.execute(
            'UPDATE users SET is_banned = 1, ban_reason = ?, updated_at = ? WHERE id = ?',
            [reason.trim(), new Date(), id]
        );
        
        // Логируем
        await pool.execute(
            'INSERT INTO activity_log (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [generateId(), req.userId, 'ban_user', `Забанен пользователь ${id}. Причина: ${reason}`, new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:id/unban', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'UPDATE users SET is_banned = 0, ban_reason = NULL, updated_at = ? WHERE id = ?',
            [new Date(), id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:id/mute', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, duration } = req.body;
        
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'Причина мута обязательна' });
        }
        
        let muteExpiresAt = null;
        if (duration && parseInt(duration) > 0) {
            muteExpiresAt = new Date(Date.now() + parseInt(duration) * 60 * 1000);
        }
        
        await pool.execute(
            'UPDATE users SET is_muted = 1, mute_reason = ?, mute_expires_at = ?, updated_at = ? WHERE id = ?',
            [reason.trim(), muteExpiresAt, new Date(), id]
        );
        
        // Логируем
        await pool.execute(
            'INSERT INTO activity_log (id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [generateId(), req.userId, 'mute_user', `Замучен пользователь ${id}. Причина: ${reason}`, new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mute user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users/:id/unmute', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        await pool.execute(
            'UPDATE users SET is_muted = 0, mute_reason = NULL, mute_expires_at = NULL, updated_at = ? WHERE id = ?',
            [new Date(), id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Unmute user error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Удаляем связанные данные
        await pool.execute('DELETE FROM comments WHERE author_id = ?', [id]);
        await pool.execute('DELETE FROM posts WHERE author_id = ?', [id]);
        await pool.execute('DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?', [id, id]);
        await pool.execute('DELETE FROM notifications WHERE user_id = ?', [id]);
        await pool.execute('DELETE FROM favorites WHERE user_id = ?', [id]);
        
        // Удаляем пользователя
        await pool.execute('DELETE FROM users WHERE id = ?', [id]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN POSTS =====
app.get('/api/admin/posts', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status, category, limit = 50 } = req.query;
        let query = 'SELECT p.*, u.username as author_username FROM posts p LEFT JOIN users u ON p.author_id = u.id WHERE 1=1';
        const params = [];
        
        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }
        if (category) {
            query += ' AND p.category = ?';
            params.push(category);
        }
        
        query += ' ORDER BY p.created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        
        const [posts] = await pool.execute(query, params);
        res.json({ posts });
    } catch (error) {
        console.error('Get admin posts error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/posts/:id/pin', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await pool.execute('SELECT is_pinned FROM posts WHERE id = ?', [id]);
        
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const newPinned = !posts[0].is_pinned;
        await pool.execute('UPDATE posts SET is_pinned = ? WHERE id = ?', [newPinned ? 1 : 0, id]);
        
        res.json({ pinned: newPinned });
    } catch (error) {
        console.error('Toggle pin error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/posts/:id/hot', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const [posts] = await pool.execute('SELECT is_hot FROM posts WHERE id = ?', [id]);
        
        if (posts.length === 0) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const newHot = !posts[0].is_hot;
        await pool.execute('UPDATE posts SET is_hot = ? WHERE id = ?', [newHot ? 1 : 0, id]);
        
        res.json({ hot: newHot });
    } catch (error) {
        console.error('Toggle hot error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN APPLICATIONS =====
app.get('/api/admin/applications', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT a.*, u.username, u.avatar, u.avatar_url FROM admin_applications a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1';
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND a.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY a.created_at DESC';
        
        const [applications] = await pool.execute(query, params);
        res.json(applications);
    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/applications/count', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'SELECT COUNT(*) as count FROM admin_applications WHERE status = ?',
            ['pending']
        );
        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Get applications count error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/applications/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        
        const [apps] = await pool.execute('SELECT * FROM admin_applications WHERE id = ?', [id]);
        if (apps.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const app = apps[0];
        
        // Назначаем роль
        await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, app.user_id]);
        
        // Обновляем статус заявки
        await pool.execute('UPDATE admin_applications SET status = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
            ['approved', req.userId, new Date(), id]);
        
        // Создаем уведомление
        await pool.execute(
            'INSERT INTO notifications (id, user_id, type, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), app.user_id, 'application_approved', `Ваша заявка на роль одобрена!`, '#profile', new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Approve application error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/applications/:id/reject', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const [apps] = await pool.execute('SELECT * FROM admin_applications WHERE id = ?', [id]);
        if (apps.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        
        const app = apps[0];
        
        // Обновляем статус заявки
        await pool.execute('UPDATE admin_applications SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?',
            ['rejected', reason || null, req.userId, new Date(), id]);
        
        // Создаем уведомление
        await pool.execute(
            'INSERT INTO notifications (id, user_id, type, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), app.user_id, 'application_rejected', 
                reason ? `Ваша заявка отклонена. Причина: ${reason}` : 'Ваша заявка отклонена.', 
                '#profile', new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reject application error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN VERIFICATIONS =====
app.get('/api/admin/verifications', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { status } = req.query;
        let query = 'SELECT v.*, u.username, u.avatar, u.avatar_url FROM roblox_verifications v LEFT JOIN users u ON v.user_id = u.id WHERE 1=1';
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND v.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY v.created_at DESC';
        
        const [verifications] = await pool.execute(query, params);
        res.json(verifications);
    } catch (error) {
        console.error('Get verifications error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/verifications/count', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'SELECT COUNT(*) as count FROM roblox_verifications WHERE status = ?',
            ['pending']
        );
        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Get verifications count error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/verifications/:id/approve', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const [vers] = await pool.execute('SELECT * FROM roblox_verifications WHERE id = ?', [id]);
        if (vers.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        
        const ver = vers[0];
        
        // Обновляем статус верификации
        await pool.execute('UPDATE roblox_verifications SET status = ? WHERE id = ?', ['approved', id]);
        
        // Верифицируем пользователя
        await pool.execute('UPDATE users SET is_roblox_verified = 1 WHERE id = ?', [ver.user_id]);
        
        // Создаем уведомление
        await pool.execute(
            'INSERT INTO notifications (id, user_id, type, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), ver.user_id, 'verification_approved', 
                `Ваша верификация Roblox для ника "${ver.roblox_nick}" была одобрена!`, 
                '#profile', new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Approve verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/verifications/:id/reject', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const [vers] = await pool.execute('SELECT * FROM roblox_verifications WHERE id = ?', [id]);
        if (vers.length === 0) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        
        const ver = vers[0];
        
        // Обновляем статус верификации
        await pool.execute('UPDATE roblox_verifications SET status = ?, reject_reason = ? WHERE id = ?',
            ['rejected', reason || null, id]);
        
        // Создаем уведомление
        await pool.execute(
            'INSERT INTO notifications (id, user_id, type, message, link, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [generateId(), ver.user_id, 'verification_rejected', 
                reason 
                    ? `Ваша верификация Roblox для ника "${ver.roblox_nick}" была отклонена. Причина: ${reason}`
                    : `Ваша верификация Roblox для ника "${ver.roblox_nick}" была отклонена.`, 
                '#profile', new Date()]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reject verification error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ===== ADMIN ROLES =====
app.get('/api/admin/roles', requireAuth, requireAdmin, async (req, res) => {
    const roles = [
        { id: 'user', name: 'Пользователь', level: 0 },
        { id: 'helper', name: 'Хелпер', level: 1 },
        { id: 'moderator', name: 'Модератор', level: 2 },
        { id: 'admin', name: 'Администратор', level: 3 },
        { id: 'senior_admin', name: 'Старший администратор', level: 3.5 },
        { id: 'manager', name: 'Менеджер', level: 4 },
        { id: 'management', name: 'Руководство', level: 5 }
    ];
    res.json(roles);
});

// Заглушки для остальных API (будут реализованы постепенно)
app.get('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

app.post('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

app.put('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not implemented yet' });
});

app.delete('/api/*', (req, res) => {
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

