
// ===== COOKIES HELPER =====
const Cookies = {
    set(name, value, days = 30) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
    },
    
    get(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    },
    
    remove(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    },
    
    exists(name) {
        return this.get(name) !== null;
    }
};

// ===== DATABASE (LocalStorage) =====
const DB = {
    // Simple password hash (for client-side only, not secure for production)
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    },
    
    comparePassword(password, hash) {
        return this.hashPassword(password) === hash;
    },
    
    init() {
        const dbKey = 'forum_db';
        if (!localStorage.getItem(dbKey)) {
            const db = {
                users: [],
                posts: [],
                comments: [],
                messages: [],
                notifications: [],
                favorites: [],
                reputation: [],
                activity_log: [],
                admin_applications: [],
                roblox_verifications: []
            };
            
            // Create default admin user
            const adminId = this.generateId();
            const now = new Date().toISOString();
            db.users.push({
                id: adminId,
                username: 'Admin',
                email: 'admin@unfilteredrp.com',
                password: this.hashPassword('admin123'),
                roblox_nick: 'AdminRP',
                avatar: '👑',
                avatar_url: null,
                role: 'management',
                reputation: 0,
                is_verified: true,
                is_email_verified: true,
                is_roblox_verified: false,
                is_banned: false,
                ban_reason: null,
                roblox_user_id: null,
                email_code: null,
                email_code_expires: null,
                is_online: false,
                last_seen: now,
                created_at: now,
                updated_at: now
            });
            
            localStorage.setItem(dbKey, JSON.stringify(db));
        }
    },
    
    getDB() {
        const dbKey = 'forum_db';
        const data = localStorage.getItem(dbKey);
        return data ? JSON.parse(data) : null;
    },
    
    saveDB(db) {
        localStorage.setItem('forum_db', JSON.stringify(db));
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    get(table, id) {
        const db = this.getDB();
        if (!db || !db[table]) return null;
        return db[table].find(item => item.id === id);
    },
    
    getAll(table, filter = null) {
        const db = this.getDB();
        if (!db || !db[table]) return [];
        let items = db[table];
        if (filter) {
            items = items.filter(filter);
        }
        return items;
    },
    
    insert(table, data) {
        const db = this.getDB();
        if (!db || !db[table]) return null;
        const id = this.generateId();
        const item = { ...data, id };
        db[table].push(item);
        this.saveDB(db);
        return item;
    },
    
    update(table, id, updates) {
        const db = this.getDB();
        if (!db || !db[table]) return null;
        const index = db[table].findIndex(item => item.id === id);
        if (index === -1) return null;
        db[table][index] = { ...db[table][index], ...updates, updated_at: new Date().toISOString() };
        this.saveDB(db);
        return db[table][index];
    },
    
    delete(table, id) {
        const db = this.getDB();
        if (!db || !db[table]) return false;
        const index = db[table].findIndex(item => item.id === id);
        if (index === -1) return false;
        db[table].splice(index, 1);
        this.saveDB(db);
        return true;
    }
};

// Initialize database
DB.init();

// Role definitions
const ROLES_INFO = {
    'user': { level: 0, name: 'Пользователь', icon: 'fa-user', color: '#60a5fa' },
    'helper': { level: 1, name: 'Хелпер', icon: 'fa-hands-helping', color: '#22c55e' },
    'moderator': { level: 2, name: 'Модератор', icon: 'fa-shield-alt', color: '#a855f7' },
    'admin': { level: 3, name: 'Администратор', icon: 'fa-crown', color: '#f59e0b' },
    'senior_admin': { level: 3.5, name: 'Старший администратор', icon: 'fa-crown', color: '#8b5cf6' },
    'manager': { level: 4, name: 'Менеджер проекта', icon: 'fa-briefcase', color: '#ffffff' },
    'management': { level: 5, name: 'Руководство', icon: 'fa-star', color: '#ef4444' }
};

// ===== API HELPER (LocalStorage version) =====
const api = {
    token: localStorage.getItem('urp_token'),
    
    // Настройки API (можно изменить через localStorage)
    get useRealServer() {
        // По умолчанию false (локальный режим), можно включить через localStorage
        return localStorage.getItem('useRealServer') === 'true';
    },
    
    get apiBaseUrl() {
        // Можно настроить через localStorage, по умолчанию текущий домен
        return localStorage.getItem('apiBaseUrl') || window.location.origin;
    },
    
    async request(endpoint, options = {}) {
        // Если включен реальный сервер, используем HTTP запросы
        if (this.useRealServer) {
            return this.realServerRequest(endpoint, options);
        }
        
        // Иначе используем локальный режим (старая логика)
        return this.localRequest(endpoint, options);
    },
    
    // Реальные HTTP запросы к серверу
    async realServerRequest(endpoint, options = {}) {
        const method = options.method || 'GET';
        const url = `${this.apiBaseUrl}${endpoint}`;
        
        try {
            const fetchOptions = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            };
            
            // Добавляем токен авторизации, если есть
            if (this.token) {
                fetchOptions.headers['Authorization'] = `Bearer ${this.token}`;
            }
            
            // Добавляем тело запроса
            if (options.body) {
                fetchOptions.body = options.body;
            }
            
            const response = await fetch(url, fetchOptions);
            
            // Проверяем статус ответа
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // Если ответ не JSON, используем статус
                }
                throw new Error(errorMessage);
            }
            
            // Парсим JSON ответ
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    },
    
    // Локальный режим (старая логика для обратной совместимости)
    async localRequest(endpoint, options = {}) {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 0));
        
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : null;
        const url = new URL(endpoint, 'http://localhost');
        
        try {
            // Route handling
            if (endpoint.startsWith('/auth/login') && method === 'POST') {
                return this.handleLogin(body);
            } else if (endpoint.startsWith('/api/auth/register') && method === 'POST') {
                return this.handleRegister(body);
            } else if (endpoint.startsWith('/api/auth/logout') && method === 'POST') {
                return this.handleLogout();
            } else if (endpoint.startsWith('/auth/me') && method === 'GET') {
                return this.handleGetMe();
            } else if (endpoint.startsWith('/auth/email-code') && method === 'GET') {
                return this.handleGetEmailCode();
            } else if (endpoint.startsWith('/auth/verify-email') && method === 'POST') {
                return this.handleVerifyEmail(body);
            } else if (endpoint.startsWith('/auth/resend-email-code') && method === 'POST') {
                return this.handleResendEmailCode();
            } else if (endpoint.startsWith('/auth/verify-roblox-userid') && method === 'POST') {
                return this.handleVerifyRobloxByUserId(body);
            } else if (endpoint.startsWith('/posts') && method === 'GET') {
                if (endpoint.includes('/comments')) {
                    const postId = endpoint.split('/posts/')[1].split('/')[0];
                    return this.handleGetPostComments(postId);
                }
                if (endpoint.match(/^\/posts\/[^/]+$/)) {
                    const postId = endpoint.split('/posts/')[1].split('?')[0];
                    return this.handleGetPost(postId);
                }
                return this.handleGetPosts(url);
            } else if (endpoint.startsWith('/api/posts/') && method === 'GET') {
                const postId = endpoint.split('/api/posts/')[1].split('?')[0].split('/')[0];
                if (endpoint.includes('/comments')) {
                    return this.handleGetPostComments(postId);
                }
                return this.handleGetPost(postId);
            } else if (endpoint.startsWith('/posts') && method === 'POST') {
                if (endpoint.includes('/comments')) {
                    const postId = endpoint.split('/posts/')[1].split('/')[0];
                    return this.handleCreateComment(postId, body);
                }
                return this.handleCreatePost(body);
            } else if (endpoint.startsWith('/posts/') && method === 'DELETE') {
                const postId = endpoint.split('/posts/')[1];
                return this.handleDeletePost(postId);
            } else if (endpoint.startsWith('/posts/') && method === 'PUT' && endpoint.includes('/status')) {
                const postId = endpoint.split('/posts/')[1].split('/')[0];
                return this.handleUpdatePostStatus(postId, body);
            } else if (endpoint.startsWith('/posts/') && method === 'POST' && endpoint.includes('/comments')) {
                const postId = endpoint.split('/posts/')[1].split('/')[0];
                return this.handleCreateComment(postId, body);
            } else if (endpoint.startsWith('/favorites') && method === 'GET') {
                return this.handleGetFavorites();
            } else if (endpoint.startsWith('/favorites/') && method === 'POST') {
                const postId = endpoint.split('/favorites/')[1];
                return this.handleToggleFavorite(postId, true);
            } else if (endpoint.startsWith('/favorites/') && method === 'DELETE') {
                const postId = endpoint.split('/favorites/')[1];
                return this.handleToggleFavorite(postId, false);
            } else if (endpoint.startsWith('/messages') && method === 'GET') {
                if (endpoint.includes('/unread/count')) {
                    return this.handleGetUnreadMessagesCount();
                }
                const userId = endpoint.split('/messages/')[1];
                if (userId) {
                    return this.handleGetMessages(userId);
                }
                return this.handleGetConversations();
            } else if (endpoint.startsWith('/messages') && method === 'POST') {
                return this.handleSendMessage(body);
            } else if (endpoint.startsWith('/notifications') && method === 'GET') {
                if (endpoint.includes('/unread/count')) {
                    return this.handleGetUnreadNotificationsCount();
                }
                return this.handleGetNotifications();
            } else if (endpoint.startsWith('/notifications/') && method === 'PUT' && endpoint.includes('/read')) {
                if (endpoint.includes('/read-all')) {
                    return this.handleMarkAllNotificationsRead();
                }
                const notifId = endpoint.split('/notifications/')[1].split('/')[0];
                return this.handleMarkNotificationRead(notifId);
            } else if (endpoint.startsWith('/reputation') && method === 'POST') {
                return this.handleToggleReputation(body);
            } else if (endpoint.startsWith('/users/') && method === 'GET') {
                const userId = endpoint.split('/users/')[1].split('?')[0].split('/')[0];
                if (endpoint.includes('/posts')) {
                    return this.handleGetUserPosts(userId);
                }
                return this.handleGetUser(userId);
            } else if (endpoint.startsWith('/users/') && method === 'PUT') {
                const userId = endpoint.split('/users/')[1];
                return this.handleUpdateUser(userId, body);
            } else if (endpoint.startsWith('/users/') && endpoint.includes('/delete-account') && method === 'POST') {
                const userId = endpoint.split('/users/')[1].split('/')[0];
                return this.handleDeleteOwnAccount(userId, body);
            } else if (endpoint.startsWith('/users/online/list') && method === 'GET') {
                return this.handleGetOnlineUsers();
            } else if (endpoint.startsWith('/users/avatar/upload') && method === 'POST') {
                return this.handleUploadAvatar(body);
            } else if (endpoint.startsWith('/stats') && method === 'GET') {
                return this.handleGetStats();
            } else if (endpoint.startsWith('/admin/stats') && method === 'GET') {
                return this.handleGetAdminStats();
            } else if (endpoint.startsWith('/admin/users') && method === 'GET') {
                if (endpoint.includes('/search/')) {
                    const username = endpoint.split('/admin/users/search/')[1];
                    return this.handleSearchUser(username);
                }
                if (endpoint.includes('/list')) {
                    return this.handleGetAdminUsers(url);
                }
                return this.handleGetAdminUsers(url);
            } else if (endpoint.startsWith('/admin/users/') && method === 'PUT' && endpoint.includes('/role')) {
                const userId = endpoint.split('/admin/users/')[1].split('/')[0];
                return this.handleChangeUserRole(userId, body);
            } else if (endpoint.startsWith('/admin/users/') && method === 'POST' && endpoint.includes('/ban')) {
                const userId = endpoint.split('/admin/users/')[1].split('/')[0];
                return this.handleBanUser(userId, body);
            } else if (endpoint.startsWith('/admin/users/') && method === 'POST' && endpoint.includes('/unban')) {
                const userId = endpoint.split('/admin/users/')[1].split('/')[0];
                return this.handleUnbanUser(userId);
            } else if (endpoint.startsWith('/admin/users/') && method === 'POST' && endpoint.includes('/mute')) {
                const userId = endpoint.split('/admin/users/')[1].split('/')[0];
                return this.handleMuteUser(userId, body);
            } else if (endpoint.startsWith('/admin/users/') && method === 'POST' && endpoint.includes('/unmute')) {
                const userId = endpoint.split('/admin/users/')[1].split('/')[0];
                return this.handleUnmuteUser(userId);
            } else if (endpoint.startsWith('/admin/users/') && method === 'DELETE') {
                const userId = endpoint.split('/admin/users/')[1];
                return this.handleDeleteUser(userId);
            } else if (endpoint.startsWith('/admin/posts') && method === 'GET') {
                return this.handleGetAdminPosts(url);
            } else if (endpoint.startsWith('/admin/posts/') && method === 'POST' && endpoint.includes('/pin')) {
                const postId = endpoint.split('/admin/posts/')[1].split('/')[0];
                return this.handleTogglePinPost(postId);
            } else if (endpoint.startsWith('/admin/posts/') && method === 'POST' && endpoint.includes('/hot')) {
                const postId = endpoint.split('/admin/posts/')[1].split('/')[0];
                return this.handleToggleHotPost(postId);
            } else if (endpoint.startsWith('/admin/activity') && method === 'GET') {
                return this.handleGetAdminActivity(url);
            } else if (endpoint.startsWith('/admin/applications') && method === 'GET') {
                if (endpoint.includes('/count')) {
                    return this.handleGetApplicationsCount();
                }
                return this.handleGetAdminApplications(url);
            } else if (endpoint.startsWith('/admin/applications/') && method === 'POST' && endpoint.includes('/approve')) {
                const appId = endpoint.split('/admin/applications/')[1].split('/')[0];
                return this.handleApproveApplication(appId, body);
            } else if (endpoint.startsWith('/admin/applications/') && method === 'POST' && endpoint.includes('/reject')) {
                const appId = endpoint.split('/admin/applications/')[1].split('/')[0];
                return this.handleRejectApplication(appId, body);
            } else if (endpoint.startsWith('/admin/roles') && method === 'GET') {
                return Object.entries(ROLES_INFO).map(([id, info]) => ({
                    id,
                    ...info
                }));
            } else if (endpoint.startsWith('/admin-applications') && method === 'POST') {
                return this.handleCreateApplication(body);
            } else if (endpoint.startsWith('/admin/verifications') && method === 'GET') {
                if (endpoint.includes('/count')) {
                    return this.handleGetVerificationsCount();
                }
                return this.handleGetAdminVerifications(url);
            } else if (endpoint.startsWith('/admin/verifications/') && method === 'POST' && endpoint.includes('/approve')) {
                const verId = endpoint.split('/admin/verifications/')[1].split('/')[0];
                return this.handleApproveVerification(verId);
            } else if (endpoint.startsWith('/admin/verifications/') && method === 'POST' && endpoint.includes('/reject')) {
                const verId = endpoint.split('/admin/verifications/')[1].split('/')[0];
                return this.handleRejectVerification(verId, body);
            }
            
            throw new Error('Endpoint not found');
        } catch (error) {
            throw error;
        }
    },
    
    // Auth handlers
    handleLogin({ username, password }) {
        const users = DB.getAll('users');
        const user = users.find(u => u.username === username);
        if (!user || !DB.comparePassword(password, user.password)) {
            throw new Error('Неверное имя пользователя или пароль');
        }
        if (user.is_banned) {
            throw new Error(user.ban_reason || 'Ваш аккаунт заблокирован');
        }
        
        const now = new Date().toISOString();
        DB.update('users', user.id, { is_online: true, last_seen: now });
        DB.insert('activity_log', { user_id: user.id, action: 'login', details: 'Вход в аккаунт' });
        
        const token = 'token_' + user.id;
        this.setToken(token);
        
        return {
            token,
            user: this.formatUser(user)
        };
    },
    
    handleRegister({ username, email, password, robloxNick, rod }) {
        if (!username || !email || !password || !robloxNick || !rod) {
            throw new Error('Заполните все поля');
        }
        if (username.length < 3 || username.length > 20) {
            throw new Error('Имя пользователя должно быть от 3 до 20 символов');
        }
        if (password.length < 6) {
            throw new Error('Пароль должен быть минимум 6 символов');
        }
        
        email = email.toLowerCase().trim();
        const users = DB.getAll('users');
        if (users.find(u => u.username === username || u.email === email)) {
            throw new Error('Пользователь с таким именем или email уже существует');
        }
        
        const avatars = ['🎮', '🎯', '⚡', '🔥', '💡', '🚀', '🎪', '🎨', '🎭', '🎸', '🎹', '🎺', '🌟', '💎', '🦊', '🐺', '🦁', '🐯', '🎲', '🏆', '👑', '🎖️', '🛡️', '⚔️'];
        const randomAvatar = avatars[Math.floor(Math.random() * avatars.length)];
        const now = new Date().toISOString();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const user = DB.insert('users', {
            username,
            email,
            password: DB.hashPassword(password),
            roblox_nick: robloxNick,
            rod: rod.trim(),
            avatar: randomAvatar,
            avatar_url: null,
            role: 'user',
            reputation: 0,
            is_verified: false,
            is_email_verified: false,
            is_roblox_verified: false,
            is_banned: false,
            ban_reason: null,
            roblox_user_id: null,
            email_code: emailCode,
            email_code_expires: codeExpires,
            is_online: true,
            last_seen: now,
            created_at: now,
            updated_at: now
        });
        
        DB.insert('activity_log', { user_id: user.id, action: 'register', details: 'Регистрация нового пользователя' });
        
        const token = 'token_' + user.id;
        this.setToken(token);
        
        return {
            token,
            user: this.formatUser(user),
            emailCode: emailCode // Код для отображения на экране
        };
    },
    
    handleLogout() {
        const userId = this.getUserId();
        if (userId) {
            DB.update('users', userId, { is_online: false, last_seen: new Date().toISOString() });
        }
        this.setToken(null);
        return { success: true };
    },
    
    handleGetMe() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        return this.formatUser(user);
    },
    
    handleGetEmailCode() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        
        // Генерируем новый код, если его нет или истёк
        if (!user.email_code || (user.email_code_expires && new Date(user.email_code_expires) < new Date())) {
            const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
            const codeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            DB.update('users', userId, { email_code: emailCode, email_code_expires: codeExpires });
            user.email_code = emailCode;
            user.email_code_expires = codeExpires;
        }
        
        return { 
            email: user.email,
            code: user.email_code 
        };
    },
    
    handleVerifyEmail({ code }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        if (user.email_code !== code) {
            throw new Error('Неверный код');
        }
        DB.update('users', userId, { is_email_verified: true, email_code: null, email_code_expires: null });
        return { success: true };
    },
    
    handleResendEmailCode() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const codeExpires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        DB.update('users', userId, { email_code: emailCode, email_code_expires: codeExpires });
        
        return { code: emailCode };
    },
    
    handleVerifyRobloxByUserId({ robloxUserId }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        
        // Проверяем формат User ID (должен быть числом)
        if (!robloxUserId || !/^\d+$/.test(robloxUserId.toString())) {
            throw new Error('User ID должен быть числом');
        }
        
        // Проверяем, есть ли уже активная заявка на верификацию
        const existing = DB.getAll('roblox_verifications', v => v.user_id === userId && v.status === 'pending');
        if (existing.length > 0) {
            throw new Error('У вас уже есть заявка на верификацию, ожидающая рассмотрения');
        }
        
        // Сохраняем User ID (но не верифицируем автоматически)
        DB.update('users', userId, { 
            roblox_user_id: robloxUserId.toString()
        });
        
        // Создаем заявку на верификацию
        DB.insert('roblox_verifications', {
            user_id: userId,
            roblox_nick: user.roblox_nick,
            roblox_user_id: robloxUserId.toString(),
            status: 'pending',
            created_at: new Date().toISOString()
        });
        
        return { success: true };
    },
    
    // User handlers
    handleGetUser(userId) {
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        const postsCount = DB.getAll('posts', p => p.author_id === userId).length;
        const commentsCount = DB.getAll('comments', c => c.author_id === userId).length;
        const viewsSum = DB.getAll('posts', p => p.author_id === userId).reduce((sum, p) => sum + (p.views || 0), 0);
        return { ...this.formatUser(user), postsCount, commentsCount, viewsSum };
    },
    
    handleGetUserPosts(userId) {
        return DB.getAll('posts', p => p.author_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    
    handleUpdateUser(userId, updates) {
        const currentUserId = this.getUserId();
        if (currentUserId !== userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (!user) throw new Error('User not found');
        
        const changes = {};
        if (updates.username && updates.username !== user.username) {
            if (updates.username.length < 3 || updates.username.length > 20) {
                throw new Error('Имя пользователя должно быть от 3 до 20 символов');
            }
            const existing = DB.getAll('users', u => u.username === updates.username && u.id !== userId);
            if (existing.length > 0) throw new Error('Имя пользователя уже используется');
            changes.username = updates.username;
        }
        if (updates.robloxNick && updates.robloxNick !== user.roblox_nick) {
            changes.roblox_nick = updates.robloxNick;
            // При смене ника Roblox верификация сбрасывается
            changes.is_roblox_verified = false;
        }
        if (updates.discord !== undefined) changes.discord = updates.discord || null;
        if (updates.rod !== undefined) changes.rod = updates.rod ? updates.rod.trim() : null;
        if (updates.email && updates.email !== user.email) {
            const existing = DB.getAll('users', u => u.email === updates.email && u.id !== userId);
            if (existing.length > 0) throw new Error('Email уже используется');
            changes.email = updates.email;
            changes.is_email_verified = false;
        }
        if (updates.avatar) changes.avatar = updates.avatar;
        if (updates.newPassword) {
            if (!updates.currentPassword || !DB.comparePassword(updates.currentPassword, user.password)) {
                throw new Error('Неверный текущий пароль');
            }
            if (updates.newPassword.length < 6) {
                throw new Error('Новый пароль должен быть минимум 6 символов');
            }
            changes.password = DB.hashPassword(updates.newPassword);
        }
        
        changes.updated_at = new Date().toISOString();
        DB.update('users', userId, changes);
        DB.insert('activity_log', { user_id: userId, action: 'profile_update', details: 'Обновление профиля' });
        return this.formatUser(DB.get('users', userId));
    },
    
    handleUploadAvatar({ file }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        // file is already a data URL string from uploadFile
        DB.update('users', userId, { avatar_url: file, avatar: null });
        return { avatar_url: file, avatarUrl: file }; // Support both property names
    },
    
    handleGetOnlineUsers() {
        const users = DB.getAll('users', u => u.is_online && !u.is_banned);
        return users.map(u => ({
            id: u.id,
            username: u.username,
            avatar: u.avatar,
            avatar_url: u.avatar_url,
            role: u.role,
            roleInfo: ROLES_INFO[u.role]
        }));
    },
    
    // Post handlers
    handleGetPosts(url) {
        const params = new URLSearchParams(url.search);
        const category = params.get('category') || 'all';
        const search = params.get('search') || '';
        const sort = params.get('sort') || 'newest';
        const page = parseInt(params.get('page') || '1');
        const limit = parseInt(params.get('limit') || '10');
        
        let posts = DB.getAll('posts');
        
        if (category !== 'all') {
            posts = posts.filter(p => p.category === category);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            posts = posts.filter(p => 
                p.title.toLowerCase().includes(searchLower) || 
                p.content.toLowerCase().includes(searchLower)
            );
        }
        
        if (sort === 'newest') {
            posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sort === 'popular') {
            posts.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (sort === 'comments') {
            const commentCounts = {};
            DB.getAll('comments').forEach(c => {
                commentCounts[c.post_id] = (commentCounts[c.post_id] || 0) + 1;
            });
            posts.sort((a, b) => (commentCounts[b.id] || 0) - (commentCounts[a.id] || 0));
        }
        
        const total = posts.length;
        const start = (page - 1) * limit;
        posts = posts.slice(start, start + limit);
        
        posts = posts.map(p => this.formatPost(p));
        
        return { posts, total };
    },
    
    handleGetPost(postId) {
        const post = DB.get('posts', postId);
        if (!post) throw new Error('Post not found');
        DB.update('posts', postId, { views: (post.views || 0) + 1 });
        return this.formatPost(DB.get('posts', postId));
    },
    
    handleGetPostComments(postId) {
        return DB.getAll('comments', c => c.post_id === postId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map(c => this.formatComment(c));
    },
    
    handleCreatePost(data) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (user && user.is_muted) {
            throw new Error(`Вы замьючены. Причина: ${user.mute_reason || 'Нарушение правил'}`);
        }
        const category = categoryMap[data.category] || data.category;
        const now = new Date().toISOString();
        
        let title = '';
        let content = '';
        let extraData = {};
        
        if (data.category === 'complaint') {
            title = `Жалоба на ${data.violatorNick}`;
            content = `Правило: ${data.violationRule}\n\n${data.violationDesc}\n\nДоказательства: ${data.proofLink}`;
            extraData = { violatorNick: data.violatorNick, violationRule: data.violationRule, violationDate: data.violationDate, proofLink: data.proofLink };
        } else if (data.category === 'appeal') {
            title = `Апелляция бана - ${data.appealNick}`;
            content = data.appealReason;
            extraData = { appealNick: data.appealNick, adminNick: data.adminNick, punishmentType: data.punishmentType, banReason: data.banReason };
        } else if (data.category === 'question') {
            title = data.questionTitle || 'Вопрос';
            content = data.questionText;
            extraData = { questionCategory: data.questionCategory };
        } else if (data.category === 'suggestion') {
            title = data.suggestionTitle || 'Предложение';
            content = data.suggestionText;
            extraData = { suggestionCategory: data.suggestionCategory };
        }
        
        const post = DB.insert('posts', {
            category,
            title,
            content,
            extra_data: JSON.stringify(extraData),
            author_id: userId,
            views: 0,
            is_pinned: false,
            is_hot: false,
            status: 'open',
            status_text: 'Открыто',
            created_at: now,
            updated_at: now
        });
        
        DB.insert('activity_log', { user_id: userId, action: 'post_create', details: `Создана тема: ${title}` });
        return this.formatPost(post);
    },
    
    handleDeletePost(postId) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const post = DB.get('posts', postId);
        if (!post) throw new Error('Post not found');
        if (post.author_id !== userId) {
            const user = DB.get('users', userId);
            if (!user) throw new Error('Unauthorized');
            const userLevel = ROLES_INFO[user.role]?.level || 0;
            // Могут удалять: админ (3), модератор (2), ст.админ (3.5), менеджер (4), руководство (5)
            // Хелпер (1) не может
            if (userLevel < 2) {
                throw new Error('Ранг не доступен. Удалять темы могут только модераторы и выше.');
            }
        }
        DB.delete('posts', postId);
        DB.getAll('comments', c => c.post_id === postId).forEach(c => DB.delete('comments', c.id));
        DB.insert('activity_log', { user_id: userId, action: 'post_delete', details: `Удалена тема: ${post.title}` });
        return { success: true };
    },
    
    handleUpdatePostStatus(postId, { status, statusText }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        DB.update('posts', postId, { status, status_text: statusText || status });
        return { success: true };
    },
    
    handleCreateComment(postId, { text }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const user = DB.get('users', userId);
        if (user && user.is_muted) {
            throw new Error(`Вы замьючены. Причина: ${user.mute_reason || 'Нарушение правил'}`);
        }
        const now = new Date().toISOString();
        const comment = DB.insert('comments', {
            post_id: postId,
            author_id: userId,
            text,
            is_admin_action: false,
            created_at: now
        });
        
        const post = DB.get('posts', postId);
        if (post && post.author_id !== userId) {
            DB.insert('notifications', {
                user_id: post.author_id,
                type: 'comment',
                title: 'Новый комментарий',
                message: `${this.getCurrentUser().username} оставил комментарий к вашей теме "${post.title}"`,
                link: `#post-${postId}`,
                is_read: false,
                created_at: now
            });
        }
        
        return this.formatComment(comment);
    },
    
    // Favorite handlers
    handleGetFavorites() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const favorites = DB.getAll('favorites', f => f.user_id === userId);
        const posts = favorites.map(f => {
            const post = DB.get('posts', f.post_id);
            return post ? this.formatPost(post) : null;
        }).filter(p => p !== null);
        return posts;
    },
    
    handleToggleFavorite(postId, add) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const existing = DB.getAll('favorites', f => f.user_id === userId && f.post_id === postId);
        if (add && existing.length === 0) {
            DB.insert('favorites', { user_id: userId, post_id: postId, created_at: new Date().toISOString() });
        } else if (!add && existing.length > 0) {
            DB.delete('favorites', existing[0].id);
        }
        return { success: true };
    },
    
    // Message handlers
    handleGetConversations() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const messages = DB.getAll('messages', m => m.sender_id === userId || m.receiver_id === userId);
        const userIds = new Set();
        messages.forEach(m => {
            if (m.sender_id !== userId) userIds.add(m.sender_id);
            if (m.receiver_id !== userId) userIds.add(m.receiver_id);
        });
        
        const conversations = Array.from(userIds).map(id => {
            const user = DB.get('users', id);
            const userMessages = messages.filter(m => (m.sender_id === userId && m.receiver_id === id) || (m.sender_id === id && m.receiver_id === userId));
            const lastMessage = userMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
            const unreadCount = userMessages.filter(m => m.receiver_id === userId && !m.is_read).length;
            return {
                user: this.formatUser(user),
                lastMessage: lastMessage ? this.formatMessage(lastMessage) : null,
                unreadCount
            };
        });
        
        return conversations.sort((a, b) => {
            if (!a.lastMessage) return 1;
            if (!b.lastMessage) return -1;
            return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
        });
    },
    
    handleGetMessages(userId) {
        const currentUserId = this.getUserId();
        if (!currentUserId) throw new Error('Unauthorized');
        const messages = DB.getAll('messages', m => 
            (m.sender_id === currentUserId && m.receiver_id === userId) ||
            (m.sender_id === userId && m.receiver_id === currentUserId)
        ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        
        // Mark as read
        messages.filter(m => m.receiver_id === currentUserId && !m.is_read).forEach(m => {
            DB.update('messages', m.id, { is_read: true });
        });
        
        return messages.map(m => this.formatMessage(m));
    },
    
    handleSendMessage({ receiverId, content }) {
        const senderId = this.getUserId();
        if (!senderId) throw new Error('Unauthorized');
        const user = DB.get('users', senderId);
        if (user && user.is_muted) {
            throw new Error(`Вы замьючены. Причина: ${user.mute_reason || 'Нарушение правил'}`);
        }
        const now = new Date().toISOString();
        const message = DB.insert('messages', {
            sender_id: senderId,
            receiver_id: receiverId,
            content,
            is_read: false,
            created_at: now
        });
        
        const receiver = DB.get('users', receiverId);
        const sender = DB.get('users', senderId);
        if (receiver) {
            DB.insert('notifications', {
                user_id: receiverId,
                type: 'message',
                title: 'Новое сообщение',
                message: `${sender.username} отправил вам сообщение`,
                link: '#messages',
                is_read: false,
                created_at: now
            });
        }
        
        return this.formatMessage(message);
    },
    
    handleGetUnreadMessagesCount() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const count = DB.getAll('messages', m => m.receiver_id === userId && !m.is_read).length;
        return { count };
    },
    
    // Notification handlers
    handleGetNotifications() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        return DB.getAll('notifications', n => n.user_id === userId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(n => this.formatNotification(n));
    },
    
    handleMarkNotificationRead(notifId) {
        DB.update('notifications', notifId, { is_read: true });
        return { success: true };
    },
    
    handleMarkAllNotificationsRead() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        DB.getAll('notifications', n => n.user_id === userId && !n.is_read).forEach(n => {
            DB.update('notifications', n.id, { is_read: true });
        });
        return { success: true };
    },
    
    handleGetUnreadNotificationsCount() {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const count = DB.getAll('notifications', n => n.user_id === userId && !n.is_read).length;
        return { count };
    },
    
    // Reputation handlers
    handleToggleReputation({ targetUserId, type }) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        if (userId === targetUserId) throw new Error('Нельзя ставить репутацию самому себе');
        
        const existing = DB.getAll('reputation', r => r.user_id === userId && r.target_user_id === targetUserId);
        if (existing.length > 0) {
            DB.delete('reputation', existing[0].id);
            const user = DB.get('users', targetUserId);
            DB.update('users', targetUserId, { reputation: Math.max(0, (user.reputation || 0) - (type === 'positive' ? 1 : -1)) });
            return { added: false };
        } else {
            DB.insert('reputation', {
                user_id: userId,
                target_user_id: targetUserId,
                type,
                created_at: new Date().toISOString()
            });
            const user = DB.get('users', targetUserId);
            DB.update('users', targetUserId, { reputation: (user.reputation || 0) + (type === 'positive' ? 1 : -1) });
            return { added: true };
        }
    },
    
    // Stats handlers
    handleGetStats() {
        const posts = DB.getAll('posts');
        const users = DB.getAll('users', u => !u.is_banned);
        const onlineUsers = DB.getAll('users', u => u.is_online && !u.is_banned);
        
        const categoryCounts = {
            complaints: posts.filter(p => p.category === 'complaints').length,
            appeals: posts.filter(p => p.category === 'appeals').length,
            questions: posts.filter(p => p.category === 'questions').length,
            suggestions: posts.filter(p => p.category === 'suggestions').length
        };
        
        return {
            totalPosts: posts.length,
            totalUsers: users.length,
            onlineUsers: onlineUsers.length,
            categoryCounts
        };
    },
    
    handleGetAdminStats() {
        const stats = this.handleGetStats();
        const posts = DB.getAll('posts');
        const users = DB.getAll('users');
        const comments = DB.getAll('comments');
        const applications = DB.getAll('admin_applications', a => a.status === 'pending');
        
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const postsByStatus = {
            open: posts.filter(p => p.status === 'open').length,
            accepted: posts.filter(p => p.status === 'accepted').length,
            approved: posts.filter(p => p.status === 'approved').length,
            rejected: posts.filter(p => p.status === 'rejected').length,
            resolved: posts.filter(p => p.status === 'resolved').length
        };
        
        const usersByRole = {
            user: users.filter(u => u.role === 'user').length,
            helper: users.filter(u => u.role === 'helper').length,
            moderator: users.filter(u => u.role === 'moderator').length,
            admin: users.filter(u => u.role === 'admin').length,
            senior_admin: users.filter(u => u.role === 'senior_admin').length,
            manager: users.filter(u => u.role === 'manager').length,
            management: users.filter(u => u.role === 'management').length
        };
        
        return {
            ...stats,
            totalComments: comments.length,
            pendingApplications: applications.length,
            postsByStatus,
            usersByRole,
            // Additional stats for admin panel
            todayUsers: users.filter(u => new Date(u.created_at) >= todayStart).length,
            todayPosts: posts.filter(p => new Date(p.created_at) >= todayStart).length,
            bannedUsers: users.filter(u => u.is_banned).length,
            verifiedEmail: users.filter(u => u.is_email_verified).length,
            verifiedRoblox: users.filter(u => u.is_roblox_verified).length,
            roleStats: usersByRole,
            statusStats: postsByStatus
        };
    },
    
    // Admin handlers
    handleGetAdminUsers(url) {
        const params = new URLSearchParams(url.search);
        const search = params.get('search') || '';
        const role = params.get('role') || 'all';
        
        let users = DB.getAll('users');
        
        if (search) {
            const searchLower = search.toLowerCase();
            users = users.filter(u => 
                u.username.toLowerCase().includes(searchLower) ||
                u.email.toLowerCase().includes(searchLower) ||
                (u.roblox_nick && u.roblox_nick.toLowerCase().includes(searchLower))
            );
        }
        
        if (role !== 'all') {
            users = users.filter(u => u.role === role);
        }
        
        return { users: users.map(u => this.formatUser(u)) };
    },
    
    handleSearchUser(searchTerm) {
        const searchLower = decodeURIComponent(searchTerm).toLowerCase().trim();
        // Ищем по нику из сайта (username) или по нику из Roblox (roblox_nick)
        const user = DB.getAll('users').find(u => 
            u.username.toLowerCase() === searchLower || 
            (u.roblox_nick && u.roblox_nick.toLowerCase() === searchLower)
        );
        if (!user) throw new Error('User not found');
        return this.formatUser(user);
    },
    
    handleChangeUserRole(userId, { role }) {
        const currentUserId = this.getUserId();
        const currentUser = DB.get('users', currentUserId);
        const targetUser = DB.get('users', userId);
        
        if (!currentUser || !targetUser) throw new Error('User not found');
        const targetUserLevel = ROLES_INFO[targetUser.role]?.level || 0;
        const currentUserLevel = ROLES_INFO[currentUser.role]?.level || 0;
        
        if (targetUserLevel >= 5 && currentUserLevel < 5) {
            throw new Error('Нельзя изменять роль руководства');
        }
        if (userId === currentUserId && ROLES_INFO[role]?.level < currentUserLevel) {
            throw new Error('Нельзя понизить свою роль');
        }
        
        const currentLevel = currentUserLevel;
        const targetLevel = ROLES_INFO[role]?.level || 0;
        // Руководство (level 5) может назначать любые роли, включая management
        if (targetLevel >= currentLevel && currentUserLevel < 5) {
            throw new Error('Нельзя назначить роль выше или равную вашей');
        }
        
        DB.update('users', userId, { role });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'role_change',
            details: `Изменена роль пользователя ${targetUser.username} на ${role}`
        });
        return { success: true };
    },
    
    handleBanUser(userId, { reason }) {
        const currentUserId = this.getUserId();
        const currentUser = DB.get('users', currentUserId);
        const targetUser = DB.get('users', userId);
        
        if (!currentUser || !targetUser) throw new Error('User not found');
        const targetUserLevel = ROLES_INFO[targetUser.role]?.level || 0;
        if (targetUserLevel >= 5) {
            throw new Error('Нельзя забанить руководство');
        }
        if (userId === currentUserId) {
            throw new Error('Нельзя забанить самого себя');
        }
        
        DB.update('users', userId, { is_banned: true, ban_reason: reason || 'Нарушение правил' });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'ban_user',
            details: `Забанен пользователь ${targetUser.username}: ${reason || 'Нарушение правил'}`
        });
        return { success: true };
    },
    
    handleUnbanUser(userId) {
        const currentUserId = this.getUserId();
        const targetUser = DB.get('users', userId);
        if (!targetUser) throw new Error('User not found');
        DB.update('users', userId, { is_banned: false, ban_reason: null });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'unban_user',
            details: `Разбанен пользователь ${targetUser.username}`
        });
        return { success: true };
    },
    
    handleMuteUser(userId, { reason, duration }) {
        const currentUserId = this.getUserId();
        const currentUser = DB.get('users', currentUserId);
        const targetUser = DB.get('users', userId);
        
        if (!currentUser || !targetUser) throw new Error('User not found');
        if (!reason || !reason.trim()) {
            throw new Error('Необходимо указать причину мута');
        }
        const targetUserLevel = ROLES_INFO[targetUser.role]?.level || 0;
        if (targetUserLevel >= 5) {
            throw new Error('Нельзя замутить руководство');
        }
        if (userId === currentUserId) {
            throw new Error('Нельзя замутить самого себя');
        }
        
        // Вычисляем время окончания мута (duration в минутах)
        const muteExpiresAt = duration ? new Date(Date.now() + duration * 60 * 1000).toISOString() : null;
        
        DB.update('users', userId, { 
            is_muted: true, 
            mute_reason: reason.trim(),
            mute_expires_at: muteExpiresAt
        });
        
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'mute_user',
            details: `Замучен пользователь ${targetUser.username}: ${reason}${duration ? ` на ${duration} минут` : ''}`
        });
        return { success: true };
    },
    
    handleUnmuteUser(userId) {
        const currentUserId = this.getUserId();
        const targetUser = DB.get('users', userId);
        if (!targetUser) throw new Error('User not found');
        DB.update('users', userId, { is_muted: false, mute_reason: null, mute_expires_at: null });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'unmute_user',
            details: `Снят мут с пользователя ${targetUser.username}`
        });
        return { success: true };
    },
    
    handleDeleteUser(userId) {
        const currentUserId = this.getUserId();
        const currentUser = DB.get('users', currentUserId);
        const targetUser = DB.get('users', userId);
        
        if (!currentUser || !targetUser) throw new Error('User not found');
        const targetUserLevel = ROLES_INFO[targetUser.role]?.level || 0;
        if (targetUserLevel >= 5) {
            throw new Error('Нельзя удалить руководство');
        }
        if (userId === currentUserId) {
            throw new Error('Нельзя удалить самого себя');
        }
        
        DB.delete('users', userId);
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'delete_user',
            details: `Удален пользователь ${targetUser.username}`
        });
        return { success: true };
    },
    
    handleGetAdminPosts(url) {
        const params = new URLSearchParams(url.search);
        const status = params.get('status') || 'all';
        const category = params.get('category') || 'all';
        
        let posts = DB.getAll('posts');
        
        if (status !== 'all') {
            posts = posts.filter(p => p.status === status);
        }
        
        if (category !== 'all') {
            posts = posts.filter(p => p.category === category);
        }
        
        posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return { posts: posts.map(p => this.formatPost(p)) };
    },
    
    handleTogglePinPost(postId) {
        const post = DB.get('posts', postId);
        if (!post) throw new Error('Post not found');
        DB.update('posts', postId, { is_pinned: !post.is_pinned });
        return { success: true };
    },
    
    handleToggleHotPost(postId) {
        const post = DB.get('posts', postId);
        if (!post) throw new Error('Post not found');
        DB.update('posts', postId, { is_hot: !post.is_hot });
        return { success: true };
    },
    
    handleGetAdminActivity(url) {
        const params = new URLSearchParams(url.search);
        const limit = parseInt(params.get('limit') || '100');
        let activities = DB.getAll('activity_log');
        activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        activities = activities.slice(0, limit);
        return activities.map(a => {
            const user = DB.get('users', a.user_id);
            return {
                ...a,
                username: user ? user.username : 'Unknown'
            };
        });
    },
    
    handleGetAdminApplications(url) {
        const params = new URLSearchParams(url.search);
        const status = params.get('status') || 'pending';
        let applications = DB.getAll('admin_applications');
        if (status !== 'all') {
            applications = applications.filter(a => a.status === status);
        }
        applications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return applications.map(a => {
            const user = DB.get('users', a.user_id);
            return {
                ...a,
                username: user ? user.username : 'Unknown',
                user: user ? this.formatUser(user) : null
            };
        });
    },
    
    handleGetApplicationsCount() {
        const pending = DB.getAll('admin_applications', a => a.status === 'pending').length;
        return { count: pending };
    },
    
    handleCreateApplication(data) {
        const userId = this.getUserId();
        if (!userId) throw new Error('Unauthorized');
        const existing = DB.getAll('admin_applications', a => a.user_id === userId && a.status === 'pending');
        if (existing.length > 0) {
            throw new Error('У вас уже есть активная заявка');
        }
        
        const application = DB.insert('admin_applications', {
            user_id: userId,
            nick: data.nick,
            age: data.age,
            hours: data.hours,
            experience: data.experience || '',
            reason: data.reason,
            discord: data.discord,
            status: 'pending',
            reject_reason: null,
            created_at: new Date().toISOString()
        });
        
        return application;
    },
    
    handleApproveApplication(appId, { role }) {
        const currentUserId = this.getUserId();
        const currentUser = DB.get('users', currentUserId);
        const app = DB.get('admin_applications', appId);
        if (!app) throw new Error('Application not found');
        
        const currentLevel = ROLES_INFO[currentUser.role]?.level || 0;
        const targetLevel = ROLES_INFO[role]?.level || 0;
        if (targetLevel >= currentLevel) {
            throw new Error('Нельзя назначить роль выше или равную вашей');
        }
        
        DB.update('admin_applications', appId, { status: 'approved' });
        DB.update('users', app.user_id, { role });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'approve_application',
            details: `Одобрена заявка пользователя ${app.nick} на роль ${role}`
        });
        return { success: true };
    },
    
    handleRejectApplication(appId, { reason }) {
        const currentUserId = this.getUserId();
        const app = DB.get('admin_applications', appId);
        if (!app) throw new Error('Application not found');
        DB.update('admin_applications', appId, { status: 'rejected', reject_reason: reason || null });
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'reject_application',
            details: `Отклонена заявка пользователя ${app.nick}: ${reason || 'Без указания причины'}`
        });
        return { success: true };
    },
    
    handleGetAdminVerifications(url) {
        const params = new URLSearchParams(url.search);
        const status = params.get('status') || 'pending';
        let verifications = DB.getAll('roblox_verifications');
        if (status !== 'all') {
            verifications = verifications.filter(v => v.status === status);
        }
        verifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return verifications.map(v => {
            const user = DB.get('users', v.user_id);
            return {
                ...v,
                username: user ? user.username : 'Unknown',
                user: user ? this.formatUser(user) : null
            };
        });
    },
    
    handleGetVerificationsCount() {
        const pending = DB.getAll('roblox_verifications', v => v.status === 'pending').length;
        return { count: pending };
    },
    
    handleApproveVerification(verId) {
        const currentUserId = this.getUserId();
        const verification = DB.get('roblox_verifications', verId);
        if (!verification) throw new Error('Verification not found');
        
        // Верифицируем пользователя
        DB.update('users', verification.user_id, { 
            is_roblox_verified: true,
            roblox_user_id: verification.roblox_user_id
        });
        
        // Обновляем статус верификации
        DB.update('roblox_verifications', verId, { status: 'approved' });
        
        // Отправляем сообщение пользователю
        const adminUser = DB.get('users', currentUserId);
        const now = new Date().toISOString();
        DB.insert('messages', {
            sender_id: currentUserId,
            receiver_id: verification.user_id,
            content: `Ваша верификация Roblox для ника "${verification.roblox_nick}" была одобрена.`,
            is_read: false,
            created_at: now
        });
        
        // Добавляем уведомление
        DB.insert('notifications', {
            user_id: verification.user_id,
            type: 'verification',
            title: 'Верификация одобрена',
            message: `Ваша верификация Roblox для ника "${verification.roblox_nick}" была одобрена.`,
            link: '#profile',
            is_read: false,
            created_at: now
        });
        
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'approve_verification',
            details: `Одобрена верификация Roblox для пользователя ${verification.user_id} (${verification.roblox_nick})`
        });
        
        return { success: true };
    },
    
    handleRejectVerification(verId, { reason }) {
        const currentUserId = this.getUserId();
        const verification = DB.get('roblox_verifications', verId);
        if (!verification) throw new Error('Verification not found');
        
        // Обновляем статус верификации
        DB.update('roblox_verifications', verId, { status: 'rejected', reject_reason: reason || null });
        
        // Отправляем сообщение пользователю
        const now = new Date().toISOString();
        const messageText = reason 
            ? `Ваша верификация Roblox для ника "${verification.roblox_nick}" была отклонена. Причина: ${reason}`
            : `Ваша верификация Roblox для ника "${verification.roblox_nick}" была отклонена.`;
        
        DB.insert('messages', {
            sender_id: currentUserId,
            receiver_id: verification.user_id,
            content: messageText,
            is_read: false,
            created_at: now
        });
        
        // Добавляем уведомление
        DB.insert('notifications', {
            user_id: verification.user_id,
            type: 'verification',
            title: 'Верификация отклонена',
            message: reason 
                ? `Ваша верификация Roblox для ника "${verification.roblox_nick}" была отклонена. Причина: ${reason}`
                : `Ваша верификация Roblox для ника "${verification.roblox_nick}" была отклонена.`,
            link: '#profile',
            is_read: false,
            created_at: now
        });
        
        DB.insert('activity_log', {
            user_id: currentUserId,
            action: 'reject_verification',
            details: `Отклонена верификация Roblox для пользователя ${verification.user_id} (${verification.roblox_nick}): ${reason || 'Без указания причины'}`
        });
        
        return { success: true };
    },
    
    // Helper methods
    getUserId() {
        if (!this.token) return null;
        const userId = this.token.replace('token_', '');
        return userId;
    },
    
    getCurrentUser() {
        const userId = this.getUserId();
        if (!userId) return null;
        return DB.get('users', userId);
    },
    
    formatUser(user) {
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
            roleInfo: ROLES_INFO[user.role],
            reputation: user.reputation || 0,
            is_email_verified: user.is_email_verified || false,
            is_roblox_verified: user.is_roblox_verified || false,
            is_muted: user.is_muted || false,
            mute_reason: user.mute_reason || null,
            mute_expires_at: user.mute_expires_at || user.mute_until || null,
            created_at: user.created_at
        };
    },
    
    formatPost(post) {
        if (!post) return null;
        const author = DB.get('users', post.author_id);
        const commentsCount = DB.getAll('comments', c => c.post_id === post.id).length;
        return {
            ...post,
            author: author ? this.formatUser(author) : null,
            commentsCount,
            extra_data: post.extra_data ? (typeof post.extra_data === 'string' ? JSON.parse(post.extra_data) : post.extra_data) : {}
        };
    },
    
    formatComment(comment) {
        if (!comment) return null;
        const author = DB.get('users', comment.author_id);
        return {
            ...comment,
            author: author ? this.formatUser(author) : null
        };
    },
    
    formatMessage(message) {
        if (!message) return null;
        const sender = DB.get('users', message.sender_id);
        const receiver = DB.get('users', message.receiver_id);
        return {
            ...message,
            sender: sender ? this.formatUser(sender) : null,
            receiver: receiver ? this.formatUser(receiver) : null
        };
    },
    
    formatNotification(notification) {
        return notification;
    },
    
    get(endpoint) {
        return this.request(endpoint);
    },
    
    post(endpoint, data) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) });
    },
    
    put(endpoint, data) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(data) });
    },
    
    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },
    
    async uploadFile(endpoint, file, fieldName = 'file') {
        // Convert file to data URL for browser storage
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await this.request(endpoint, { 
                        method: 'POST', 
                        body: JSON.stringify({ file: e.target.result }) 
                    });
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('urp_token', token);
        } else {
            localStorage.removeItem('urp_token');
        }
    }
};

// ===== EMAIL SERVICE CONFIGURATION =====
// Настройте EmailJS: https://www.emailjs.com/
// 1. Зарегистрируйтесь на emailjs.com (бесплатно)
// 2. Создайте Email Service (Gmail, Outlook и т.д.)
// 3. Создайте Email Template
// 4. Получите Public Key, Service ID и Template ID
// 5. Замените значения ниже на свои

const EMAILJS_CONFIG = {
    PUBLIC_KEY: 'QSu4MBsyUYOiq5dCj', // Замените на ваш Public Key из EmailJS
    SERVICE_ID: 'service_unrp727D', // Замените на ваш Service ID
    TEMPLATE_ID: 'template_m2kb6cq' // Замените на ваш Template ID
};

// Инициализация EmailJS
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
}

// Функция отправки email с кодом верификации
async function sendVerificationEmail(email, code, username) {
    // Если EmailJS не настроен, возвращаем false
    if (EMAILJS_CONFIG.PUBLIC_KEY === 'YOUR_PUBLIC_KEY' || typeof emailjs === 'undefined') {
        console.warn('EmailJS не настроен. Письмо не отправлено.');
        showToast('warning', 'EmailJS не настроен', 'Настройте EmailJS для отправки писем');
        return false;
    }
    
    try {
        // Параметры для шаблона EmailJS
        // Убедитесь, что переменные в шаблоне совпадают с этими именами
        const templateParams = {
            to_email: email,
            to_name: username,
            verification_code: code,
            from_name: 'Unfiltered RP',
            message: `Ваш код подтверждения: ${code}`
        };
        
        console.log('Отправка email:', { email, code, username });
        console.log('EmailJS Config:', EMAILJS_CONFIG);
        
        const result = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams
        );
        
        console.log('Email успешно отправлен:', result);
        return true;
    } catch (error) {
        console.error('Ошибка отправки email:', error);
        console.error('Детали ошибки:', {
            text: error.text,
            status: error.status,
            message: error.message
        });
        
        // Показываем пользователю понятное сообщение об ошибке
        let errorMessage = 'Не удалось отправить письмо';
        if (error.text) {
            errorMessage += ': ' + error.text;
        } else if (error.message) {
            errorMessage += ': ' + error.message;
        }
        showToast('error', 'Ошибка отправки', errorMessage);
        
        return false;
    }
}

// ===== STATE =====
let currentUser = null;
let currentCategory = 'all';
let selectedPostCategory = null;
let currentPostId = null;
let currentPage = 1;
let postsPerPage = 10;
let searchQuery = '';
let unreadNotifications = 0;
let unreadMessages = 0;

// ===== EMAIL VALIDATION =====
const commonEmailDomains = [
    'gmail.com', 'mail.ru', 'yandex.ru', 'yahoo.com', 'outlook.com', 
    'hotmail.com', 'icloud.com', 'rambler.ru', 'bk.ru', 'list.ru',
    'inbox.ru', 'ya.ru', 'yandex.com', 'protonmail.com', 'live.com'
];

const commonTypos = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmali.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com',
    'gmail.om': 'gmail.com',
    'gmail.con': 'gmail.com',
    'gmail.coom': 'gmail.com',
    'gmailc.om': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'mail.r': 'mail.ru',
    'mail.ri': 'mail.ru',
    'mail.rru': 'mail.ru',
    'mai.ru': 'mail.ru',
    'maill.ru': 'mail.ru',
    'yandex.r': 'yandex.ru',
    'yandex.ri': 'yandex.ru',
    'yandex.rru': 'yandex.ru',
    'yanex.ru': 'yandex.ru',
    'yndex.ru': 'yandex.ru',
    'yahoo.co': 'yahoo.com',
    'yahoo.cm': 'yahoo.com',
    'yahooo.com': 'yahoo.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com',
    'hotmal.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com'
};

function validateEmail(email) {
    const result = { valid: true, suggestion: null, error: null };
    
    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        result.valid = false;
        result.error = 'Неверный формат email';
        return result;
    }
    
    const [localPart, domain] = email.toLowerCase().split('@');
    
    // Check for common typos
    if (commonTypos[domain]) {
        result.valid = false;
        result.suggestion = `${localPart}@${commonTypos[domain]}`;
        result.error = `Возможно вы имели в виду: ${result.suggestion}?`;
        return result;
    }
    
    // Check for similar domains (Levenshtein distance)
    for (const correctDomain of commonEmailDomains) {
        if (domain !== correctDomain && levenshteinDistance(domain, correctDomain) <= 2) {
            result.suggestion = `${localPart}@${correctDomain}`;
            result.error = `Возможно вы имели в виду: ${result.suggestion}?`;
            // Don't mark as invalid, just suggest
            break;
        }
    }
    
    return result;
}

function levenshteinDistance(str1, str2) {
    const m = str1.length;
    const n = str2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

// ===== CONSTANTS =====
const categoryMap = {
    complaint: 'complaints',
    appeal: 'appeals',
    question: 'questions',
    suggestion: 'suggestions'
};

const categoryNames = {
    all: 'Все темы',
    complaints: 'Жалобы',
    appeals: 'Апелляции',
    questions: 'Вопросы',
    suggestions: 'Предложения'
};

const categoryFormNames = {
    complaint: 'Жалоба на игрока',
    appeal: 'Апелляция бана',
    question: 'Вопрос',
    suggestion: 'Предложение'
};

const avatars = ['🎮', '🎯', '⚡', '🔥', '💡', '🚀', '🎪', '🎨', '🎭', '🎸', '🎹', '🎺', '🌟', '💎', '🦊', '🐺', '🦁', '🐯', '🎲', '🏆', '👑', '🎖️', '🛡️', '⚔️'];

// ===== DOM ELEMENTS =====
const toastContainer = document.getElementById('toastContainer');
const postsList = document.getElementById('postsList');
const postsTitle = document.getElementById('postsTitle');
const postsCount = document.getElementById('postsCount');
const emptyState = document.getElementById('emptyState');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// ===== TOAST NOTIFICATIONS =====
function showToast(type, title, message) {
    const icons = {
        success: 'check',
        error: 'times',
        info: 'info',
        warning: 'exclamation-triangle'
    };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icons[type] || 'info'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

// ===== HELPER: RENDER AVATAR =====
function renderAvatar(user, size = '') {
    if (user.avatar_url) {
        return `<img src="${user.avatar_url}" alt="Avatar" class="user-avatar-img">`;
    }
    return user.avatar || '🎮';
}

// ===== HELPER: RENDER ROLE BADGE =====
function renderRoleBadge(role, roleInfo) {
    if (!roleInfo) return '';
    return `<span class="profile-role-badge role-${role}"><i class="fas ${roleInfo.icon}"></i> ${roleInfo.name}</span>`;
}

// ===== HELPER: GET CATEGORY ICON =====
function getCategoryIcon(category) {
    const categoryIcons = {
        'complaints': '<i class="fas fa-exclamation-triangle"></i>',
        'appeals': '<i class="fas fa-balance-scale"></i>',
        'questions': '<i class="fas fa-question-circle"></i>',
        'suggestions': '<i class="fas fa-lightbulb"></i>',
        'all': '<i class="fas fa-comments"></i>'
    };
    return categoryIcons[category] || '<i class="fas fa-comments"></i>';
}

// ===== AUTHENTICATION =====
function openAuthModal(form = 'login') {
    document.getElementById('authModal').classList.add('active');
    switchAuthForm(form);
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.body.style.overflow = '';
    ['loginUsername', 'loginPassword', 'regUsername', 'regEmail', 'regRoblox', 'regPassword', 'regPasswordConfirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function switchAuthForm(form) {
    document.getElementById('loginForm').classList.toggle('hidden', form !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', form !== 'register');
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('error', 'Ошибка', 'Заполните все поля');
        return;
    }
    
    try {
        const response = await api.post('/auth/login', { username, password });
        api.setToken(response.token);
        currentUser = response.user;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
        
        // Добавляем профиль в список сохраненных
        addCurrentProfile();
        
        closeAuthModal();
        updateAuthUI();
        showToast('success', 'Добро пожаловать!', `Вы вошли как ${currentUser.username}`);
        loadNotificationsCount();
        loadMessagesCount();
    } catch (error) {
        showToast('error', 'Ошибка входа', error.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value.trim();
    let email = document.getElementById('regEmail').value.trim().toLowerCase();
    const robloxNick = document.getElementById('regRoblox').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    if (!username || !email || !robloxNick || !rod || !password) {
        showToast('error', 'Ошибка', 'Заполните все обязательные поля');
        return;
    }
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
        if (emailValidation.suggestion) {
            showConfirm('Исправление email', `${emailValidation.error}\n\nИспользовать исправленный адрес?`, () => {
                email = emailValidation.suggestion;
                document.getElementById('regEmail').value = email;
                continueRegistration(email);
            });
        return;
        } else {
            showToast('error', 'Ошибка email', emailValidation.error);
        return;
    }
    } else if (emailValidation.suggestion) {
        showConfirm('Исправление email', `${emailValidation.error}\n\nИспользовать исправленный адрес?`, () => {
            email = emailValidation.suggestion;
            document.getElementById('regEmail').value = email;
            continueRegistration(email);
        });
        return;
    }
    
    continueRegistration(email);
}

async function continueRegistration(email) {
    const username = document.getElementById('regUsername').value.trim();
    const robloxNick = document.getElementById('regRoblox').value.trim();
    const rod = document.getElementById('regRod').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    if (password !== passwordConfirm) {
        showToast('error', 'Ошибка', 'Пароли не совпадают');
        return;
    }
    
    if (!agreeTerms) {
        showToast('error', 'Ошибка', 'Необходимо согласиться с правилами');
        return;
    }
    
    try {
        const response = await api.post('/api/auth/register', {
        username,
        email,
        password,
            robloxNick,
            rod
        });
        api.setToken(response.token);
        currentUser = response.user;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
    
    closeAuthModal();
    updateAuthUI();
    updateStats();
    
        if (response.emailSent) {
            showToast('success', 'Код отправлен!', 'Проверьте почту для подтверждения');
        }
        
        showWelcomeModal(currentUser);
    } catch (error) {
        showToast('error', 'Ошибка регистрации', error.message);
    }
}

function checkPasswordStrength(password) {
    const strengthEl = document.getElementById('passwordStrength');
    if (!strengthEl) return;
    
    let strength = 0;
    let text = '';
    let className = '';
    
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (password.length === 0) {
        strengthEl.innerHTML = '';
        return;
    }
    
    if (strength <= 2) {
        className = 'weak';
        text = 'Слабый пароль';
    } else if (strength <= 3) {
        className = 'medium';
        text = 'Средний пароль';
    } else {
        className = 'strong';
        text = 'Надёжный пароль';
    }
    
    strengthEl.innerHTML = `
        <div class="strength-bar ${className}"></div>
        <div class="strength-text">${text}</div>
    `;
}

function checkPasswordMatch() {
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;
    const matchEl = document.getElementById('passwordMatch');
    
    if (!matchEl || !confirm) {
        if (matchEl) matchEl.innerHTML = '';
        return;
    }
    
    if (password === confirm) {
        matchEl.innerHTML = '<i class="fas fa-check"></i> Пароли совпадают';
        matchEl.className = 'password-match match';
    } else {
        matchEl.innerHTML = '<i class="fas fa-times"></i> Пароли не совпадают';
        matchEl.className = 'password-match no-match';
    }
}

function showWelcomeModal(user) {
    document.getElementById('welcomeName').textContent = user.username;
    document.getElementById('welcomeEmail').textContent = user.email;
    document.getElementById('welcomeModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeWelcomeModal() {
    document.getElementById('welcomeModal').classList.remove('active');
    document.body.style.overflow = '';
    showToast('success', 'Готово!', 'Теперь вы можете создавать темы и комментировать');
}

async function logout() {
    try {
        await api.post('/api/auth/logout');
    } catch (error) {}
    
    api.setToken(null);
    currentUser = null;
    localStorage.removeItem('urp_user');
    updateAuthUI();
    closeUserMenu();
    goHome();
    showToast('info', 'До свидания!', 'Вы вышли из аккаунта');
}

function updateAuthUI() {
    const guestButtons = document.getElementById('guestButtons');
    const userButtons = document.getElementById('userButtons');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const adminMenuItems = document.getElementById('adminMenuItems');
    
    if (currentUser) {
        guestButtons.classList.add('hidden');
        userButtons.classList.remove('hidden');
        userName.textContent = currentUser.username;
        
        if (currentUser.avatar_url) {
            userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
        } else {
        userAvatar.textContent = currentUser.avatar;
        }
        
        // Show admin menu for staff (helper+)
        const roleLevel = currentUser.roleInfo?.level || 0;
        if (roleLevel >= 1) {
            adminMenuItems.classList.remove('hidden');
        } else {
            adminMenuItems.classList.add('hidden');
        }
        
        // Show Export/Import tab only for management (level 5)
        const exportTabBtn = document.getElementById('adminTabExportBtn');
        if (exportTabBtn) {
            if (roleLevel >= 5) {
                exportTabBtn.style.display = '';
            } else {
                exportTabBtn.style.display = 'none';
            }
        }
    } else {
        guestButtons.classList.remove('hidden');
        userButtons.classList.add('hidden');
        adminMenuItems?.classList.add('hidden');
        const exportTabBtn = document.getElementById('adminTabExportBtn');
        if (exportTabBtn) exportTabBtn.style.display = 'none';
    }
    
    updateOnlineUsers();
}

// ===== PROFILE MANAGER =====
let savedProfiles = [];

function loadSavedProfiles() {
    try {
        const saved = localStorage.getItem('saved_profiles');
        if (saved) {
            savedProfiles = JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading profiles:', error);
        savedProfiles = [];
    }
}

function saveProfiles() {
    try {
        localStorage.setItem('saved_profiles', JSON.stringify(savedProfiles));
    } catch (error) {
        console.error('Error saving profiles:', error);
    }
}

function addCurrentProfile() {
    if (!currentUser) return;
    
    const profileExists = savedProfiles.find(p => p.id === currentUser.id);
    if (!profileExists) {
        savedProfiles.push({
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            avatar_url: currentUser.avatar_url,
            token: api.token,
            added_at: new Date().toISOString()
        });
        saveProfiles();
    }
}

// ===== ACCOUNT SWITCHER =====
function openAccountSwitcher() {
    closeUserMenu();
    loadSavedProfiles();
    
    // Добавляем текущий профиль, если его нет
    if (currentUser) {
        addCurrentProfile();
    }
    
    document.getElementById('accountSwitcherModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    renderAccountSwitcher();
}

function closeAccountSwitcher() {
    document.getElementById('accountSwitcherModal').classList.remove('active');
    document.body.style.overflow = '';
}

function renderAccountSwitcher() {
    // Отображаем текущий аккаунт
    const currentCard = document.getElementById('currentAccountCard');
    if (currentCard) {
        if (currentUser) {
            const avatarDisplay = currentUser.avatar_url 
                ? `<img src="${currentUser.avatar_url}" alt="">`
                : currentUser.avatar || '🎮';
            
            currentCard.innerHTML = `
                <div class="account-card active">
                    <div class="account-avatar">${avatarDisplay}</div>
                    <div class="account-info">
                        <div class="account-name">${escapeHtml(currentUser.username)}</div>
                        <div class="account-details">
                            ${currentUser.roblox_nick ? `<span><i class="fas fa-gamepad"></i> ${escapeHtml(currentUser.roblox_nick)}</span>` : ''}
                            ${currentUser.rod ? `<span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(currentUser.rod)}</span>` : ''}
                        </div>
                    </div>
                    <div class="account-badge-current">
                        <i class="fas fa-check-circle"></i> Активен
                    </div>
                </div>
            `;
        } else {
            currentCard.innerHTML = `
                <div class="account-card empty">
                    <i class="fas fa-user-slash"></i>
                    <span>Вы не вошли в аккаунт</span>
                </div>
            `;
        }
    }
    
    // Отображаем сохраненные аккаунты
    const accountsList = document.getElementById('accountsList');
    const accountsCount = document.getElementById('accountsCount');
    
    if (!accountsList) return;
    
    // Фильтруем текущий аккаунт из списка
    const otherAccounts = savedProfiles.filter(p => !currentUser || p.id !== currentUser.id);
    
    if (accountsCount) {
        accountsCount.textContent = otherAccounts.length;
    }
    
    if (otherAccounts.length === 0) {
        accountsList.innerHTML = `
            <div class="empty-accounts">
                <i class="fas fa-user-friends" style="font-size: 48px; opacity: 0.3; margin-bottom: 16px;"></i>
                <p>Нет других сохраненных аккаунтов</p>
                <p style="color: var(--text-muted); font-size: 14px;">Войдите в другой аккаунт, чтобы добавить его</p>
            </div>
        `;
        return;
    }
    
    accountsList.innerHTML = otherAccounts.map((profile, index) => {
        const avatarDisplay = profile.avatar_url 
            ? `<img src="${profile.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
            : profile.avatar || '🎮';
        
        const addedDate = profile.added_at ? new Date(profile.added_at).toLocaleDateString('ru-RU') : '';
        
        return `
            <div class="account-card" data-account-id="${profile.id}">
                <div class="account-avatar">${avatarDisplay}</div>
                <div class="account-info">
                    <div class="account-name">${escapeHtml(profile.username)}</div>
                    ${addedDate ? `<div class="account-date"><i class="fas fa-calendar"></i> Добавлен ${addedDate}</div>` : ''}
                </div>
                <div class="account-actions">
                    <button class="btn btn-sm btn-primary" onclick="switchToAccount('${profile.id}')" title="Переключиться на этот аккаунт">
                        <i class="fas fa-sign-in-alt"></i> Войти
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="removeAccount('${profile.id}')" title="Удалить из списка">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function switchToAccount(accountId) {
    const profile = savedProfiles.find(p => p.id === accountId);
    if (!profile) {
        showToast('error', 'Ошибка', 'Аккаунт не найден');
        return;
    }
    
    try {
        // Устанавливаем токен
        api.setToken(profile.token);
        
        // Загружаем данные пользователя
        const userData = await api.get('/auth/me');
        currentUser = userData;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
        
        // Обновляем UI
        updateAuthUI();
        closeAccountSwitcher();
        
        showToast('success', 'Аккаунт изменен', `Вы вошли как ${userData.username}`);
        
        // Обновляем список аккаунтов
        renderAccountSwitcher();
        
        // Перезагружаем страницу для обновления данных
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (error) {
        showToast('error', 'Ошибка', 'Не удалось переключиться на аккаунт. Возможно, сессия истекла.');
        // Удаляем нерабочий аккаунт
        removeAccount(accountId);
    }
}

function removeAccount(accountId) {
    savedProfiles = savedProfiles.filter(p => p.id !== accountId);
    saveProfiles();
    renderAccountSwitcher();
    showToast('success', 'Аккаунт удален', 'Аккаунт удален из списка');
}

// Старые функции для совместимости
function openProfileManager() {
    openAccountSwitcher();
}

function closeProfileManager() {
    closeAccountSwitcher();
}

function renderProfilesList() {
    const listEl = document.getElementById('profilesList');
    if (!listEl) return;
    
    if (savedProfiles.length === 0) {
        listEl.innerHTML = `
            <div class="empty-profiles">
                <i class="fas fa-user-slash" style="font-size: 64px; opacity: 0.2; margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 12px; color: var(--text-primary);">Нет сохраненных профилей</h3>
                <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">
                    Войдите в аккаунт, и он автоматически добавится в список
                </p>
                ${!currentUser ? `
                    <button class="btn btn-primary" onclick="closeProfileManager(); openAuthModal('login');">
                        <i class="fas fa-sign-in-alt"></i> Войти в аккаунт
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = savedProfiles.map((profile, index) => {
        const isCurrent = currentUser && currentUser.id === profile.id;
        const avatarDisplay = profile.avatar_url 
            ? `<img src="${profile.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`
            : profile.avatar || '🎮';
        
        const addedDate = profile.added_at ? new Date(profile.added_at).toLocaleDateString('ru-RU') : '';
        
        return `
            <div class="profile-item ${isCurrent ? 'active' : ''}" data-profile-id="${profile.id}">
                <div class="profile-item-number">${index + 1}</div>
                <div class="profile-item-avatar">
                    ${avatarDisplay}
                </div>
                <div class="profile-item-info">
                    <div class="profile-item-name">${escapeHtml(profile.username)}</div>
                    <div class="profile-item-meta">
                        ${isCurrent ? '<span class="profile-item-badge">Текущий</span>' : ''}
                        ${addedDate ? `<span class="profile-item-date"><i class="fas fa-calendar"></i> ${addedDate}</span>` : ''}
                    </div>
                </div>
                <div class="profile-item-actions">
                    ${!isCurrent ? `
                        <button class="btn btn-sm btn-primary" onclick="switchToProfile('${profile.id}')" title="Переключиться на этот профиль">
                            <i class="fas fa-sign-in-alt"></i> Переключиться
                        </button>
                    ` : `
                        <span class="current-profile-indicator">
                            <i class="fas fa-check-circle"></i> Активен
                        </span>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="removeProfile('${profile.id}')" title="Удалить из списка" ${isCurrent ? 'disabled' : ''}>
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function switchToProfile(profileId) {
    const profile = savedProfiles.find(p => p.id === profileId);
    if (!profile) {
        showToast('error', 'Ошибка', 'Профиль не найден');
        return;
    }
    
    try {
        // Устанавливаем токен
        api.setToken(profile.token);
        
        // Загружаем данные пользователя
        const userData = await api.get('/auth/me');
        currentUser = userData;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
        
        // Обновляем UI
        updateAuthUI();
        closeProfileManager();
        
        showToast('success', 'Профиль изменен', `Вы вошли как ${userData.username}`);
        
        // Обновляем список профилей
        renderProfilesList();
    } catch (error) {
        showToast('error', 'Ошибка', 'Не удалось переключиться на профиль. Возможно, сессия истекла.');
        // Удаляем нерабочий профиль
        removeProfile(profileId);
    }
}

function removeProfile(profileId) {
    if (currentUser && currentUser.id === profileId) {
        showToast('warning', 'Внимание', 'Нельзя удалить текущий профиль');
        return;
    }
    
    savedProfiles = savedProfiles.filter(p => p.id !== profileId);
    saveProfiles();
    renderProfilesList();
    showToast('success', 'Профиль удален', 'Профиль успешно удален из списка');
}

function addNewProfile() {
    if (!currentUser) {
        showToast('info', 'Вход', 'Сначала войдите в аккаунт');
        closeProfileManager();
        openAuthModal('login');
        return;
    }
    
    addCurrentProfile();
    renderProfilesList();
    showToast('success', 'Профиль добавлен', 'Текущий профиль добавлен в список');
}


// ===== USER MENU =====
function toggleUserMenu() {
    document.getElementById('userDropdown').classList.toggle('active');
}

function closeUserMenu() {
    document.getElementById('userDropdown').classList.remove('active');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) closeUserMenu();
});

// ===== EMAIL VERIFICATION =====
async function openEmailVerifyModal() {
    document.getElementById('emailVerifyModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('emailVerifyCode').value = '';
    
    // Load the verification code
    try {
        const data = await api.get('/auth/email-code');
        document.getElementById('emailVerifyAddress').textContent = data.email;
        
        // Всегда показываем код на экране
        const codeDisplaySection = document.getElementById('emailCodeDisplaySection');
        if (codeDisplaySection) {
            codeDisplaySection.style.display = 'block';
            document.getElementById('emailDisplayCode').textContent = data.code;
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function closeEmailVerifyModal() {
    document.getElementById('emailVerifyModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function verifyEmail() {
    const code = document.getElementById('emailVerifyCode').value.trim();
    if (!code) {
        showToast('error', 'Ошибка', 'Введите код');
        return;
    }
    
    try {
        await api.post('/auth/verify-email', { code });
        closeEmailVerifyModal();
        currentUser.is_email_verified = 1;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
        showToast('success', 'Успешно!', 'Email подтверждён');
        
        if (!document.getElementById('profileSection').classList.contains('hidden')) {
            openProfile();
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function refreshEmailCode() {
    try {
        const data = await api.post('/auth/resend-email-code');
        
        // Всегда показываем код на экране
        const codeDisplaySection = document.getElementById('emailCodeDisplaySection');
        if (codeDisplaySection) {
            codeDisplaySection.style.display = 'block';
            document.getElementById('emailDisplayCode').textContent = data.code;
        }
        showToast('success', 'Готово', 'Новый код сгенерирован');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== ROBLOX VERIFICATION =====
function openRobloxVerifyModal() {
    document.getElementById('robloxVerifyModal').classList.add('active');
    document.getElementById('robloxNickDisplay').textContent = currentUser.roblox_nick || '';
    document.getElementById('robloxUserIdInput').value = '';
    document.body.style.overflow = 'hidden';
}

function closeRobloxVerifyModal() {
    document.getElementById('robloxVerifyModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function verifyRobloxByUserId() {
    const robloxUserId = document.getElementById('robloxUserIdInput').value.trim();
    
    if (!robloxUserId) {
        showToast('error', 'Ошибка', 'Введите User ID');
        return;
    }
    
    // Проверка формата (только цифры)
    if (!/^\d+$/.test(robloxUserId)) {
        showToast('error', 'Ошибка', 'User ID должен содержать только цифры');
        return;
    }
    
    try {
        showToast('info', 'Проверка...', 'Отправка заявки на верификацию Roblox');
        await api.post('/auth/verify-roblox-userid', { robloxUserId });
        
        closeRobloxVerifyModal();
        // Не устанавливаем is_roblox_verified в true, так как верификация ожидает рассмотрения
        showToast('success', '✅ Заявка отправлена!', 'Ваша заявка на верификацию отправлена администраторам. Вы получите уведомление после рассмотрения.');
        
        if (!document.getElementById('profileSection').classList.contains('hidden')) {
            openProfile();
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== ADMIN PANEL =====
let adminSelectedUser = null;
let adminCurrentTab = 'stats';

function openAdminPanel() {
    closeUserMenu();
    document.getElementById('adminPanelModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAdminTab('stats');
}

function closeAdminPanel() {
    document.getElementById('adminPanelModal').classList.remove('active');
    document.body.style.overflow = '';
    closeAdminUserModal();
}

function switchAdminTab(tab) {
    adminCurrentTab = tab;
    
    // Update menu items - remove all active classes first
    document.querySelectorAll('.admin-menu-item').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the correct menu item
    document.querySelectorAll('.admin-menu-item').forEach(btn => {
        const onclickStr = btn.getAttribute('onclick') || '';
        if (onclickStr.includes(`'${tab}'`) || onclickStr.includes(`"${tab}"`)) {
            btn.classList.add('active');
        }
    });
    
    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    const tabContentId = `adminTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    const tabContent = document.getElementById(tabContentId);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Load content
    switch (tab) {
        case 'stats':
            loadAdminStats();
            break;
        case 'users':
            loadAdminUsers();
            break;
        case 'staff':
            loadStaffList();
            break;
        case 'applications':
            loadAdminApplications();
            break;
        case 'verifications':
            loadAdminVerifications();
            break;
        case 'posts':
            loadAdminPosts();
            break;
        case 'activity':
            loadAdminActivity();
            break;
        case 'comments':
            loadAdminComments();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'templates':
            loadTemplates();
            break;
        case 'export':
            // No need to load, static content
            break;
    }
}

async function loadAdminStats() {
    try {
        const stats = await api.get('/admin/stats');
        
        document.getElementById('adminStatsGrid').innerHTML = `
            <div class="admin-stat-card highlight">
                <div class="admin-stat-icon">👥</div>
                <div class="admin-stat-value">${stats.totalUsers}</div>
                <div class="admin-stat-label">Всего пользователей</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">📝</div>
                <div class="admin-stat-value">${stats.totalPosts}</div>
                <div class="admin-stat-label">Всего постов</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">💬</div>
                <div class="admin-stat-value">${stats.totalComments}</div>
                <div class="admin-stat-label">Комментариев</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">🆕</div>
                <div class="admin-stat-value">${stats.todayUsers}</div>
                <div class="admin-stat-label">Новых за сегодня</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">📊</div>
                <div class="admin-stat-value">${stats.todayPosts}</div>
                <div class="admin-stat-label">Постов за сегодня</div>
            </div>
            <div class="admin-stat-card" style="border-color: rgba(239, 68, 68, 0.3);">
                <div class="admin-stat-icon">🚫</div>
                <div class="admin-stat-value">${stats.bannedUsers}</div>
                <div class="admin-stat-label">Забанено</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">✉️</div>
                <div class="admin-stat-value">${stats.verifiedEmail}</div>
                <div class="admin-stat-label">Email верифицировано</div>
            </div>
            <div class="admin-stat-card">
                <div class="admin-stat-icon">🎮</div>
                <div class="admin-stat-value">${stats.verifiedRoblox}</div>
                <div class="admin-stat-label">Roblox верифицировано</div>
            </div>
            
            <div style="grid-column: 1 / -1; margin-top: 16px;">
                <h4 style="margin-bottom: 12px; color: var(--primary-400);">📊 По ролям</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    ${Object.entries(stats.roleStats).map(([role, count]) => `
                        <div class="badge" style="padding: 8px 16px;">
                            <i class="fas ${ROLES_INFO[role]?.icon || 'fa-user'}"></i>
                            ${ROLES_INFO[role]?.name || role}: <strong>${count}</strong>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div style="grid-column: 1 / -1; margin-top: 16px;">
                <h4 style="margin-bottom: 12px; color: var(--primary-400);">📁 По статусам постов</h4>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <span class="status-badge status-open-alt">Открыто: ${stats.statusStats.open}</span>
                    <span class="status-badge status-approved">Принято: ${stats.statusStats.accepted || stats.statusStats.approved}</span>
                    <span class="status-badge status-rejected">Отклонено: ${stats.statusStats.rejected}</span>
                    <span class="status-badge status-resolved">Решено: ${stats.statusStats.resolved}</span>
                </div>
            </div>
        `;
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function loadAdminUsers() {
    const search = document.getElementById('adminUserSearch')?.value || '';
    const role = document.getElementById('adminRoleFilter')?.value || 'all';
    
    try {
        const data = await api.get(`/admin/users/list?search=${encodeURIComponent(search)}&role=${role}&limit=50`);
        const usersList = document.getElementById('adminUsersList');
        
        if (data.users.length === 0) {
            usersList.innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-users"></i>
                    <p>Пользователи не найдены</p>
                </div>
            `;
            return;
        }
        
        usersList.innerHTML = data.users.map(user => {
            const isBanned = user.is_banned === 1 || user.is_banned === true;
            const isSelected = selectedUsers.has(user.id);
            return `
                <div class="admin-user-row ${isBanned ? 'banned' : ''} ${isSelected ? 'selected' : ''}" 
                     data-user-id="${user.id}">
                    <div class="admin-user-row-content">
                        <div class="avatar">
                            ${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : user.avatar || '🎮'}
                        </div>
                        <div class="info">
                            <div class="name" style="color: ${user.roleInfo?.color || 'inherit'}">
                                ${isBanned ? '🚫 ' : ''}${escapeHtml(user.username)}
                            </div>
                            <div class="meta">
                                ${escapeHtml(user.roblox_nick || '')} • ${escapeHtml(user.email || '')} • Rep: ${user.reputation || 0}
                            </div>
                        </div>
                        <div class="badges">
                            ${renderRoleBadge(user.role, user.roleInfo)}
                            ${user.is_email_verified ? '<span class="verify-badge verified" title="Email ✓"><i class="fas fa-envelope"></i></span>' : ''}
                            ${user.is_roblox_verified ? `<span class="verify-badge verified" title="Roblox ✓">${getRobloxIcon(14)}</span>` : ''}
                        </div>
                    </div>
                    <div class="actions">
                        <button class="btn btn-glass btn-sm" data-action="edit" data-user-id="${user.id}" title="Редактировать">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${isBanned ? `
                            <button class="btn btn-success btn-sm" data-action="unban" data-user-id="${user.id}" title="Разбанить">
                                <i class="fas fa-unlock"></i>
                            </button>
                        ` : `
                            <button class="btn btn-danger btn-sm" data-action="ban" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" title="Забанить">
                                <i class="fas fa-ban"></i>
                            </button>
                        `}
                        ${user.is_muted ? `
                            <button class="btn btn-success btn-sm" data-action="unmute" data-user-id="${user.id}" title="Снять мут">
                                <i class="fas fa-volume-up"></i>
                            </button>
                        ` : `
                            <button class="btn btn-warning btn-sm" data-action="mute" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" title="Замутить">
                                <i class="fas fa-volume-mute"></i>
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
        
        // Setup event delegation - remove old handler if exists
        if (usersList._adminUsersClickHandler) {
            usersList.removeEventListener('click', usersList._adminUsersClickHandler);
        }
        
        // Create new click handler
        usersList._adminUsersClickHandler = function(e) {
            // Check if clicked on action button
            const actionBtn = e.target.closest('[data-action]');
            if (actionBtn) {
                e.stopPropagation();
                e.preventDefault();
                const action = actionBtn.getAttribute('data-action');
                const userId = actionBtn.getAttribute('data-user-id');
                
                if (action === 'edit') {
                    openAdminUserModal(userId);
                } else if (action === 'ban') {
                    const username = actionBtn.getAttribute('data-username');
                    banUser(userId, username);
                } else if (action === 'unban') {
                    unbanUser(userId);
                } else if (action === 'mute') {
                    const username = actionBtn.getAttribute('data-username');
                    muteUser(userId, username);
                } else if (action === 'unmute') {
                    unmuteUser(userId);
                }
                return false;
            }
            
            // Check if clicked on row (but not on actions area)
            const row = e.target.closest('.admin-user-row');
            const actionsArea = e.target.closest('.actions');
            if (row && !actionsArea) {
                const userId = row.getAttribute('data-user-id');
                if (userId) {
                    toggleUserSelectionByClick(userId);
                }
            }
        };
        
        usersList.addEventListener('click', usersList._adminUsersClickHandler);
        updateUsersSelectionUI();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function loadAdminPosts() {
    const status = document.getElementById('adminPostStatus')?.value || 'all';
    const category = document.getElementById('adminPostCategory')?.value || 'all';
    
    try {
        const data = await api.get(`/admin/posts?status=${status}&category=${category}&limit=50`);
        const posts = data.posts || [];
        
        if (posts.length === 0) {
            document.getElementById('adminPostsList').innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-file-alt"></i>
                    <p>Посты не найдены</p>
                </div>
            `;
            return;
        }
        
        document.getElementById('adminPostsList').innerHTML = posts.map(post => `
            <div class="admin-post-row">
                <input type="checkbox" class="post-checkbox" onchange="togglePostSelection('${post.id}', this.checked)" ${selectedPosts.has(post.id) ? 'checked' : ''} onclick="event.stopPropagation();">
                <div style="flex: 1; cursor: pointer;" onclick="viewPost('${post.id}'); closeAdminPanel();">
                    <span class="badge badge-category">${categoryNames[post.category] || post.category}</span>
                    <span class="title">${escapeHtml(post.title)}</span>
                    <span class="meta" style="color: var(--text-muted); font-size: 12px;">
                        ${escapeHtml(post.author?.username || 'Unknown')} • ${getTimeAgo(post.created_at)}
                    </span>
                    <span class="status-badge status-${post.status}">${post.status_text || post.status}</span>
                </div>
                <div class="actions" onclick="event.stopPropagation();">
                    <button class="btn btn-glass btn-sm ${post.is_pinned ? 'active' : ''}" onclick="togglePinPost('${post.id}')" title="${post.is_pinned ? 'Открепить' : 'Закрепить'}">
                        <i class="fas fa-thumbtack"></i>
                    </button>
                    <button class="btn btn-glass btn-sm ${post.is_hot ? 'active' : ''}" onclick="toggleHotPost('${post.id}')" title="${post.is_hot ? 'Убрать из горячего' : 'Сделать горячим'}">
                        <i class="fas fa-fire"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deletePostAdmin('${post.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function loadAdminActivity() {
    try {
        const search = document.getElementById('activitySearch')?.value || '';
        const actionFilter = document.getElementById('activityActionFilter')?.value || 'all';
        const dateFrom = document.getElementById('activityDateFrom')?.value || '';
        const dateTo = document.getElementById('activityDateTo')?.value || '';
        
        let activity = DB.getAll('activity_log');
        
        // Apply filters
        if (actionFilter !== 'all') {
            activity = activity.filter(a => a.action === actionFilter);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            activity = activity.filter(a => 
                (a.action && a.action.toLowerCase().includes(searchLower)) ||
                (a.details && a.details.toLowerCase().includes(searchLower)) ||
                (a.username && a.username.toLowerCase().includes(searchLower))
            );
        }
        
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            activity = activity.filter(a => new Date(a.created_at) >= fromDate);
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            activity = activity.filter(a => new Date(a.created_at) <= toDate);
        }
        
        // Sort and limit
        activity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        activity = activity.slice(0, 1000);
        
        // Add usernames
        activity = activity.map(a => {
            const user = DB.get('users', a.user_id);
            return { ...a, username: user ? user.username : 'Unknown' };
        });
        
        if (activity.length === 0) {
            document.getElementById('adminActivityList').innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-history"></i>
                    <p>Нет активности</p>
                </div>
            `;
            return;
        }
        
        document.getElementById('adminActivityList').innerHTML = activity.map(log => `
            <div class="admin-activity-row">
                <span class="time">${new Date(log.created_at).toLocaleString('ru-RU')}</span>
                <span class="user">${escapeHtml(log.username || 'Unknown')}</span>
                <span class="action">${getActionText(log.action)}: ${escapeHtml(log.details || '')}</span>
            </div>
        `).join('');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function exportActivityLog() {
    try {
        let activity = DB.getAll('activity_log');
        activity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        activity = activity.map(a => {
            const user = DB.get('users', a.user_id);
            return {
                ...a,
                username: user ? user.username : 'Unknown',
                date: new Date(a.created_at).toLocaleString('ru-RU')
            };
        });
        
        const dataStr = JSON.stringify(activity, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity_log_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Экспортировано', 'Лог активности сохранен');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function getActionText(action) {
    const actions = {
        'register': '📝 Регистрация',
        'login': '🔑 Вход',
        'logout': '🚪 Выход',
        'post_create': '📄 Создан пост',
        'post_delete': '🗑️ Удалён пост',
        'post_status_change': '📊 Изменён статус',
        'comment_create': '💬 Комментарий',
        'profile_update': '👤 Обновление профиля',
        'avatar_upload': '🖼️ Загрузка аватара',
        'email_verified': '✉️ Email подтверждён',
        'roblox_verified': '🎮 Roblox подтверждён',
        'role_change': '🛡️ Изменена роль',
        'user_ban': '🚫 Бан пользователя',
        'user_unban': '✅ Разбан пользователя',
        'user_delete': '❌ Удаление пользователя',
        'message_send': '✉️ Сообщение',
        'favorite_add': '⭐ В избранное',
        'post_pin': '📌 Закрепление поста',
        'post_hot': '🔥 Горячий пост'
    };
    return actions[action] || action;
}

async function openAdminUserModal(userId) {
    try {
        const user = await api.get(`/users/${userId}`);
        adminSelectedUser = user;
        
        const rolesResponse = await api.get('/admin/roles');
        const roles = Array.isArray(rolesResponse) ? rolesResponse : (rolesResponse.roles || Object.entries(ROLES_INFO).map(([id, info]) => ({ id, ...info })));
        
        document.getElementById('adminUserModal').classList.remove('hidden');
        document.getElementById('adminUserCard').innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
                <h3 style="margin: 0;">Редактирование пользователя</h3>
                <button class="btn btn-glass btn-sm" onclick="closeAdminUserModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="admin-user-info" style="margin-bottom: 20px;">
                <div class="admin-user-avatar">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : user.avatar}
                </div>
                <div class="admin-user-details">
                    <h3>${escapeHtml(user.username)}</h3>
                    <div class="admin-user-meta">
                        ${getRobloxIcon(14)} ${escapeHtml(user.roblox_nick)}<br>
                        <i class="fas fa-envelope"></i> ${escapeHtml(user.email || 'N/A')}<br>
                        <i class="fas fa-star"></i> Репутация: ${user.reputation}
                    </div>
                </div>
            </div>
            
            <div class="admin-user-badges" style="margin-bottom: 20px;">
                ${renderRoleBadge(user.role, user.roleInfo)}
                ${user.is_email_verified ? '<span class="verify-badge verified"><i class="fas fa-envelope"></i> Email ✓</span>' : '<span class="verify-badge unverified"><i class="fas fa-envelope"></i> Email ✗</span>'}
                ${user.is_roblox_verified ? `<span class="verify-badge verified">${getRobloxIcon(14)} Roblox ✓</span>` : `<span class="verify-badge unverified">${getRobloxIcon(14)} Roblox ✗</span>`}
            </div>
            
            <div class="admin-roles-section">
                <h4><i class="fas fa-users-cog"></i> Изменить роль</h4>
                <div class="admin-roles-grid">
                    ${roles.map(role => `
                        <button class="admin-role-btn role-${role.id} ${user.role === role.id ? 'active' : ''}" 
                                onclick="changeUserRole('${user.id}', '${role.id}')">
                            <i class="fas ${role.icon}"></i>
                            <span>${role.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-danger" onclick="deleteUserAdmin('${user.id}', '${escapeHtml(user.username)}')">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        `;
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function closeAdminUserModal() {
    document.getElementById('adminUserModal').classList.add('hidden');
    adminSelectedUser = null;
}

async function changeUserRole(userId, role) {
    try {
        await api.put(`/admin/users/${userId}/role`, { role });
        showToast('success', 'Успешно', 'Роль изменена');
        closeAdminUserModal();
        loadAdminUsers();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

let banTargetUserId = null;
let banTargetUsername = null;

function banUser(userId, username) {
    banTargetUserId = userId;
    banTargetUsername = username;
    document.getElementById('banUserName').textContent = username;
    document.getElementById('banReasonInput').value = '';
    document.getElementById('banReasonModal').classList.remove('hidden');
}

function closeBanModal() {
    document.getElementById('banReasonModal').classList.add('hidden');
    banTargetUserId = null;
    banTargetUsername = null;
}

async function confirmBan() {
    if (!banTargetUserId) return;
    
    const reason = document.getElementById('banReasonInput').value.trim() || 'Нарушение правил';
    
    try {
        await api.post(`/admin/users/${banTargetUserId}/ban`, { reason });
        showToast('success', 'Забанен', `Пользователь ${banTargetUsername} забанен`);
        closeBanModal();
        loadAdminUsers();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function unbanUser(userId) {
    try {
        await api.post(`/admin/users/${userId}/unban`);
        showToast('success', 'Разбанен', 'Пользователь разбанен');
        loadAdminUsers();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

let muteTargetUserId = null;
let muteTargetUsername = null;

function muteUser(userId, username) {
    muteTargetUserId = userId;
    muteTargetUsername = username;
    document.getElementById('muteUserName').textContent = username;
    document.getElementById('muteReasonInput').value = '';
    document.getElementById('muteDurationInput').value = '';
    document.getElementById('muteReasonModal').classList.remove('hidden');
}

function closeMuteModal() {
    document.getElementById('muteReasonModal').classList.add('hidden');
    document.getElementById('muteReasonInput').value = '';
    document.getElementById('muteDurationInput').value = '';
    muteTargetUserId = null;
    muteTargetUsername = null;
}

async function confirmMute() {
    if (!muteTargetUserId) return;
    
    const reason = document.getElementById('muteReasonInput').value.trim();
    if (!reason) {
        showToast('error', 'Ошибка', 'Необходимо указать причину мута');
        return;
    }
    
    const durationInput = document.getElementById('muteDurationInput').value.trim();
    const duration = durationInput ? parseInt(durationInput) : null;
    
    if (duration !== null && (isNaN(duration) || duration < 1)) {
        showToast('error', 'Ошибка', 'Длительность должна быть положительным числом');
        return;
    }
    
    try {
        await api.post(`/admin/users/${muteTargetUserId}/mute`, { reason, duration });
        showToast('success', 'Замучен', `Пользователь ${muteTargetUsername} замучен${duration ? ` на ${duration} минут` : ''}`);
        closeMuteModal();
        loadAdminUsers();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function unmuteUser(userId) {
    showConfirm('Снять мут', 'Снять мут с этого пользователя?', async () => {
        try {
            await api.post(`/admin/users/${userId}/unmute`);
            showToast('success', 'Мут снят', 'Мут успешно снят');
            loadAdminUsers();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

async function deleteUserAdmin(userId, username) {
    showConfirm('Удаление пользователя', `Вы уверены, что хотите УДАЛИТЬ пользователя ${username}?\n\nЭто действие нельзя отменить!`, () => {
        showConfirm('Повторное подтверждение', `Удалить ${username} и все его данные?`, async () => {
            try {
                await api.delete(`/admin/users/${userId}`);
                showToast('success', 'Удалён', `Пользователь ${username} удалён`);
                closeAdminUserModal();
                loadAdminUsers();
            } catch (error) {
                showToast('error', 'Ошибка', error.message);
            }
        });
    });
    return;
    
    try {
        await api.delete(`/admin/users/${userId}`);
        showToast('success', 'Удалён', `Пользователь ${username} удалён`);
        closeAdminUserModal();
        loadAdminUsers();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function togglePinPost(postId) {
    try {
        const result = await api.post(`/admin/posts/${postId}/pin`);
        showToast('success', result.pinned ? 'Закреплено' : 'Откреплено', '');
        loadAdminPosts();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function toggleHotPost(postId) {
    try {
        const result = await api.post(`/admin/posts/${postId}/hot`);
        showToast('success', result.hot ? 'Отмечено горячим' : 'Снято с горячего', '');
        loadAdminPosts();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function deletePostAdmin(postId) {
    showConfirm('Удаление поста', 'Удалить этот пост?', async () => {
        try {
            await api.delete(`/posts/${postId}`);
            showToast('success', 'Удалено', 'Пост удалён');
            loadAdminPosts();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

// ROLES_INFO is already defined above

// ===== STAFF MANAGEMENT =====
async function loadStaffList() {
    try {
        const data = await api.get('/admin/users/list?limit=200');
        const users = data.users;
        
        const management = users.filter(u => u.role === 'management');
        const managers = users.filter(u => u.role === 'manager');
        const seniorAdmins = users.filter(u => u.role === 'senior_admin');
        const admins = users.filter(u => u.role === 'admin');
        const moderators = users.filter(u => u.role === 'moderator');
        const helpers = users.filter(u => u.role === 'helper');
        
        renderStaffList('staffManagement', management, 'management');
        renderStaffList('staffManagers', managers, 'manager');
        renderStaffList('staffSeniorAdmins', seniorAdmins, 'senior_admin');
        renderStaffList('staffAdmins', admins, 'admin');
        renderStaffList('staffModerators', moderators, 'moderator');
        renderStaffList('staffHelpers', helpers, 'helper');
        
        // Populate role dropdown based on current user level
        populateStaffRoleSelect();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function populateStaffRoleSelect() {
    const select = document.getElementById('staffRole');
    if (!select || !currentUser) return;
    
    const currentLevel = currentUser.roleInfo?.level || 0;
    
    select.innerHTML = '<option value="">Выберите роль...</option>';
    
    // Only show roles lower than current user's level
    if (currentLevel > 1) {
        select.innerHTML += '<option value="helper">🤝 Хелпер</option>';
    }
    if (currentLevel > 2) {
        select.innerHTML += '<option value="moderator">🛡️ Модератор</option>';
    }
    if (currentLevel > 3) {
        select.innerHTML += '<option value="admin">👑 Администратор</option>';
    }
    if (currentLevel > 3.5) {
        select.innerHTML += '<option value="senior_admin">👑 Старший администратор</option>';
    }
    if (currentLevel > 4) {
        select.innerHTML += '<option value="manager">💼 Менеджер проекта</option>';
    }
    if (currentLevel > 4) { // Only super-admin could add management
        select.innerHTML += '<option value="management">⭐ Руководство</option>';
    }
    
    if (currentLevel <= 1) {
        select.innerHTML = '<option value="">Недостаточно прав</option>';
        select.disabled = true;
    }
}

function renderStaffList(containerId, users, role) {
    const container = document.getElementById(containerId);
    
    if (users.length === 0) {
        container.innerHTML = '<div class="staff-empty">Нет пользователей</div>';
        return;
    }
    
    container.innerHTML = users.map(user => {
        const isCurrentUser = currentUser && currentUser.id === user.id;
        const isManagement = role === 'management';
        const canDemote = !isCurrentUser && !isManagement;
        
        return `
            <div class="staff-member">
                <div class="avatar">
                    ${user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : user.avatar || '🎮'}
                </div>
                <span class="name">${escapeHtml(user.username)}${isCurrentUser ? ' <span style="color: var(--text-muted);">(вы)</span>' : ''}</span>
                ${canDemote ? `
                    <button class="btn btn-danger btn-sm demote-btn" onclick="demoteStaff('${user.id}', '${escapeHtml(user.username)}', '${role}')" title="Снять роль">
                        <i class="fas fa-user-minus"></i>
                    </button>
                ` : isManagement ? `
                    <span class="verify-badge verified" title="Защищён"><i class="fas fa-lock"></i></span>
                ` : ''}
            </div>
        `;
    }).join('');
}

function updateStaffRoleOptions() {
    const select = document.getElementById('staffRole');
    if (!select || !currentUser) return;
    
    const currentLevel = currentUser.roleInfo?.level || 0;
    
    // Disable options that are >= current user level
    Array.from(select.options).forEach(option => {
        if (option.value) {
            const roleLevel = ROLES_INFO[option.value]?.level || 0;
            option.disabled = roleLevel >= currentLevel;
            if (option.disabled) {
                option.textContent = option.textContent.replace(' (недоступно)', '') + ' (недоступно)';
            }
        }
    });
}

function updateApplicationRoleOptions() {
    const currentLevel = currentUser?.roleInfo?.level || 0;
    
    document.querySelectorAll('.app-role-select').forEach(select => {
        Array.from(select.options).forEach(option => {
            if (option.value) {
                const roleLevel = ROLES_INFO[option.value]?.level || 0;
                option.disabled = roleLevel >= currentLevel;
            }
        });
    });
}

async function assignStaffRole() {
    const username = document.getElementById('staffUsername').value.trim();
    const role = document.getElementById('staffRole').value;
    
    if (!username) {
        showToast('error', 'Ошибка', 'Введите логин пользователя');
        return;
    }
    
    if (!role) {
        showToast('error', 'Ошибка', 'Выберите роль');
        return;
    }
    
    try {
        // First find the user
        let user;
        try {
            user = await api.get(`/admin/users/search/${encodeURIComponent(username)}`);
        } catch (e) {
            showToast('error', 'Не найден', `Пользователь "${username}" не найден`);
            return;
        }
        
        if (!user || !user.id) {
            showToast('error', 'Не найден', `Пользователь "${username}" не найден`);
            return;
        }
        
        // Then assign the role
        await api.put(`/admin/users/${user.id}/role`, { role });
        
        showToast('success', 'Роль назначена', `${username} теперь ${ROLES_INFO[role]?.name || role}`);
        
        // Clear form
        document.getElementById('staffUsername').value = '';
        document.getElementById('staffRole').value = '';
        
        // Reload staff list
        loadStaffList();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== ADMIN APPLICATIONS =====

// Check if current user can manage applications (moderator+)
function canManageApplications() {
    const level = currentUser?.roleInfo?.level || 0;
    return level >= 2; // moderator = 2, admin = 3, management = 4
}

// Get available roles that current user can assign
function getAvailableRolesOptions() {
    const currentLevel = currentUser?.roleInfo?.level || 0;
    let options = '';
    
    if (currentLevel > 1) { // Can assign helper
        options += '<option value="helper">🤝 Хелпер</option>';
    }
    if (currentLevel > 2) { // Can assign moderator (admin+)
        options += '<option value="moderator">🛡️ Модератор</option>';
    }
    if (currentLevel > 3) { // Can assign admin (project_manager+)
        options += '<option value="admin">👑 Администратор</option>';
    }
    if (currentLevel > 4) { // Can assign project_manager (management only)
        options += '<option value="project_manager">💼 Менеджер проекта</option>';
    }
    if (currentLevel >= 5) { // Can assign management (management only)
        options += '<option value="management">⭐ Руководство</option>';
    }
    
    return options || '<option value="helper">🤝 Хелпер</option>';
}

async function loadAdminApplications() {
    const status = document.getElementById('adminAppStatus')?.value || 'pending';
    
    try {
        const applications = await api.get(`/admin/applications?status=${status}`);
        
        // Update badge count
        const countData = await api.get('/admin/applications/count');
        const countBadge = document.getElementById('applicationsCount');
        if (countBadge) {
            if (countData.count > 0) {
                countBadge.textContent = countData.count;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }
        
        const container = document.getElementById('adminApplicationsList');
        
        if (applications.length === 0) {
            container.innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-file-signature"></i>
                    <p>${status === 'pending' ? 'Нет новых заявок' : 'Заявки не найдены'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = applications.map(app => `
            <div class="application-card ${app.status}">
                <div class="application-header">
                    <div class="application-user">
                        <div class="avatar">
                            ${app.avatar_url ? `<img src="${app.avatar_url}" alt="">` : app.avatar || '🎮'}
                        </div>
                        <div class="info">
                            <div class="name">${escapeHtml(app.username || 'Unknown')}</div>
                            <div class="meta">Roblox: ${escapeHtml(app.nick)} • Discord: ${escapeHtml(app.discord)}</div>
                        </div>
                    </div>
                    <div class="application-status">
                        ${app.status === 'pending' ? '<span class="status-badge status-open">Ожидает</span>' : 
                          app.status === 'approved' ? '<span class="status-badge status-approved">Одобрена</span>' : 
                          '<span class="status-badge status-rejected">Отклонена</span>'}
                    </div>
                </div>
                
                <div class="application-details">
                    <div class="detail-row">
                        <span class="label"><i class="fas fa-birthday-cake"></i> Возраст:</span>
                        <span class="value">${app.age} лет</span>
                    </div>
                    <div class="detail-row">
                        <span class="label"><i class="fas fa-clock"></i> Онлайн:</span>
                        <span class="value">${escapeHtml(app.hours)}</span>
                    </div>
                    ${app.experience ? `
                        <div class="detail-row">
                            <span class="label"><i class="fas fa-briefcase"></i> Опыт:</span>
                            <span class="value">${escapeHtml(app.experience)}</span>
                        </div>
                    ` : ''}
                    <div class="detail-row full">
                        <span class="label"><i class="fas fa-comment"></i> Почему хочет в команду:</span>
                        <span class="value">${escapeHtml(app.reason)}</span>
                    </div>
                </div>
                
                <div class="application-footer">
                    <span class="date"><i class="fas fa-calendar"></i> ${new Date(app.created_at).toLocaleString('ru-RU')}</span>
                    ${app.status === 'pending' && canManageApplications() ? `
                        <div class="actions">
                            <select id="appRole_${app.id}" class="app-role-select">
                                ${getAvailableRolesOptions()}
                            </select>
                            <button class="btn btn-success btn-sm" onclick="approveApplication('${app.id}')">
                                <i class="fas fa-check"></i> Принять
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectApplication('${app.id}')">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                        </div>
                    ` : app.status === 'pending' ? '<span class="text-muted">Только модератор+ может рассматривать</span>' : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function approveApplication(appId) {
    const roleSelect = document.getElementById(`appRole_${appId}`);
    const role = roleSelect?.value || 'helper';
    
    showConfirm('Одобрение заявки', `Одобрить заявку и назначить роль "${ROLES_INFO[role].name}"?`, async () => {
        try {
            await api.post(`/admin/applications/${appId}/approve`, { role });
            showToast('success', 'Одобрено', 'Заявка одобрена, роль назначена');
            loadAdminApplications();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

let rejectTargetAppId = null;

function rejectApplication(appId) {
    rejectTargetAppId = appId;
    rejectTargetVerId = null; // Сбрасываем верификацию
    document.getElementById('rejectReasonInput').value = '';
    const modal = document.getElementById('rejectReasonModal');
    const title = modal.querySelector('h3');
    if (title) title.innerHTML = '<i class="fas fa-times-circle"></i> Отклонить заявку';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeRejectModal() {
    document.getElementById('rejectReasonModal').classList.remove('active');
    document.body.style.overflow = '';
    rejectTargetAppId = null;
    rejectTargetVerId = null;
}

async function confirmReject() {
    const reason = document.getElementById('rejectReasonInput').value.trim();
    
    // Проверяем, какой тип отклонения (заявка или верификация)
    if (rejectTargetAppId) {
        try {
            await api.post(`/admin/applications/${rejectTargetAppId}/reject`, { reason });
            showToast('info', 'Отклонено', 'Заявка отклонена');
            closeRejectModal();
            loadAdminApplications();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    } else if (rejectTargetVerId) {
        try {
            await api.post(`/admin/verifications/${rejectTargetVerId}/reject`, { reason });
            showToast('info', 'Отклонено', 'Верификация отклонена');
            closeRejectModal();
            loadAdminVerifications();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    }
}

// ===== ADMIN VERIFICATIONS =====

async function loadAdminVerifications() {
    const status = document.getElementById('adminVerStatus')?.value || 'pending';
    
    try {
        const verifications = await api.get(`/admin/verifications?status=${status}`);
        
        // Update badge count
        const countData = await api.get('/admin/verifications/count');
        const countBadge = document.getElementById('verificationsCount');
        if (countBadge) {
            if (countData.count > 0) {
                countBadge.textContent = countData.count;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
            }
        }
        
        const container = document.getElementById('adminVerificationsList');
        
        if (verifications.length === 0) {
            container.innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-check-circle"></i>
                    <p>${status === 'pending' ? 'Нет новых верификаций' : 'Верификации не найдены'}</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = verifications.map(ver => {
            const user = ver.user;
            return `
            <div class="application-card ${ver.status}">
                <div class="application-header">
                    <div class="application-user">
                        <div class="avatar">
                            ${user && user.avatar_url ? `<img src="${user.avatar_url}" alt="">` : (user && user.avatar) || '🎮'}
                        </div>
                        <div class="info">
                            <div class="name">${escapeHtml(ver.username || 'Unknown')}</div>
                            <div class="meta">${getRobloxIcon(14)} Roblox: ${escapeHtml(ver.roblox_nick || '')} • User ID: ${escapeHtml(ver.roblox_user_id || '')}</div>
                        </div>
                    </div>
                    <div class="application-status">
                        ${ver.status === 'pending' ? '<span class="status-badge status-open">Ожидает</span>' : 
                          ver.status === 'approved' ? '<span class="status-badge status-approved">Одобрена</span>' : 
                          '<span class="status-badge status-rejected">Отклонена</span>'}
                    </div>
                </div>
                
                <div class="application-details">
                    <div class="detail-row">
                        <span class="label"><i class="fas fa-user"></i> Ник Roblox:</span>
                        <span class="value">${escapeHtml(ver.roblox_nick || '')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label"><i class="fas fa-id-card"></i> User ID:</span>
                        <span class="value">${escapeHtml(ver.roblox_user_id || '')}</span>
                    </div>
                    ${ver.reject_reason ? `
                        <div class="detail-row full">
                            <span class="label"><i class="fas fa-comment"></i> Причина отклонения:</span>
                            <span class="value">${escapeHtml(ver.reject_reason)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="application-footer">
                    <span class="date"><i class="fas fa-calendar"></i> ${new Date(ver.created_at).toLocaleString('ru-RU')}</span>
                    ${ver.status === 'pending' && canManageApplications() ? `
                        <div class="actions">
                            <button class="btn btn-success btn-sm" onclick="approveVerification('${ver.id}')">
                                <i class="fas fa-check"></i> Принять
                            </button>
                            <button class="btn btn-danger btn-sm" onclick="rejectVerification('${ver.id}')">
                                <i class="fas fa-times"></i> Отклонить
                            </button>
                        </div>
                    ` : ver.status === 'pending' ? '<span class="text-muted">Только модератор+ может рассматривать</span>' : ''}
                </div>
            </div>
        `}).join('');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function approveVerification(verId) {
    showConfirm('Одобрение верификации', `Одобрить верификацию Roblox?`, async () => {
        try {
            await api.post(`/admin/verifications/${verId}/approve`);
            showToast('success', 'Одобрено', 'Верификация одобрена');
            loadAdminVerifications();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

let rejectTargetVerId = null;

function rejectVerification(verId) {
    rejectTargetVerId = verId;
    rejectTargetAppId = null; // Сбрасываем заявку
    document.getElementById('rejectReasonInput').value = '';
    const modal = document.getElementById('rejectReasonModal');
    const title = modal.querySelector('h3');
    if (title) title.innerHTML = '<i class="fas fa-times-circle"></i> Отклонить верификацию';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

async function demoteStaff(userId, username, currentRole) {
    // Check if trying to demote self
    if (currentUser && currentUser.id === userId) {
        showToast('error', 'Ошибка', 'Нельзя снять роль с себя');
        return;
    }
    
    // Check if trying to demote management
    const targetUserLevel = ROLES_INFO[currentRole]?.level || 0;
    if (targetUserLevel >= 5) {
        showToast('error', 'Ошибка', 'Нельзя снять роль с руководства проекта');
        return;
    }
    
    showConfirm('Снятие роли', `Снять роль "${ROLES_INFO[currentRole].name}" с пользователя ${username}?\n\nОн станет обычным пользователем.`, async () => {
        try {
            await api.put(`/admin/users/${userId}/role`, { role: 'user' });
            showToast('success', 'Роль снята', `${username} теперь обычный пользователь`);
            closeAdminUserModal();
            loadAdminUsers();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

// ===== PROFILE =====
async function openProfile(userId = null) {
    closeUserMenu();
    
    const profileUserId = userId || (currentUser ? currentUser.id : null);
    if (!profileUserId) {
        showToast('error', 'Ошибка', 'Пользователь не найден');
        return;
    }
    
    try {
        const profileUser = await api.get(`/users/${profileUserId}`);
        const userPosts = await api.get(`/users/${profileUserId}/posts`);
        
        document.getElementById('heroSection')?.classList.add('hidden');
        document.getElementById('forum')?.classList.add('hidden');
        document.getElementById('postView')?.classList.add('hidden');
        document.getElementById('profileSection')?.classList.remove('hidden');
        
        const statsGrid = document.querySelector('.profile-stats-grid');
        if (statsGrid) statsGrid.classList.remove('hidden');
        
        const avatarEl = document.getElementById('profileAvatar');
        if (avatarEl) {
            if (profileUser.avatar_url) {
                avatarEl.innerHTML = `<img src="${profileUser.avatar_url}" alt="">`;
            } else {
                avatarEl.innerHTML = '';
                avatarEl.textContent = profileUser.avatar || '🎮';
            }
        }
        
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.textContent = profileUser.username;
        
        const robloxEl = document.getElementById('profileRoblox');
        if (robloxEl) robloxEl.textContent = profileUser.roblox_nick || '';
        
        const dateEl = document.getElementById('profileDate');
        if (dateEl) dateEl.textContent = new Date(profileUser.created_at).toLocaleDateString('ru-RU');
        
    const badgesEl = document.querySelector('.profile-badges');
    if (badgesEl) {
            let badgeHTML = renderRoleBadge(profileUser.role, profileUser.roleInfo);
            badgeHTML += `<span class="profile-badge reputation" title="Репутация"><i class="fas fa-star"></i> ${profileUser.reputation || 0}</span>`;
            
            const isOwnProfile = currentUser && currentUser.id === profileUserId;
            if (isOwnProfile) {
                if (profileUser.is_email_verified) {
                    badgeHTML += '<span class="verify-badge verified"><i class="fas fa-envelope"></i> Email ✓</span>';
        } else {
                    badgeHTML += '<span class="verify-badge unverified" onclick="openEmailVerifyModal()"><i class="fas fa-envelope"></i> Подтвердить email</span>';
                }
                
                if (profileUser.is_roblox_verified) {
                    badgeHTML += `<span class="verify-badge verified">${getRobloxIcon(14)} Roblox ✓</span>`;
                } else {
                    badgeHTML += `<span class="verify-badge unverified" onclick="openRobloxVerifyModal()">${getRobloxIcon(14)} Верифицировать Roblox</span>`;
                }
            } else {
                if (profileUser.is_roblox_verified) {
                    badgeHTML += `<span class="verify-badge verified">${getRobloxIcon(14)} Roblox ✓</span>`;
                }
            }
            
        badgesEl.innerHTML = badgeHTML;
    }
    
        const profileMeta = document.querySelector('.profile-meta');
        if (profileMeta) {
            profileMeta.innerHTML = `
                ${profileUser.roblox_nick ? `<span>${getRobloxIcon(14)} <span id="profileRoblox">${profileUser.roblox_nick}</span></span>` : ''}
                ${profileUser.rod ? `<span><i class="fas fa-map-marker-alt"></i> <span id="profileRod">${escapeHtml(profileUser.rod)}</span></span>` : ''}
                ${profileUser.discord ? `<span><i class="fab fa-discord"></i> <span id="profileDiscord">${escapeHtml(profileUser.discord)}</span></span>` : ''}
                <span><i class="fas fa-calendar"></i> <span id="profileDate">${new Date(profileUser.created_at).toLocaleDateString('ru-RU')}</span></span>
            `;
        }
        
        const postsEl = document.getElementById('profilePosts');
        if (postsEl) postsEl.textContent = profileUser.postsCount || 0;
        
        const commentsEl = document.getElementById('profileComments');
        if (commentsEl) commentsEl.textContent = profileUser.commentsCount || 0;
        
        const viewsEl = document.getElementById('profileViews');
        if (viewsEl) viewsEl.textContent = profileUser.viewsSum || 0;
        
    const actionsEl = document.getElementById('profileActions');
        if (actionsEl) {
            if (currentUser && currentUser.id === profileUserId) {
        actionsEl.innerHTML = `
            <button class="btn btn-glass" onclick="openProfileSettings()">
                <i class="fas fa-cog"></i> Настройки профиля
            </button>
        `;
            } else if (currentUser) {
                actionsEl.innerHTML = `
                    <button class="btn btn-primary" onclick="openMessageModal('${profileUserId}', '${escapeHtml(profileUser.username)}')">
                        <i class="fas fa-envelope"></i> Написать
                    </button>
                    <button class="btn btn-glass" onclick="giveReputation('${profileUserId}', 'like')">
                        <i class="fas fa-thumbs-up"></i>
            </button>
        `;
    } else {
        actionsEl.innerHTML = '';
            }
    }
    
    const postsListEl = document.getElementById('profilePostsList');
        if (postsListEl) {
    if (userPosts.length === 0) {
        postsListEl.innerHTML = '<div class="profile-empty"><i class="fas fa-inbox"></i><p>Пользователь ещё не создал ни одной темы</p></div>';
    } else {
                postsListEl.innerHTML = userPosts.map(post => `
            <div class="profile-post-item" onclick="viewPost('${post.id}')">
                <div>
                    <div class="profile-post-title">${escapeHtml(post.title)}</div>
                    <div class="profile-post-meta">
                                <span class="badge-category">${categoryNames[post.category] || post.category}</span> • 
                                ${getTimeAgo(post.created_at)}
                    </div>
                </div>
                        <span class="status-badge status-${post.status}">${post.status_text || post.status}</span>
            </div>
        `).join('');
            }
    }
    
    window.scrollTo(0, 0);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function openMyPosts() {
    closeUserMenu();
    if (!currentUser) return;
    
    try {
        // Проверяем наличие тем у пользователя
        const userPosts = await api.get(`/users/${currentUser.id}/posts`);
        
        if (userPosts.length === 0) {
            showToast('info', 'Нет тем', 'У вас пока нет созданных тем. Создайте первую тему на форуме!');
            return;
        }
        
        // Если есть темы, открываем профиль
    openProfile(currentUser.id);
    } catch (error) {
        showToast('error', 'Ошибка', 'Не удалось загрузить ваши темы');
    }
}

// ===== PROFILE SETTINGS =====
function openProfileSettings() {
    closeUserMenu();
    if (!currentUser) return;
    
    document.getElementById('profileSettingsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    document.getElementById('settingsUsername').value = currentUser.username || '';
    document.getElementById('settingsRoblox').value = currentUser.roblox_nick || '';
    document.getElementById('settingsDiscord').value = currentUser.discord || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';
    
    // Render avatar upload area
    const avatarGrid = document.getElementById('avatarGrid');
    avatarGrid.innerHTML = `
        <div class="avatar-upload-area" style="grid-column: 1 / -1; margin-bottom: 20px;">
            <div class="avatar-preview" id="settingsAvatarPreview">
                ${currentUser.avatar_url ? `<img src="${currentUser.avatar_url}" alt="">` : currentUser.avatar}
            </div>
            <label class="avatar-upload-btn">
                <i class="fas fa-camera"></i>
                <input type="file" accept="image/*" onchange="uploadAvatar(this)">
            </label>
        </div>
        <p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">Или выберите эмодзи:</p>
        ${avatars.map(avatar => `
            <button type="button" class="avatar-option ${!currentUser.avatar_url && avatar === currentUser.avatar ? 'selected' : ''}" 
                onclick="selectAvatar('${avatar}', this)">
            ${avatar}
        </button>
        `).join('')}
    `;
}

function closeProfileSettingsModal() {
    document.getElementById('profileSettingsModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ===== SITE SETTINGS =====
function openSettings() {
    closeUserMenu();
    
    document.getElementById('siteSettingsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Загружаем сохраненные настройки
    const language = localStorage.getItem('siteLanguage') || 'ru';
    const theme = localStorage.getItem('siteTheme') || 'dark';
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    const emailNotifications = localStorage.getItem('emailNotifications') === 'true';
    const cookiesAccepted = localStorage.getItem('cookiesAccepted') !== 'false';
    
    document.getElementById('siteLanguage').value = language;
    document.getElementById('siteTheme').value = theme;
    document.getElementById('notificationsEnabled').checked = notificationsEnabled;
    document.getElementById('emailNotifications').checked = emailNotifications;
    document.getElementById('cookiesAccepted').checked = cookiesAccepted;
}

function closeSiteSettingsModal() {
    document.getElementById('siteSettingsModal').classList.remove('active');
    document.body.style.overflow = '';
}

async function saveSiteSettings(event) {
    event.preventDefault();
    
    const language = document.getElementById('siteLanguage').value;
    const theme = document.getElementById('siteTheme').value;
    const notificationsEnabled = document.getElementById('notificationsEnabled').checked;
    const emailNotifications = document.getElementById('emailNotifications').checked;
    const cookiesAccepted = document.getElementById('cookiesAccepted').checked;
    
    localStorage.setItem('siteLanguage', language);
    localStorage.setItem('siteTheme', theme);
    localStorage.setItem('notificationsEnabled', notificationsEnabled);
    localStorage.setItem('emailNotifications', emailNotifications);
    localStorage.setItem('cookiesAccepted', cookiesAccepted);
    
    // Применяем изменения
    changeLanguage(language);
    applyTheme(theme);
    
    closeSiteSettingsModal();
    showToast('success', 'Сохранено', 'Настройки сайта успешно обновлены');
}

function changeLanguage(lang) {
    localStorage.setItem('siteLanguage', lang);
    // Здесь можно добавить логику переключения языка
    // Пока что просто сохраняем выбор
    if (lang === 'en') {
        document.documentElement.lang = 'en';
    } else {
        document.documentElement.lang = 'ru';
    }
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function clearCookies() {
    showConfirm('Очистка cookies', 'Вы уверены, что хотите очистить все cookies? Это может потребовать повторной авторизации.', () => {
        // Очищаем только настройки сайта, не трогая токены авторизации
        localStorage.removeItem('siteLanguage');
        localStorage.removeItem('siteTheme');
        localStorage.removeItem('notificationsEnabled');
        localStorage.removeItem('emailNotifications');
        localStorage.removeItem('cookiesAccepted');
        
        document.getElementById('cookiesAccepted').checked = false;
        showToast('success', 'Очищено', 'Cookies успешно очищены');
    });
}

// ===== DELETE ACCOUNT =====
function openDeleteAccountModal() {
    closeProfileSettingsModal();
    document.getElementById('deleteAccountModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('deleteAccountPassword').value = '';
    document.getElementById('deleteAccountConfirm').checked = false;
}

function closeDeleteAccountModal() {
    document.getElementById('deleteAccountModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('deleteAccountPassword').value = '';
    document.getElementById('deleteAccountConfirm').checked = false;
}

async function confirmDeleteAccount() {
    if (!currentUser) return;
    
    const password = document.getElementById('deleteAccountPassword').value;
    const confirmed = document.getElementById('deleteAccountConfirm').checked;
    
    if (!password) {
        showToast('error', 'Ошибка', 'Введите пароль для подтверждения');
            return;
        }
    
    if (!confirmed) {
        showToast('error', 'Ошибка', 'Подтвердите удаление аккаунта');
            return;
        }
    
    try {
        await api.post(`/users/${currentUser.id}/delete-account`, { password });
        
        // Удаляем профиль из сохраненных
        savedProfiles = savedProfiles.filter(p => p.id !== currentUser.id);
        saveProfiles();
        
        // Разлогиниваем
        api.setToken(null);
        currentUser = null;
        localStorage.removeItem('urp_user');
        localStorage.removeItem('urp_token');
        
        closeDeleteAccountModal();
        updateAuthUI();
        showToast('success', 'Аккаунт удален', 'Ваш аккаунт был успешно удален');
        
        // Перезагружаем страницу через 2 секунды
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

let selectedAvatar = null;
function selectAvatar(avatar, btn) {
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    selectedAvatar = avatar;
    
    // Update preview
    document.getElementById('settingsAvatarPreview').innerHTML = avatar;
}

async function uploadAvatar(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
        showToast('error', 'Ошибка', 'Файл слишком большой (макс. 5MB)');
            return;
        }
    
    try {
        const response = await api.uploadFile('/users/avatar/upload', file, 'avatar');
        currentUser.avatar_url = response.avatar_url || response.avatarUrl;
        currentUser.avatar = null;
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
        
        const avatarUrl = response.avatar_url || response.avatarUrl;
        document.getElementById('settingsAvatarPreview').innerHTML = `<img src="${avatarUrl}" alt="">`;
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        
        updateAuthUI();
        showToast('success', 'Загружено', 'Аватар обновлён');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function saveSettings(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const username = document.getElementById('settingsUsername').value.trim();
    const robloxNick = document.getElementById('settingsRoblox').value.trim();
    const discord = document.getElementById('settingsDiscord').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();
    const currentPassword = document.getElementById('settingsCurrentPassword').value;
    const newPassword = document.getElementById('settingsNewPassword').value;
    
    try {
        const updates = { username, robloxNick, discord, email };
        if (selectedAvatar) updates.avatar = selectedAvatar;
        if (newPassword) {
            updates.currentPassword = currentPassword;
            updates.newPassword = newPassword;
        }
        
        const updatedUser = await api.put(`/users/${currentUser.id}`, updates);
        currentUser = { ...currentUser, ...updatedUser };
        localStorage.setItem('urp_user', JSON.stringify(currentUser));
    
    updateAuthUI();
    closeProfileSettingsModal();
    showToast('success', 'Сохранено', 'Настройки успешно обновлены');
    
    document.getElementById('settingsCurrentPassword').value = '';
    document.getElementById('settingsNewPassword').value = '';
    
    if (!document.getElementById('profileSection').classList.contains('hidden')) {
        openProfile();
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== POSTS =====
function handleCreatePost() {
    if (!currentUser) {
        showToast('info', 'Требуется вход', 'Войдите в аккаунт, чтобы создать тему');
        openAuthModal('login');
        return;
    }
    openCreateModal();
}

function openCreateModal() {
    document.getElementById('createPostModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    goToStep1();
}

function closeCreateModal() {
    document.getElementById('createPostModal').classList.remove('active');
    document.body.style.overflow = '';
    resetPostForm();
}

function goToStep1() {
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('modalStep').textContent = 'Шаг 1 из 2';
}

function selectPostCategory(category) {
    selectedPostCategory = category;
    
    document.getElementById('step1').classList.add('hidden');
    document.getElementById('step2').classList.remove('hidden');
    document.getElementById('modalStep').textContent = 'Шаг 2 из 2';
    document.getElementById('selectedCategoryBadge').textContent = categoryFormNames[category];
    
    document.querySelectorAll('.form-fields').forEach(f => f.classList.add('hidden'));
    document.getElementById(category + 'Fields').classList.remove('hidden');
}

function resetPostForm() {
    selectedPostCategory = null;
    document.querySelectorAll('#postForm input, #postForm textarea, #postForm select').forEach(el => {
        if (el.type !== 'submit') el.value = '';
    });
}

async function submitPost(e) {
    e.preventDefault();
    
    if (!currentUser || !selectedPostCategory) return;
    
    let title = '';
    let content = '';
    let extraData = {};
    
    switch (selectedPostCategory) {
        case 'complaint':
            const violatorNick = document.getElementById('violatorNick').value.trim();
            const violationRule = document.getElementById('violationRule').value;
            const violationDate = document.getElementById('violationDate').value;
            const violationDesc = document.getElementById('violationDesc').value.trim();
            const proofLink = document.getElementById('proofLink').value.trim();
            
            if (!violatorNick || !violationDesc || !proofLink) {
                showToast('error', 'Ошибка', 'Заполните все обязательные поля и приложите доказательства');
                return;
            }
            
            title = `Жалоба на игрока ${violatorNick}`;
            content = `**Ник нарушителя:** ${violatorNick}\n**Нарушенное правило:** ${violationRule || 'Не указано'}\n**Дата нарушения:** ${violationDate || 'Не указана'}\n\n**Описание:**\n${violationDesc}\n\n**Доказательства:** ${proofLink}`;
            extraData = { violatorNick, violationRule, violationDate, proofLink };
            break;
            
        case 'appeal':
            const appealNick = document.getElementById('appealNick').value.trim();
            const adminNick = document.getElementById('adminNick').value.trim();
            const punishmentType = document.getElementById('punishmentType').value;
            const banReason = document.getElementById('banReason').value.trim();
            const appealReason = document.getElementById('appealReason').value.trim();
            
            if (!appealNick || !adminNick || !appealReason) {
                showToast('error', 'Ошибка', 'Заполните все обязательные поля');
                return;
            }
            
            title = `Апелляция: ${appealNick}`;
            content = `**Игровой ник:** ${appealNick}\n**Администратор:** ${adminNick}\n**Тип наказания:** ${punishmentType || 'Не указан'}\n**Причина наказания:** ${banReason || 'Не указана'}\n\n**Причина апелляции:**\n${appealReason}`;
            extraData = { appealNick, adminNick, punishmentType, banReason };
            break;
            
        case 'question':
            const questionTitle = document.getElementById('questionTitle').value.trim();
            const questionCategory = document.getElementById('questionCategory').value;
            const questionText = document.getElementById('questionText').value.trim();
            
            if (!questionTitle || !questionText) {
                showToast('error', 'Ошибка', 'Заполните все обязательные поля');
                return;
            }
            
            title = questionTitle;
            content = `**Категория:** ${questionCategory}\n\n${questionText}`;
            extraData = { questionCategory };
            break;
            
        case 'suggestion':
            const suggestionTitle = document.getElementById('suggestionTitle').value.trim();
            const suggestionCategory = document.getElementById('suggestionCategory').value;
            const suggestionText = document.getElementById('suggestionText').value.trim();
            
            if (!suggestionTitle || !suggestionText) {
                showToast('error', 'Ошибка', 'Заполните все обязательные поля');
                return;
            }
            
            title = suggestionTitle;
            content = `**Категория:** ${suggestionCategory}\n\n${suggestionText}`;
            extraData = { suggestionCategory };
            break;
    }
    
    try {
        await api.post('/posts', {
        category: categoryMap[selectedPostCategory],
        title,
        content,
            extraData
    });
    
    closeCreateModal();
    renderPosts();
    updateStats();
    showToast('success', 'Тема создана!', 'Ваше обращение успешно опубликовано');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function renderPosts() {
    try {
        if (!postsTitle || !postsCount || !postsList || !emptyState || !loadMoreBtn) {
            console.warn('Required DOM elements not found for renderPosts');
            return;
        }
        
        const sortBy = document.getElementById('sortSelect')?.value || 'newest';
        const params = new URLSearchParams({
            category: currentCategory,
            search: searchQuery,
            sort: sortBy,
            page: currentPage,
            limit: postsPerPage
        });
        
        // Добавляем таймаут для запроса (10 секунд для загрузки постов)
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout loading posts')), 10000)
        );
        const response = await Promise.race([api.get(`/posts?${params}`), timeoutPromise]);
        const { posts, total } = response;
        
        postsTitle.textContent = categoryNames[currentCategory];
        postsCount.textContent = `Показано ${posts.length} из ${total} тем`;
    
        if (posts.length === 0) {
            postsList.innerHTML = '';
            emptyState.classList.remove('hidden');
            loadMoreBtn.classList.add('hidden');
            return;
        }
    
        emptyState.classList.add('hidden');
        loadMoreBtn.classList.toggle('hidden', posts.length >= total);
        
        postsList.innerHTML = posts.map((post, index) => {
            const timeAgo = getTimeAgo(post.created_at);
        
        return `
                <article class="post-card ${post.is_pinned ? 'pinned' : ''}" 
                     style="animation-delay: ${index * 0.03}s"
                     onclick="viewPost('${post.id}')">
                <div class="post-content">
                        <div class="post-avatar">
                            ${getCategoryIcon(post.category)}
                        </div>
                    <div class="post-main">
                        <div class="post-badges">
                                ${post.is_pinned ? '<span class="badge badge-pinned"><i class="fas fa-star"></i> Закреплено</span>' : ''}
                                ${post.is_hot ? '<span class="badge badge-hot"><i class="fas fa-fire"></i> Горячее</span>' : ''}
                            <span class="badge badge-category">${categoryNames[post.category]}</span>
                        </div>
                        <h3 class="post-title">${escapeHtml(post.title)}</h3>
                        <div class="post-meta">
                            <span><i class="fas fa-user"></i> ${escapeHtml(post.author?.username || post.author || 'Unknown')}</span>
                            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                        </div>
                    </div>
                    <div class="post-stats">
                            <span class="status-badge status-${post.status}">${post.status_text}</span>
                        <div class="post-counters">
                                <span title="Комментарии"><i class="fas fa-comment"></i> ${post.commentsCount}</span>
                            <span title="Просмотры"><i class="fas fa-eye"></i> ${post.views}</span>
                                ${currentUser ? `
                                    <span title="${post.isFavorite ? 'В избранном' : 'Добавить в избранное'}" 
                                          class="favorite-btn ${post.isFavorite ? 'active' : ''}"
                                          onclick="event.stopPropagation(); toggleFavorite('${post.id}')">
                                        <i class="fas fa-bookmark"></i>
                                    </span>
                                ` : ''}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    updateCategoryCounts();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function loadMorePosts() {
    currentPage++;
    renderPosts();
}

function searchPosts() {
    searchQuery = document.getElementById('searchInput').value.trim();
    currentPage = 1;
    renderPosts();
}

function filterByCategory(category) {
    currentCategory = category;
    currentPage = 1;
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    renderPosts();
    document.getElementById('forum').scrollIntoView({ behavior: 'smooth' });
}

async function updateCategoryCounts() {
    try {
        const stats = await api.get('/stats');
        
        document.getElementById('countAll').textContent = stats.totalPosts;
        document.getElementById('countComplaints').textContent = stats.categoryCounts.complaints;
        document.getElementById('countAppeals').textContent = stats.categoryCounts.appeals;
        document.getElementById('countQuestions').textContent = stats.categoryCounts.questions;
        document.getElementById('countSuggestions').textContent = stats.categoryCounts.suggestions;
    } catch (error) {}
}

// ===== POST VIEW =====
async function viewPost(postId) {
    try {
        const post = await api.get(`/api/posts/${postId}`);
        const comments = await api.get(`/api/posts/${postId}/comments`);
    
    currentPostId = postId;
    
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('forum').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('postView').classList.remove('hidden');
    
        const timeAgo = getTimeAgo(post.created_at);
    
        const isStaff = currentUser && currentUser.roleInfo && currentUser.roleInfo.level >= 1;
        const adminControlsHTML = isStaff ? `
        <div class="admin-controls">
            <div class="admin-controls-title">
                <i class="fas fa-shield-alt"></i>
                    Панель модерации
            </div>
            ${post.status === 'open' ? `
                <button class="btn btn-success btn-sm" onclick="approvePost('${post.id}')">
                    <i class="fas fa-check"></i> Принять
                </button>
                <button class="btn btn-danger btn-sm" onclick="rejectPost('${post.id}')">
                    <i class="fas fa-times"></i> Отклонить
                </button>
                <button class="btn btn-primary btn-sm" onclick="closePostAsResolved('${post.id}')">
                    <i class="fas fa-check-double"></i> Решено
                </button>
            ` : ''}
                ${post.status !== 'open' ? `
                <button class="btn btn-glass btn-sm" onclick="reopenPost('${post.id}')">
                    <i class="fas fa-redo"></i> Открыть заново
                </button>
            ` : ''}
        </div>
    ` : '';
    
    document.getElementById('postFull').innerHTML = `
        <div class="post-full-header">
            <div class="post-full-badges">
                    ${post.is_pinned ? '<span class="badge badge-pinned"><i class="fas fa-star"></i> Закреплено</span>' : ''}
                <span class="badge badge-category">${categoryNames[post.category]}</span>
                    <span class="status-badge status-${post.status}">${post.status_text}</span>
            </div>
            <h1 class="post-full-title">${escapeHtml(post.title)}</h1>
            <div class="post-full-meta">
                    <span onclick="openProfile('${post.author_id}')" style="cursor:pointer;">
                        <i class="fas fa-user"></i> ${escapeHtml(post.author?.username || post.author || 'Unknown')}
                        ${post.author?.roleInfo && post.author.roleInfo.level > 0 ? `<span style="color:${post.author.roleInfo.color}">[${post.author.roleInfo.name}]</span>` : ''}
                    </span>
                <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                <span><i class="fas fa-eye"></i> ${post.views} просмотров</span>
                <span><i class="fas fa-comment"></i> ${comments.length} комментариев</span>
            </div>
        </div>
        <div class="post-full-content">
            ${formatContent(post.content)}
        </div>
        <div class="post-full-actions">
                ${currentUser ? `
                    <button class="btn btn-glass btn-sm ${post.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${post.id}')">
                        <i class="fas fa-bookmark"></i> ${post.isFavorite ? 'В избранном' : 'В избранное'}
                    </button>
                ` : ''}
                ${currentUser && currentUser.id === post.author_id ? `
                <button class="btn btn-danger btn-sm" onclick="deletePost('${post.id}')">
                    <i class="fas fa-trash"></i> Удалить тему
                </button>
            ` : ''}
        </div>
        ${adminControlsHTML}
    `;
    
        renderComments(postId, comments);
    window.scrollTo(0, 0);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function goBackToForum() {
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('forum').classList.remove('hidden');
    document.getElementById('postView').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    currentPostId = null;
    renderPosts();
}

async function deletePost(postId) {
    showConfirm('Удаление темы', 'Вы уверены, что хотите удалить эту тему? Это действие нельзя отменить.', async () => {
        try {
            await api.delete(`/posts/${postId}`);
            updateStats();
            showToast('success', 'Удалено', 'Тема успешно удалена');
            goBackToForum();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

// ===== ADMIN MODERATION =====
async function approvePost(postId) {
    try {
        await api.put(`/posts/${postId}/status`, { status: 'approved', statusText: 'Принято' });
        viewPost(postId);
        showToast('success', 'Принято', 'Тема одобрена');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

let rejectTargetPostId = null;

function rejectPost(postId) {
    rejectTargetPostId = postId;
    document.getElementById('rejectPostReasonInput').value = '';
    document.getElementById('rejectPostReasonModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeRejectPostModal() {
    document.getElementById('rejectPostReasonModal').classList.remove('active');
    document.body.style.overflow = '';
    rejectTargetPostId = null;
}

async function confirmRejectPost() {
    if (!rejectTargetPostId) return;
    
    const reason = document.getElementById('rejectPostReasonInput').value.trim();
    
    try {
        await api.put(`/posts/${rejectTargetPostId}/status`, { 
            status: 'rejected', 
            statusText: 'Отклонено',
            reason: reason ? `❌ **Тема отклонена.** Причина: ${reason}` : null
        });
        closeRejectPostModal();
        viewPost(rejectTargetPostId);
        showToast('info', 'Отклонено', 'Тема отклонена');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function closePostAsResolved(postId) {
    try {
        await api.put(`/posts/${postId}/status`, { status: 'resolved', statusText: 'Решено' });
        viewPost(postId);
        showToast('success', 'Закрыто', 'Тема отмечена как решённая');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function reopenPost(postId) {
    try {
        await api.put(`/posts/${postId}/status`, { status: 'open', statusText: 'Открыто' });
        viewPost(postId);
        showToast('info', 'Открыто', 'Тема снова открыта');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== COMMENTS =====
function renderComments(postId, comments) {
    document.getElementById('commentsSection').innerHTML = `
        <div class="comments-header">
            <h3 class="comments-title">Комментарии (${comments.length})</h3>
        </div>
        
        ${currentUser ? `
            <div class="comment-form">
                <div class="comment-input-wrapper">
                    <textarea class="comment-input" id="commentInput" placeholder="Написать комментарий..." rows="2"></textarea>
                    <button class="btn btn-primary" onclick="submitComment('${postId}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        ` : `
            <div class="comment-form">
                <p style="color: var(--text-muted); text-align: center; padding: 20px;">
                    <a href="#" onclick="openAuthModal('login'); return false;" style="color: var(--primary-400);">Войдите</a>, чтобы оставить комментарий
                </p>
            </div>
        `}
        
        <div class="comments-list">
            ${comments.length === 0 ? `
                <div class="no-comments">
                    <i class="fas fa-comments" style="font-size: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                    <p>Комментариев пока нет. Будьте первым!</p>
                </div>
            ` : comments.map(comment => `
                <div class="comment ${comment.is_admin_action ? 'comment-admin' : ''}">
                    <div class="comment-avatar">
                        ${comment.author?.avatar_url ? `<img src="${comment.author.avatar_url}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px;">` : (comment.author?.avatar ? comment.author.avatar : '🎮')}
                    </div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author" style="color: ${comment.author?.roleInfo?.color || 'inherit'}" 
                                  onclick="openProfile('${comment.author_id}')" style="cursor:pointer;">
                                ${comment.author?.roleInfo && comment.author.roleInfo.level > 0 ? `<i class="fas ${comment.author.roleInfo.icon}"></i> ` : ''}${escapeHtml(comment.author?.username || comment.author || 'Unknown')}
                            </span>
                            <span class="comment-date">${getTimeAgo(comment.created_at)}</span>
                        </div>
                        <p class="comment-text">${comment.is_admin_action ? formatContent(comment.text) : escapeHtml(comment.text)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

async function submitComment(postId) {
    if (!currentUser) return;
    
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    
    if (!text) {
        showToast('error', 'Ошибка', 'Введите текст комментария');
        return;
    }
    
    try {
        await api.post(`/posts/${postId}/comments`, { text });
        const comments = await api.get(`/posts/${postId}/comments`);
        renderComments(postId, comments);
        showToast('success', 'Отправлено', 'Комментарий добавлен');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== FAVORITES =====
async function toggleFavorite(postId) {
    if (!currentUser) {
        showToast('info', 'Требуется вход', 'Войдите, чтобы добавить в избранное');
        openAuthModal('login');
        return;
    }
    
    try {
        const post = await api.get(`/posts/${postId}`);
        if (post.isFavorite) {
            await api.delete(`/favorites/${postId}`);
            showToast('info', 'Удалено', 'Тема удалена из избранного');
        } else {
            await api.post(`/favorites/${postId}`);
            showToast('success', 'Добавлено', 'Тема добавлена в избранное');
        }
        
        if (currentPostId === postId) {
            viewPost(postId);
        } else {
            renderPosts();
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function openFavorites() {
    closeUserMenu();
    if (!currentUser) return;
    
    try {
        const favorites = await api.get('/favorites');
        
        document.getElementById('heroSection').classList.add('hidden');
        document.getElementById('forum').classList.add('hidden');
        document.getElementById('postView').classList.add('hidden');
        document.getElementById('profileSection').classList.remove('hidden');
        
        document.getElementById('profileAvatar').innerHTML = '';
        document.getElementById('profileAvatar').textContent = '⭐';
        document.getElementById('profileName').textContent = 'Избранное';
        const profileBadges = document.querySelector('.profile-badges');
        if (profileBadges) profileBadges.innerHTML = `<span class="profile-badge user"><i class="fas fa-bookmark"></i> ${favorites.length} тем</span>`;
        const profileMeta = document.querySelector('.profile-meta');
        if (profileMeta) profileMeta.innerHTML = '';
        const statsGrid = document.querySelector('.profile-stats-grid');
        if (statsGrid) statsGrid.classList.add('hidden');
        document.getElementById('profileActions').innerHTML = '';
        
        const postsListEl = document.getElementById('profilePostsList');
        if (favorites.length === 0) {
            postsListEl.innerHTML = '<div class="profile-empty"><i class="fas fa-bookmark"></i><p>Вы ещё ничего не добавили в избранное</p></div>';
        } else {
            postsListEl.innerHTML = favorites.map(post => `
                <div class="profile-post-item" onclick="viewPost('${post.id}')">
                    <div>
                        <div class="profile-post-title">${escapeHtml(post.title)}</div>
                        <div class="profile-post-meta">
                            <span class="badge-category">${categoryNames[post.category]}</span> • 
                            ${escapeHtml(post.author?.username || post.author || 'Unknown')} • ${getTimeAgo(post.created_at)}
                        </div>
                    </div>
                    <span class="status-badge status-${post.status}">${post.status_text}</span>
                </div>
            `).join('');
        }
        
        window.scrollTo(0, 0);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== MESSAGES =====
async function openMessages() {
    closeUserMenu();
    if (!currentUser) return;
    
    try {
        const conversations = await api.get('/messages');
        
        document.getElementById('heroSection').classList.add('hidden');
        document.getElementById('forum').classList.add('hidden');
        document.getElementById('postView').classList.add('hidden');
        document.getElementById('profileSection').classList.remove('hidden');
        
        document.getElementById('profileAvatar').innerHTML = '';
        document.getElementById('profileAvatar').textContent = '✉️';
        document.getElementById('profileName').textContent = 'Личные сообщения';
        const profileBadges = document.querySelector('.profile-badges');
        if (profileBadges) profileBadges.innerHTML = `<span class="profile-badge user"><i class="fas fa-envelope"></i> ${conversations.length} диалогов</span>`;
        const profileMeta = document.querySelector('.profile-meta');
        if (profileMeta) profileMeta.innerHTML = '';
        const statsGrid = document.querySelector('.profile-stats-grid');
        if (statsGrid) statsGrid.classList.add('hidden');
        document.getElementById('profileActions').innerHTML = '';
        
        const postsListEl = document.getElementById('profilePostsList');
        if (conversations.length === 0) {
            postsListEl.innerHTML = '<div class="profile-empty"><i class="fas fa-envelope"></i><p>У вас пока нет сообщений</p></div>';
        } else {
            postsListEl.innerHTML = conversations.map(conv => `
                <div class="profile-post-item conversation-item" onclick="openConversation('${conv.user_id}', '${escapeHtml(conv.username)}')">
                    <div class="conv-avatar">
                        ${conv.avatar_url ? `<img src="${conv.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : conv.avatar}
                    </div>
                    <div class="conv-info">
                        <div class="conv-name">
                            ${conv.username}
                            ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : ''}
                        </div>
                        <div class="conv-preview">${escapeHtml(conv.last_message?.substring(0, 50) || '')}...</div>
                    </div>
                    <div class="conv-time">${conv.last_message_at ? getTimeAgo(conv.last_message_at) : ''}</div>
                </div>
            `).join('');
        }
        
        window.scrollTo(0, 0);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function openConversation(userId, username) {
    try {
        const messages = await api.get(`/messages/${userId}`);
        
        const postsListEl = document.getElementById('profilePostsList');
        document.getElementById('profileName').textContent = `Диалог с ${username}`;
        document.querySelector('.profile-badges').innerHTML = `
            <button class="btn btn-glass btn-sm" onclick="openMessages()">
                <i class="fas fa-arrow-left"></i> Назад
            </button>
        `;
        
        postsListEl.innerHTML = `
            <div class="messages-container">
                <div class="messages-list" id="messagesList">
                    ${messages.map(msg => `
                        <div class="message ${msg.sender_id === currentUser.id ? 'sent' : 'received'}">
                            <div class="message-avatar">
                                ${msg.sender_avatar_url ? `<img src="${msg.sender_avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : msg.sender_avatar}
                            </div>
                            <div class="message-bubble">
                                <div class="message-text">${escapeHtml(msg.content)}</div>
                                <div class="message-time">${getTimeAgo(msg.created_at)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="message-input-area">
                    <textarea class="message-input" id="messageInput" placeholder="Написать сообщение..."></textarea>
                    <button class="btn btn-primary" onclick="sendMessage('${userId}')">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        
        const messagesList = document.getElementById('messagesList');
        messagesList.scrollTop = messagesList.scrollHeight;
        
        loadMessagesCount();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function sendMessage(receiverId) {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        await api.post('/messages', { receiverId, content });
        input.value = '';
        
        const user = await api.get(`/users/${receiverId}`);
        openConversation(receiverId, user.username);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function openMessageModal(userId, username) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'messageModal';
    modal.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Написать ${username}</h2>
                    <p class="modal-subtitle">Новое личное сообщение</p>
                </div>
                <button class="modal-close" onclick="closeMessageModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="form-group">
                <label><i class="fas fa-comment"></i> Сообщение</label>
                <textarea id="newMessageContent" rows="5" placeholder="Введите ваше сообщение..."></textarea>
            </div>
            <div class="form-actions">
                <button class="btn btn-glass" onclick="closeMessageModal()">Отмена</button>
                <button class="btn btn-primary" onclick="sendNewMessage('${userId}')">
                    <i class="fas fa-paper-plane"></i> Отправить
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

async function sendNewMessage(receiverId) {
    const content = document.getElementById('newMessageContent').value.trim();
    if (!content) {
        showToast('error', 'Ошибка', 'Введите сообщение');
        return;
    }
    
    try {
        await api.post('/messages', { receiverId, content });
        closeMessageModal();
        showToast('success', 'Отправлено', 'Сообщение отправлено');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function loadMessagesCount() {
    if (!currentUser) return;
    try {
        const data = await api.get('/messages/unread/count');
        unreadMessages = data.count;
        updateBadges();
    } catch (error) {}
}

// ===== NOTIFICATIONS =====
async function openNotifications() {
    closeUserMenu();
    if (!currentUser) return;
    
    try {
        const notifications = await api.get('/notifications');
        
        document.getElementById('heroSection').classList.add('hidden');
        document.getElementById('forum').classList.add('hidden');
        document.getElementById('postView').classList.add('hidden');
        document.getElementById('profileSection').classList.remove('hidden');
        
        document.getElementById('profileAvatar').innerHTML = '';
        document.getElementById('profileAvatar').textContent = '🔔';
        document.getElementById('profileName').textContent = 'Уведомления';
        const profileBadges = document.querySelector('.profile-badges');
        if (profileBadges) {
            profileBadges.innerHTML = `
                <span class="profile-badge user"><i class="fas fa-bell"></i> ${notifications.length} уведомлений</span>
                ${notifications.filter(n => !n.is_read).length > 0 ? `
                    <button class="btn btn-glass btn-sm" onclick="markAllNotificationsRead()">
                        Прочитать все
                    </button>
                ` : ''}
            `;
        }
        const profileMeta = document.querySelector('.profile-meta');
        if (profileMeta) profileMeta.innerHTML = '';
        const statsGrid = document.querySelector('.profile-stats-grid');
        if (statsGrid) statsGrid.classList.add('hidden');
        document.getElementById('profileActions').innerHTML = '';
        
        const postsListEl = document.getElementById('profilePostsList');
        if (notifications.length === 0) {
            postsListEl.innerHTML = '<div class="profile-empty"><i class="fas fa-bell"></i><p>У вас пока нет уведомлений</p></div>';
        } else {
            postsListEl.innerHTML = notifications.map(notif => `
                <div class="profile-post-item notification-item ${notif.is_read ? '' : 'unread'}" 
                     onclick="handleNotificationClick('${notif.id}', '${notif.link || ''}')">
                    <div class="notif-icon ${notif.type}">
                        <i class="fas fa-${getNotificationIcon(notif.type)}"></i>
                    </div>
                    <div>
                        <div class="profile-post-title">${notif.title}</div>
                        <div class="profile-post-meta">${notif.message}</div>
                    </div>
                    <div class="notif-time">${getTimeAgo(notif.created_at)}</div>
                </div>
            `).join('');
        }
        
        window.scrollTo(0, 0);
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function getNotificationIcon(type) {
    const icons = {
        comment: 'comment',
        message: 'envelope',
        post_status: 'flag',
        reputation: 'star',
        role: 'user-shield',
        system: 'info-circle'
    };
    return icons[type] || 'bell';
}

async function handleNotificationClick(notifId, link) {
    try {
        await api.put(`/notifications/${notifId}/read`);
        loadNotificationsCount();
        
        if (link) {
            if (link.startsWith('/post/')) {
                viewPost(link.replace('/post/', ''));
            } else if (link.startsWith('/messages/')) {
                const userId = link.replace('/messages/', '');
                const user = await api.get(`/users/${userId}`);
                openConversation(userId, user.username);
            }
        }
    } catch (error) {}
}

async function markAllNotificationsRead() {
    try {
        await api.put('/notifications/read-all');
        loadNotificationsCount();
        openNotifications();
        showToast('success', 'Готово', 'Все уведомления прочитаны');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function loadNotificationsCount() {
    if (!currentUser) return;
    try {
        const data = await api.get('/notifications/unread/count');
        unreadNotifications = data.count;
        updateBadges();
    } catch (error) {}
}

function updateBadges() {
    // Update notification badge in user menu
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        const notifLink = userDropdown.querySelector('[onclick*="openNotifications"]');
        if (notifLink && unreadNotifications > 0) {
            if (!notifLink.querySelector('.menu-badge')) {
                notifLink.innerHTML += `<span class="menu-badge">${unreadNotifications}</span>`;
            }
        }
        
        const msgLink = userDropdown.querySelector('[onclick*="openMessages"]');
        if (msgLink && unreadMessages > 0) {
            if (!msgLink.querySelector('.menu-badge')) {
                msgLink.innerHTML += `<span class="menu-badge">${unreadMessages}</span>`;
            }
        }
    }
}

// ===== REPUTATION =====
async function giveReputation(targetUserId, type) {
    if (!currentUser) {
        showToast('info', 'Требуется вход', 'Войдите, чтобы оценить');
        openAuthModal('login');
        return;
    }
    
    try {
        await api.post('/reputation', { targetUserId, type });
        showToast('success', 'Готово', type === 'like' ? 'Вы поставили лайк!' : 'Оценка учтена');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== STATS =====
async function updateStats() {
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        const stats = await Promise.race([api.get('/stats'), timeoutPromise]);
        const totalPostsEl = document.getElementById('totalPosts');
        const totalUsersEl = document.getElementById('totalUsers');
        const onlineUsersEl = document.getElementById('onlineUsers');
        if (totalPostsEl) totalPostsEl.textContent = stats.totalPosts || 0;
        if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
        if (onlineUsersEl) onlineUsersEl.textContent = stats.onlineUsers || 0;
    } catch (error) {
        console.warn('Failed to update stats:', error);
        // Устанавливаем значения по умолчанию
        const totalPostsEl = document.getElementById('totalPosts');
        const totalUsersEl = document.getElementById('totalUsers');
        const onlineUsersEl = document.getElementById('onlineUsers');
        if (totalPostsEl) totalPostsEl.textContent = '0';
        if (totalUsersEl) totalUsersEl.textContent = '0';
        if (onlineUsersEl) onlineUsersEl.textContent = '0';
    }
}

async function updateOnlineUsers() {
    try {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 5000)
        );
        const users = await Promise.race([api.get('/users/online/list'), timeoutPromise]);
        const onlineList = document.getElementById('onlineList');
        const onlineUsersEl = document.getElementById('onlineUsers');
        
        if (onlineList) {
            if (users.length === 0) {
                onlineList.innerHTML = '<div class="online-empty">Никого онлайн</div>';
            } else {
                onlineList.innerHTML = users.map(user => `
                    <div class="online-user" onclick="openProfile('${user.id}')" style="cursor:pointer;">
                        <span class="user-dot"></span>
                        <span style="color: ${user.roleInfo?.color || 'inherit'}">${user.username}</span>
                    </div>
                `).join('');
            }
        }
        
        if (onlineUsersEl) {
            onlineUsersEl.textContent = users.length || (currentUser ? '1' : '0');
        }
    } catch (error) {
        console.warn('Failed to update online users:', error);
        const onlineList = document.getElementById('onlineList');
        const onlineUsersEl = document.getElementById('onlineUsers');
        
        if (onlineList) {
            if (currentUser) {
                onlineList.innerHTML = `
                    <div class="online-user">
                        <span class="user-dot"></span>
                        <span>${currentUser.username}</span>
                    </div>
                `;
            } else {
                onlineList.innerHTML = '<div class="online-empty">Гости</div>';
            }
        }
        
        if (onlineUsersEl) {
            onlineUsersEl.textContent = currentUser ? '1' : '0';
        }
    }
}

// ===== MODALS =====
function showRules() {
    document.getElementById('rulesModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeRulesModal() {
    document.getElementById('rulesModal').classList.remove('active');
    document.body.style.overflow = '';
}

function showForumRules() {
    document.getElementById('forumRulesModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeForumRulesModal() {
    document.getElementById('forumRulesModal').classList.remove('active');
    document.body.style.overflow = '';
}

function showFAQ() {
    document.getElementById('faqModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeFAQModal() {
    document.getElementById('faqModal').classList.remove('active');
    document.body.style.overflow = '';
}

function toggleFAQ(element) {
    const item = element.closest('.faq-item');
    item.classList.toggle('active');
}

// ===== ADMIN APPLICATION =====
function openAdminApplication() {
    if (!currentUser) {
        showToast('info', 'Требуется вход', 'Войдите в аккаунт, чтобы подать заявку');
        openAuthModal('login');
        return;
    }
    
    document.getElementById('adminApplicationModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    document.getElementById('adminAppNick').value = currentUser.roblox_nick || '';
}

function closeAdminApplicationModal() {
    document.getElementById('adminApplicationModal').classList.remove('active');
    document.body.style.overflow = '';
    ['adminAppNick', 'adminAppAge', 'adminAppHours', 'adminAppExperience', 'adminAppReason', 'adminAppDiscord'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

async function submitAdminApplication(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const nick = document.getElementById('adminAppNick').value.trim();
    const age = parseInt(document.getElementById('adminAppAge').value);
    const hours = document.getElementById('adminAppHours').value;
    const experience = document.getElementById('adminAppExperience').value.trim();
    const reason = document.getElementById('adminAppReason').value.trim();
    const discord = document.getElementById('adminAppDiscord').value.trim();
    
    if (!nick || !age || !hours || !reason || !discord) {
        showToast('error', 'Ошибка', 'Заполните все обязательные поля');
        return;
    }
    
    try {
        await api.post('/admin-applications', { nick, age, hours, experience, reason, discord });
    closeAdminApplicationModal();
    showToast('success', 'Заявка отправлена!', 'С вами свяжутся в Discord');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== NAVIGATION =====
function goHome() {
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('forum').classList.remove('hidden');
    document.getElementById('postView').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.querySelector('.profile-stats-grid').classList.remove('hidden');
    window.scrollTo(0, 0);
}

// ===== UTILITIES =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getRobloxIcon(size = 16) {
    // Выбираем подходящий размер иконки (используем ближайший доступный размер)
    let iconSize;
    if (size <= 23) iconSize = 23;
    else if (size <= 38) iconSize = 38;
    else if (size <= 50) iconSize = 50;
    else if (size <= 75) iconSize = 75;
    else if (size <= 100) iconSize = 100;
    else if (size <= 150) iconSize = 150;
    else if (size <= 200) iconSize = 200;
    else if (size <= 250) iconSize = 250;
    else iconSize = 500;
    
    return `<img src="icons/icons8-roblox-${iconSize}.png" alt="Roblox" class="roblox-icon" width="${size}" height="${size}" style="display: inline-block; vertical-align: middle;">`;
}

function formatContent(content) {
    return escapeHtml(content)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'только что';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} мин. назад`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч. назад`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} дн. назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// ===== EVENT LISTENERS =====
document.getElementById('categoryList').addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) filterByCategory(btn.dataset.category);
});

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Email validation on input
document.getElementById('regEmail')?.addEventListener('blur', function() {
    const email = this.value.trim().toLowerCase();
    if (!email) return;
    
    const validation = validateEmail(email);
    const hintEl = document.getElementById('emailHint');
    
    if (!validation.valid || validation.suggestion) {
        if (!hintEl) {
            const hint = document.createElement('div');
            hint.id = 'emailHint';
            hint.className = 'email-hint';
            this.parentNode.appendChild(hint);
        }
        const el = document.getElementById('emailHint');
        if (validation.suggestion) {
            el.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${validation.error} <a href="#" onclick="useEmailSuggestion('${validation.suggestion}'); return false;">Исправить</a>`;
            el.className = 'email-hint warning';
        } else {
            el.innerHTML = `<i class="fas fa-times-circle"></i> ${validation.error}`;
            el.className = 'email-hint error';
        }
    } else {
        if (hintEl) hintEl.remove();
    }
});

function useEmailSuggestion(suggestion) {
    document.getElementById('regEmail').value = suggestion;
    const hintEl = document.getElementById('emailHint');
    if (hintEl) {
        hintEl.innerHTML = '<i class="fas fa-check-circle"></i> Email исправлен';
        hintEl.className = 'email-hint success';
        setTimeout(() => hintEl.remove(), 2000);
    }
}

window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.style.background = window.pageYOffset > 100 
        ? 'rgba(15, 23, 42, 0.95)' 
        : 'rgba(15, 23, 42, 0.7)';
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ===== INITIALIZATION =====
async function init() {
    try {
        const savedUser = localStorage.getItem('urp_user');
        const savedToken = localStorage.getItem('urp_token');
        
        if (savedUser && savedToken) {
            try {
                api.token = savedToken;
                // Добавляем таймаут для запроса
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );
                currentUser = await Promise.race([api.get('/auth/me'), timeoutPromise]);
                localStorage.setItem('urp_user', JSON.stringify(currentUser));
            } catch (error) {
                console.warn('Auth check failed:', error);
                api.setToken(null);
                localStorage.removeItem('urp_user');
                currentUser = null;
            }
        }
        
        updateAuthUI();
        
        // Загружаем данные с обработкой ошибок
        Promise.all([
            renderPosts().catch(err => console.error('Failed to load posts:', err)),
            updateStats().catch(err => console.error('Failed to load stats:', err)),
            updateOnlineUsers().catch(err => console.error('Failed to load online users:', err))
        ]).finally(() => {
            if (currentUser) {
                loadNotificationsCount().catch(err => console.error('Failed to load notifications:', err));
                loadMessagesCount().catch(err => console.error('Failed to load messages:', err));
            }
            console.log('🎮 Unfiltered RP Forum loaded');
        });
    } catch (error) {
        console.error('Init error:', error);
        // Показываем базовый интерфейс даже при ошибке
        updateAuthUI();
    }
}

document.addEventListener('DOMContentLoaded', init);

// Refresh online users every 30 seconds
setInterval(updateOnlineUsers, 30000);

// ===== COMMENTS MODERATION =====
let selectedComments = new Set();

async function loadAdminComments() {
    try {
        const search = document.getElementById('commentSearch')?.value || '';
        const postFilter = document.getElementById('commentPostFilter')?.value || 'all';
        const dateFrom = document.getElementById('commentDateFrom')?.value || '';
        const dateTo = document.getElementById('commentDateTo')?.value || '';
        
        let comments = DB.getAll('comments');
        
        // Add author info
        comments = comments.map(c => {
            const author = DB.get('users', c.author_id);
            const post = DB.get('posts', c.post_id);
            return {
                ...c,
                author: author ? {
                    id: author.id,
                    username: author.username,
                    avatar: author.avatar,
                    avatar_url: author.avatar_url,
                    role: author.role,
                    roleInfo: ROLES_INFO[author.role]
                } : null,
                post: post ? {
                    id: post.id,
                    title: post.title,
                    category: post.category
                } : null
            };
        });
        
        // Apply filters
        if (postFilter !== 'all') {
            comments = comments.filter(c => c.post_id === postFilter);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            comments = comments.filter(c => 
                (c.text && c.text.toLowerCase().includes(searchLower)) ||
                (c.author && c.author.username && c.author.username.toLowerCase().includes(searchLower))
            );
        }
        
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            comments = comments.filter(c => new Date(c.created_at) >= fromDate);
        }
        
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            comments = comments.filter(c => new Date(c.created_at) <= toDate);
        }
        
        // Sort
        comments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Populate post filter
        const posts = DB.getAll('posts');
        const postSelect = document.getElementById('commentPostFilter');
        if (postSelect) {
            postSelect.innerHTML = '<option value="all">Все посты</option>' + 
                posts.slice(0, 50).map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
            if (postFilter !== 'all') postSelect.value = postFilter;
        }
        
        if (comments.length === 0) {
            document.getElementById('adminCommentsList').innerHTML = `
                <div class="admin-empty">
                    <i class="fas fa-comments"></i>
                    <p>Комментарии не найдены</p>
                </div>
            `;
            return;
        }
        
        document.getElementById('adminCommentsList').innerHTML = comments.map(comment => `
            <div class="admin-comment-row">
                <input type="checkbox" class="comment-checkbox" onchange="toggleCommentSelection('${comment.id}', this.checked)" ${selectedComments.has(comment.id) ? 'checked' : ''}>
                <div class="comment-content">
                    <div class="comment-header">
                        <span class="comment-author">${escapeHtml(comment.author?.username || 'Unknown')}</span>
                        <span class="comment-date">${getTimeAgo(comment.created_at)}</span>
                        <span class="comment-post-link" onclick="viewPost('${comment.post_id}'); closeAdminPanel();">
                            <i class="fas fa-link"></i> ${escapeHtml(comment.post?.title || 'Пост')}
                        </span>
                    </div>
                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                </div>
                <div class="comment-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteCommentAdmin('${comment.id}')" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        updateCommentsSelectionUI();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function toggleCommentSelection(commentId, checked) {
    if (checked) {
        selectedComments.add(commentId);
    } else {
        selectedComments.delete(commentId);
    }
    updateCommentsSelectionUI();
}

function updateCommentsSelectionUI() {
    const count = selectedComments.size;
    const deleteBtn = document.getElementById('deleteCommentsBtn');
    const countSpan = document.getElementById('selectedCommentsCount');
    if (deleteBtn) {
        deleteBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (countSpan) {
        countSpan.textContent = count;
    }
}

async function deleteCommentAdmin(commentId) {
    showConfirm('Удаление комментария', 'Удалить этот комментарий?', async () => {
        try {
            DB.delete('comments', commentId);
            selectedComments.delete(commentId);
            DB.insert('activity_log', {
                user_id: currentUser.id,
                action: 'comment_delete',
                details: `Удален комментарий ${commentId}`,
                created_at: new Date().toISOString()
            });
            showToast('success', 'Удалено', 'Комментарий удален');
            loadAdminComments();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

async function deleteSelectedComments() {
    const count = selectedComments.size;
    if (count === 0) return;
    showConfirm('Удаление комментариев', `Удалить ${count} комментариев?`, async () => {
        try {
            selectedComments.forEach(id => {
                DB.delete('comments', id);
            });
            DB.insert('activity_log', {
                user_id: currentUser.id,
                action: 'comments_mass_delete',
                details: `Удалено ${count} комментариев`,
                created_at: new Date().toISOString()
            });
            selectedComments.clear();
            showToast('success', 'Удалено', `Удалено ${count} комментариев`);
            loadAdminComments();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

// ===== ANALYTICS =====
async function loadAnalytics() {
    try {
        const period = parseInt(document.getElementById('analyticsPeriod')?.value || '30');
        const now = new Date();
        const startDate = new Date(now.getTime() - period * 24 * 60 * 60 * 1000);
        
        const users = DB.getAll('users');
        const posts = DB.getAll('posts');
        const comments = DB.getAll('comments');
        const activity = DB.getAll('activity_log');
        
        // Filter by period
        const recentUsers = users.filter(u => new Date(u.created_at) >= startDate);
        const recentPosts = posts.filter(p => new Date(p.created_at) >= startDate);
        const recentComments = comments.filter(c => new Date(c.created_at) >= startDate);
        const recentActivity = activity.filter(a => new Date(a.created_at) >= startDate);
        
        // Daily stats
        const dailyStats = {};
        for (let i = 0; i < period; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            dailyStats[dateStr] = {
                users: 0,
                posts: 0,
                comments: 0,
                activity: 0
            };
        }
        
        recentUsers.forEach(u => {
            const date = new Date(u.created_at).toISOString().split('T')[0];
            if (dailyStats[date]) dailyStats[date].users++;
        });
        
        recentPosts.forEach(p => {
            const date = new Date(p.created_at).toISOString().split('T')[0];
            if (dailyStats[date]) dailyStats[date].posts++;
        });
        
        recentComments.forEach(c => {
            const date = new Date(c.created_at).toISOString().split('T')[0];
            if (dailyStats[date]) dailyStats[date].comments++;
        });
        
        recentActivity.forEach(a => {
            const date = new Date(a.created_at).toISOString().split('T')[0];
            if (dailyStats[date]) dailyStats[date].activity++;
        });
        
        // Top users
        const userActivity = {};
        recentActivity.forEach(a => {
            userActivity[a.user_id] = (userActivity[a.user_id] || 0) + 1;
        });
        const topUsers = Object.entries(userActivity)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([userId, count]) => {
                const user = DB.get('users', userId);
                return { user: user ? api.formatUser(user) : null, count };
            });
        
        // Category stats
        const categoryStats = {};
        recentPosts.forEach(p => {
            categoryStats[p.category] = (categoryStats[p.category] || 0) + 1;
        });
        
        // Для периодов больше 7 дней - группируем данные для красивого отображения
        let chartData = Object.entries(dailyStats);
        if (period > 7) {
            // Группируем данные: для 30 дней - по неделям, для 90 - по 2 недели, для 365 - по месяцам
            let groupSize;
            if (period === 30) {
                groupSize = 7; // Группируем по неделям (4-5 точек)
            } else if (period === 90) {
                groupSize = 14; // Группируем по 2 недели (6-7 точек)
            } else {
                groupSize = 30; // Группируем по месяцам (12 точек)
            }
            
            const grouped = {};
            chartData.forEach(([date, stats], index) => {
                const groupIndex = Math.floor(index / groupSize);
                const groupKey = `group_${groupIndex}`;
                if (!grouped[groupKey]) {
                    grouped[groupKey] = { users: 0, posts: 0, comments: 0, activity: 0, dates: [] };
                }
                grouped[groupKey].users += stats.users;
                grouped[groupKey].posts += stats.posts;
                grouped[groupKey].comments += stats.comments;
                grouped[groupKey].activity += stats.activity;
                grouped[groupKey].dates.push(date);
            });
            chartData = Object.entries(grouped).map(([key, stats]) => {
                const firstDate = new Date(Math.min(...stats.dates.map(d => new Date(d).getTime())));
                return [firstDate.toISOString().split('T')[0], stats];
            }).sort((a, b) => new Date(a[0]) - new Date(b[0]));
        }
        
        // Calculate max values for charts (используем исходные dailyStats для правильных максимумов)
        const maxUsers = Math.max(...Object.values(dailyStats).map(s => s.users), 1);
        const maxPosts = Math.max(...Object.values(dailyStats).map(s => s.posts), 1);
        const maxComments = Math.max(...Object.values(dailyStats).map(s => s.comments), 1);
        const maxActivity = Math.max(...Object.values(dailyStats).map(s => s.activity), 1);
        
        // Определяем, нужно ли делать столбцы тонкими (для периодов > 7 дней)
        const isCompact = period > 7;
        const chartClass = isCompact ? 'analytics-chart compact' : 'analytics-chart';
        
        const html = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h3><i class="fas fa-users"></i> Активность пользователей</h3>
                    <div class="${chartClass}">
                        ${chartData.map(([date, stats]) => {
                            const heightPercent = maxUsers > 0 ? Math.max((stats.users / maxUsers) * 100, 5) : 5;
                            const heightPx = (heightPercent / 100) * 200;
                            const dateObj = new Date(date);
                            const day = dateObj.getDate().toString().padStart(2, '0');
                            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                            return `
                            <div class="chart-bar-wrapper">
                                <span class="chart-label">${day}.${month}</span>
                                <div class="chart-bar ${isCompact ? 'compact' : ''}" style="height: ${heightPx}px">
                                    <span class="chart-value">${stats.users}</span>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="analytics-card">
                    <h3><i class="fas fa-file-alt"></i> Активность постов</h3>
                    <div class="${chartClass}">
                        ${chartData.map(([date, stats]) => {
                            const heightPercent = maxPosts > 0 ? Math.max((stats.posts / maxPosts) * 100, 5) : 5;
                            const heightPx = (heightPercent / 100) * 200;
                            const dateObj = new Date(date);
                            const day = dateObj.getDate().toString().padStart(2, '0');
                            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                            return `
                            <div class="chart-bar-wrapper">
                                <span class="chart-label">${day}.${month}</span>
                                <div class="chart-bar ${isCompact ? 'compact' : ''}" style="height: ${heightPx}px">
                                    <span class="chart-value">${stats.posts}</span>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="analytics-card">
                    <h3><i class="fas fa-comments"></i> Активность комментариев</h3>
                    <div class="${chartClass}">
                        ${chartData.map(([date, stats]) => {
                            const heightPercent = maxComments > 0 ? Math.max((stats.comments / maxComments) * 100, 5) : 5;
                            const heightPx = (heightPercent / 100) * 200;
                            const dateObj = new Date(date);
                            const day = dateObj.getDate().toString().padStart(2, '0');
                            const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                            return `
                            <div class="chart-bar-wrapper">
                                <span class="chart-label">${day}.${month}</span>
                                <div class="chart-bar ${isCompact ? 'compact' : ''}" style="height: ${heightPx}px">
                                    <span class="chart-value">${stats.comments}</span>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
                
                <div class="analytics-card">
                    <h3><i class="fas fa-trophy"></i> Топ активных пользователей</h3>
                    <div class="top-users-list">
                        ${topUsers.length > 0 ? topUsers.map((item, index) => `
                            <div class="top-user-item">
                                <span class="rank">#${index + 1}</span>
                                <span class="username">${escapeHtml(item.user?.username || 'Unknown')}</span>
                                <span class="count">${item.count} действий</span>
                            </div>
                        `).join('') : '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Нет данных</p>'}
                    </div>
                </div>
                
                <div class="analytics-card">
                    <h3><i class="fas fa-chart-pie"></i> По категориям</h3>
                    <div class="category-stats">
                        ${Object.keys(categoryStats).length > 0 ? Object.entries(categoryStats).map(([cat, count]) => `
                            <div class="category-stat-item">
                                <span class="category-name">${categoryNames[cat] || cat}</span>
                                <span class="category-count">${count}</span>
                            </div>
                        `).join('') : '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Нет данных</p>'}
                    </div>
                </div>
            </div>
        `;
        
        const analyticsContent = document.getElementById('analyticsContent');
        if (analyticsContent) {
            analyticsContent.innerHTML = html;
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function exportAnalytics() {
    try {
        const period = parseInt(document.getElementById('analyticsPeriod')?.value || '30');
        const analytics = {
            period,
            generated: new Date().toISOString(),
            stats: {
                totalUsers: DB.getAll('users').length,
                totalPosts: DB.getAll('posts').length,
                totalComments: DB.getAll('comments').length
            }
        };
        
        const dataStr = JSON.stringify(analytics, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Экспортировано', 'Отчет сохранен');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== TEMPLATES =====
function loadTemplates() {
    const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
    
    if (templates.length === 0) {
        document.getElementById('templatesList').innerHTML = `
            <div class="admin-empty">
                <i class="fas fa-file-alt"></i>
                <p>Нет шаблонов. Создайте первый шаблон.</p>
            </div>
        `;
        return;
    }
    
    document.getElementById('templatesList').innerHTML = templates.map((template, index) => `
        <div class="template-card">
            <div class="template-header">
                <h4>${escapeHtml(template.name)}</h4>
                <div class="template-actions">
                    <button class="btn btn-primary btn-sm" onclick="sendTemplate(${index})" title="Отправить шаблон">
                        ${escapeHtml(template.name)}
                    </button>
                    <button class="btn btn-glass btn-sm" onclick="editTemplate(${index})" title="Редактировать">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTemplate(${index})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="template-content">${escapeHtml(template.content)}</div>
            <div class="template-tags">
                ${template.tags ? template.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : ''}
            </div>
        </div>
    `).join('');
}

function openTemplateModal(templateIndex = null) {
    const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
    const template = templateIndex !== null ? templates[templateIndex] : null;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h2>${template ? 'Редактировать шаблон' : 'Создать шаблон'}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <form onsubmit="saveTemplate(event, ${templateIndex})">
                <div class="form-group">
                    <label>Название шаблона</label>
                    <input type="text" id="templateName" value="${template ? escapeHtml(template.name) : ''}" required>
                </div>
                <div class="form-group">
                    <label>Содержание</label>
                    <textarea id="templateContent" rows="8" required>${template ? escapeHtml(template.content) : ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Теги (через запятую)</label>
                    <input type="text" id="templateTags" value="${template ? (template.tags || []).join(', ') : ''}" placeholder="жалоба, апелляция, вопрос">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-glass" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
}

function saveTemplate(e, templateIndex) {
    e.preventDefault();
    const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
    const name = document.getElementById('templateName').value.trim();
    const content = document.getElementById('templateContent').value.trim();
    const tags = document.getElementById('templateTags').value.split(',').map(t => t.trim()).filter(t => t);
    
    const template = { name, content, tags, created_at: new Date().toISOString() };
    
    if (templateIndex !== null) {
        templates[templateIndex] = template;
    } else {
        templates.push(template);
    }
    
    localStorage.setItem('admin_templates', JSON.stringify(templates));
    e.target.closest('.modal-overlay').remove();
    loadTemplates();
    showToast('success', 'Сохранено', 'Шаблон сохранен');
}

function editTemplate(index) {
    openTemplateModal(index);
}

function deleteTemplate(index) {
    showConfirm('Удаление шаблона', 'Удалить этот шаблон?', () => {
        const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
        templates.splice(index, 1);
        localStorage.setItem('admin_templates', JSON.stringify(templates));
        loadTemplates();
        showToast('success', 'Удалено', 'Шаблон удален');
    });
}

function useTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
    const template = templates[index];
    if (!template) return;
    
    // Copy to clipboard
    navigator.clipboard.writeText(template.content).then(() => {
        showToast('success', 'Скопировано', 'Шаблон скопирован в буфер обмена');
    }).catch(() => {
        showToast('info', 'Шаблон', template.content);
    });
}

async function sendTemplate(index) {
    const templates = JSON.parse(localStorage.getItem('admin_templates') || '[]');
    const template = templates[index];
    if (!template) return;
    
    // Try to find active comment form or post reply form
    const commentInput = document.querySelector('.comment-input, #commentContent, textarea[placeholder*="комментарий"], textarea[placeholder*="ответ"]');
    
    if (commentInput) {
        commentInput.value = template.content;
        commentInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Try to find submit button and click it
        const submitButton = commentInput.closest('form')?.querySelector('button[type="submit"], .btn-primary');
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
            showToast('success', 'Отправлено', `Шаблон "${template.name}" отправлен`);
        } else {
            showToast('info', 'Шаблон вставлен', `Шаблон "${template.name}" вставлен в поле. Отправьте вручную.`);
        }
    } else {
        // If no form found, copy to clipboard
        navigator.clipboard.writeText(template.content).then(() => {
            showToast('success', 'Скопировано', `Шаблон "${template.name}" скопирован в буфер обмена`);
        }).catch(() => {
            showToast('info', 'Шаблон', template.content);
        });
    }
}

// ===== EXPORT/IMPORT =====
function exportData() {
    try {
        const exportUsers = document.getElementById('exportUsers')?.checked;
        const exportPosts = document.getElementById('exportPosts')?.checked;
        const exportComments = document.getElementById('exportComments')?.checked;
        const exportMessages = document.getElementById('exportMessages')?.checked;
        const exportApplications = document.getElementById('exportApplications')?.checked;
        const exportActivity = document.getElementById('exportActivity')?.checked;
        const format = document.getElementById('exportFormat')?.value || 'json';
        
        const data = {
            export_date: new Date().toISOString(),
            version: '1.0'
        };
        
        if (exportUsers) data.users = DB.getAll('users');
        if (exportPosts) data.posts = DB.getAll('posts');
        if (exportComments) data.comments = DB.getAll('comments');
        if (exportMessages) data.messages = DB.getAll('messages');
        if (exportApplications) data.admin_applications = DB.getAll('admin_applications');
        if (exportActivity) data.activity_log = DB.getAll('activity_log');
        
        let dataStr, mimeType, extension;
        if (format === 'json') {
            dataStr = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else {
            // CSV export (simplified)
            const csvRows = [];
            if (data.users) {
                csvRows.push('USERS');
                csvRows.push('id,username,email,role,created_at');
                data.users.forEach(u => {
                    csvRows.push(`${u.id},${u.username},${u.email},${u.role},${u.created_at}`);
                });
            }
            dataStr = csvRows.join('\n');
            mimeType = 'text/csv';
            extension = 'csv';
        }
        
        const blob = new Blob([dataStr], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `forum_backup_${new Date().toISOString().split('T')[0]}.${extension}`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('success', 'Экспортировано', 'Данные сохранены');
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

function handleImportFile(input) {
    const file = input.files[0];
    const fileNameEl = document.getElementById('importFileName');
    if (file && fileNameEl) {
        fileNameEl.textContent = file.name;
    } else if (fileNameEl) {
        fileNameEl.textContent = 'Файл не выбран';
    }
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            showConfirm('Импорт данных', 'Импортировать данные? Это перезапишет текущую базу данных.', () => {
                importData(data);
            });
        } catch (error) {
            showToast('error', 'Ошибка', 'Неверный формат файла');
        }
    };
    reader.readAsText(file);
}

function importData(data) {
    try {
            
            if (data.users) {
                const db = DB.getDB();
                db.users = data.users;
                DB.saveDB(db);
            }
            if (data.posts) {
                const db = DB.getDB();
                db.posts = data.posts;
                DB.saveDB(db);
            }
            if (data.comments) {
                const db = DB.getDB();
                db.comments = data.comments;
                DB.saveDB(db);
            }
            if (data.messages) {
                const db = DB.getDB();
                db.messages = data.messages;
                DB.saveDB(db);
            }
            if (data.admin_applications) {
                const db = DB.getDB();
                db.admin_applications = data.admin_applications;
                DB.saveDB(db);
            }
            if (data.activity_log) {
                const db = DB.getDB();
                db.activity_log = data.activity_log;
                DB.saveDB(db);
            }
            
        showToast('success', 'Импортировано', 'Данные успешно импортированы');
        location.reload();
    } catch (error) {
        showToast('error', 'Ошибка', 'Неверный формат файла');
    }
}

function createBackup() {
    const data = {
        backup_date: new Date().toISOString(),
        version: '1.0',
        users: DB.getAll('users'),
        posts: DB.getAll('posts'),
        comments: DB.getAll('comments'),
        messages: DB.getAll('messages'),
        notifications: DB.getAll('notifications'),
        favorites: DB.getAll('favorites'),
        reputation: DB.getAll('reputation'),
        activity_log: DB.getAll('activity_log'),
        admin_applications: DB.getAll('admin_applications'),
        roblox_verifications: DB.getAll('roblox_verifications')
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `forum_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Создано', 'Резервная копия создана');
}

function optimizeDatabase() {
    showConfirm('Оптимизация базы данных', 'Оптимизировать базу данных? Это удалит неиспользуемые данные.', () => {
        try {
        const db = DB.getDB();
        // Remove orphaned comments
        const posts = db.posts.map(p => p.id);
        db.comments = db.comments.filter(c => posts.includes(c.post_id));
        
        // Remove orphaned messages
        const users = db.users.map(u => u.id);
        db.messages = db.messages.filter(m => users.includes(m.sender_id) && users.includes(m.receiver_id));
        
        // Remove orphaned notifications
        db.notifications = db.notifications.filter(n => users.includes(n.user_id));
        
        // Remove orphaned favorites
        db.favorites = db.favorites.filter(f => users.includes(f.user_id) && posts.includes(f.post_id));
        
        DB.saveDB(db);
            showToast('success', 'Оптимизировано', 'База данных оптимизирована');
            if (adminCurrentTab === 'posts') loadAdminPosts();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

function clearOldData() {
    showConfirm('Очистка данных', 'Очистить старые данные? Это удалит записи старше 90 дней из логов активности.', () => {
        try {
        const db = DB.getDB();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        
            db.activity_log = db.activity_log.filter(a => new Date(a.created_at) >= cutoffDate);
            DB.saveDB(db);
            showToast('success', 'Очищено', 'Старые данные удалены');
            if (adminCurrentTab === 'activity') loadAdminActivity();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

function checkDatabaseIntegrity() {
    try {
        const db = DB.getDB();
        const errors = [];
        
        // Check users
        const userIds = db.users.map(u => u.id);
        db.posts.forEach(p => {
            if (!userIds.includes(p.author_id)) errors.push(`Пост ${p.id} ссылается на несуществующего пользователя`);
        });
        db.comments.forEach(c => {
            if (!userIds.includes(c.author_id)) errors.push(`Комментарий ${c.id} ссылается на несуществующего пользователя`);
        });
        
        // Check posts
        const postIds = db.posts.map(p => p.id);
        db.comments.forEach(c => {
            if (!postIds.includes(c.post_id)) errors.push(`Комментарий ${c.id} ссылается на несуществующий пост`);
        });
        db.favorites.forEach(f => {
            if (!postIds.includes(f.post_id)) errors.push(`Избранное ${f.id} ссылается на несуществующий пост`);
        });
        
        if (errors.length === 0) {
            showToast('success', 'Проверка завершена', 'Целостность базы данных в порядке');
        } else {
            showToast('warning', 'Найдены ошибки', `${errors.length} проблем. Проверьте консоль.`);
            console.log('Database integrity errors:', errors);
        }
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

// ===== ADMIN SETTINGS =====
function loadAdminSettings() {
    const settings = JSON.parse(localStorage.getItem('forum_settings') || '{}');
    
    const html = `
        <div class="settings-grid">
            <div class="settings-section">
                <h3><i class="fas fa-user-plus"></i> Регистрация</h3>
                <label class="switch">
                    <input type="checkbox" id="allowRegistration" ${settings.allowRegistration !== false ? 'checked' : ''} onchange="saveSetting('allowRegistration', this.checked)">
                    <span class="slider"></span>
                </label>
                <p>Разрешить регистрацию новых пользователей</p>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-comments"></i> Комментарии</h3>
                <label>Максимальная длина комментария:</label>
                <input type="number" id="maxCommentLength" value="${settings.maxCommentLength || 5000}" min="100" max="50000" onchange="saveSetting('maxCommentLength', parseInt(this.value))">
                <p>Символов</p>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-file-alt"></i> Посты</h3>
                <label>Максимум постов в день на пользователя:</label>
                <input type="number" id="maxPostsPerDay" value="${settings.maxPostsPerDay || 10}" min="1" max="100" onchange="saveSetting('maxPostsPerDay', parseInt(this.value))">
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-bell"></i> Уведомления</h3>
                <label class="switch">
                    <input type="checkbox" id="notifyNewApplications" ${settings.notifyNewApplications !== false ? 'checked' : ''} onchange="saveSetting('notifyNewApplications', this.checked)">
                    <span class="slider"></span>
                </label>
                <p>Уведомлять о новых заявках</p>
                
                <label class="switch">
                    <input type="checkbox" id="notifyNewPosts" ${settings.notifyNewPosts !== false ? 'checked' : ''} onchange="saveSetting('notifyNewPosts', this.checked)">
                    <span class="slider"></span>
                </label>
                <p>Уведомлять о новых постах</p>
            </div>
            
            <div class="settings-section">
                <h3><i class="fas fa-shield-alt"></i> Модерация</h3>
                <label class="switch">
                    <input type="checkbox" id="autoModerate" ${settings.autoModerate || false ? 'checked' : ''} onchange="saveSetting('autoModerate', this.checked)">
                    <span class="slider"></span>
                </label>
                <p>Автоматическая модерация (требует одобрения)</p>
            </div>
        </div>
    `;
    
    document.getElementById('adminSettingsContent').innerHTML = html;
}

function saveSetting(key, value) {
    const settings = JSON.parse(localStorage.getItem('forum_settings') || '{}');
    settings[key] = value;
    localStorage.setItem('forum_settings', JSON.stringify(settings));
    showToast('success', 'Сохранено', 'Настройка обновлена');
}

// ===== MASS ACTIONS =====
let selectedUsers = new Set();
let selectedPosts = new Set();

function toggleUserSelection(userId, checked) {
    if (checked) {
        selectedUsers.add(userId);
    } else {
        selectedUsers.delete(userId);
    }
    updateUsersSelectionUI();
}

function toggleUserSelectionByClick(userId) {
    if (selectedUsers.has(userId)) {
        selectedUsers.delete(userId);
    } else {
        selectedUsers.add(userId);
    }
    updateUsersSelectionUI();
    // Update visual selection state
    const row = document.querySelector(`.admin-user-row[data-user-id="${userId}"]`);
    if (row) {
        row.classList.toggle('selected', selectedUsers.has(userId));
    }
}

function updateUsersSelectionUI() {
    const count = selectedUsers.size;
    const container = document.getElementById('adminUsersList');
    if (!container) return;
    
    let massActions = container.querySelector('.admin-mass-actions');
    if (count > 0) {
        if (!massActions) {
            massActions = document.createElement('div');
            massActions.className = 'admin-mass-actions';
            massActions.innerHTML = `
                <span>Выбрано: <strong id="selectedUsersCount">${count}</strong></span>
                <button class="btn btn-danger btn-sm" onclick="massBanUsers()">Забанить</button>
                <button class="btn btn-success btn-sm" onclick="massUnbanUsers()">Разбанить</button>
                <button class="btn btn-glass btn-sm" onclick="massDeleteUsers()">Удалить</button>
                <button class="btn btn-glass btn-sm" onclick="selectedUsers.clear(); updateUsersSelectionUI(); loadAdminUsers();">Снять выбор</button>
            `;
            container.insertBefore(massActions, container.firstChild);
            // Trigger animation
            setTimeout(() => massActions.classList.add('show'), 10);
        } else {
            massActions.querySelector('#selectedUsersCount').textContent = count;
            if (!massActions.classList.contains('show')) {
                setTimeout(() => massActions.classList.add('show'), 10);
            }
        }
    } else if (massActions) {
        massActions.classList.remove('show');
    }
    
    // Update all rows visual state
    container.querySelectorAll('.admin-user-row').forEach(row => {
        const userId = row.getAttribute('data-user-id');
        row.classList.toggle('selected', selectedUsers.has(userId));
    });
}

function togglePostSelection(postId, checked) {
    if (checked) {
        selectedPosts.add(postId);
    } else {
        selectedPosts.delete(postId);
    }
    updatePostsSelectionUI();
}

function updatePostsSelectionUI() {
    const count = selectedPosts.size;
    const container = document.getElementById('adminPostsList');
    if (!container) return;
    
    let massActions = container.querySelector('.admin-mass-actions');
    if (count > 0) {
        if (!massActions) {
            massActions = document.createElement('div');
            massActions.className = 'admin-mass-actions';
            massActions.style.cssText = 'margin-bottom: 16px; display: flex; gap: 8px; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px;';
            massActions.innerHTML = `
                <span>Выбрано: <strong id="selectedPostsCount">${count}</strong></span>
                <button class="btn btn-glass btn-sm" onclick="massPinPosts()">Закрепить</button>
                <button class="btn btn-glass btn-sm" onclick="massUnpinPosts()">Открепить</button>
                <button class="btn btn-danger btn-sm" onclick="massDeletePosts()">Удалить</button>
                <button class="btn btn-glass btn-sm" onclick="selectedPosts.clear(); loadAdminPosts();">Снять выбор</button>
            `;
            container.insertBefore(massActions, container.firstChild);
        } else {
            massActions.style.display = 'flex';
            massActions.querySelector('#selectedPostsCount').textContent = count;
        }
    } else if (massActions) {
        massActions.style.display = 'none';
    }
}

async function massBanUsers() {
    const count = selectedUsers.size;
    if (count === 0) return;
    showPrompt('Массовый бан', `Забанить ${count} пользователей?\n\nУкажите причину:`, 'Причина бана', (reason) => {
        if (!reason) return;
    
    try {
        let banned = 0;
        selectedUsers.forEach(userId => {
            try {
                const user = DB.get('users', userId);
                if (user && user.role !== 'management' && userId !== currentUser.id) {
                    DB.update('users', userId, { is_banned: true, ban_reason: reason });
                    banned++;
                }
            } catch (e) {}
        });
        DB.insert('activity_log', {
            user_id: currentUser.id,
            action: 'mass_ban',
            details: `Забанено ${banned} пользователей: ${reason}`,
            created_at: new Date().toISOString()
        });
            selectedUsers.clear();
            showToast('success', 'Выполнено', `Забанено ${banned} пользователей`);
            loadAdminUsers();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

async function massUnbanUsers() {
    const count = selectedUsers.size;
    if (count === 0) return;
    showConfirm('Массовый разбан', `Разбанить ${count} пользователей?`, async () => {
        try {
        let unbanned = 0;
        selectedUsers.forEach(userId => {
            try {
                DB.update('users', userId, { is_banned: false, ban_reason: null });
                unbanned++;
            } catch (e) {}
        });
        DB.insert('activity_log', {
            user_id: currentUser.id,
            action: 'mass_unban',
            details: `Разбанено ${unbanned} пользователей`,
            created_at: new Date().toISOString()
        });
            selectedUsers.clear();
            showToast('success', 'Выполнено', `Разбанено ${unbanned} пользователей`);
            loadAdminUsers();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

async function massDeleteUsers() {
    const count = selectedUsers.size;
    if (count === 0) return;
    showConfirm('Массовое удаление', `Удалить ${count} пользователей? Это действие необратимо!`, async () => {
        try {
        let deleted = 0;
        selectedUsers.forEach(userId => {
            try {
                const user = DB.get('users', userId);
                if (user && user.role !== 'management' && userId !== currentUser.id) {
                    DB.delete('users', userId);
                    deleted++;
                }
            } catch (e) {}
        });
        DB.insert('activity_log', {
            user_id: currentUser.id,
            action: 'mass_delete_users',
            details: `Удалено ${deleted} пользователей`,
            created_at: new Date().toISOString()
        });
            selectedUsers.clear();
            showToast('success', 'Выполнено', `Удалено ${deleted} пользователей`);
            loadAdminUsers();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

async function massPinPosts() {
    const count = selectedPosts.size;
    if (count === 0) return;
    
    try {
        selectedPosts.forEach(postId => {
            const post = DB.get('posts', postId);
            if (post) DB.update('posts', postId, { is_pinned: true });
        });
        showToast('success', 'Выполнено', `Закреплено ${count} постов`);
        selectedPosts.clear();
        loadAdminPosts();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function massUnpinPosts() {
    const count = selectedPosts.size;
    if (count === 0) return;
    
    try {
        selectedPosts.forEach(postId => {
            const post = DB.get('posts', postId);
            if (post) DB.update('posts', postId, { is_pinned: false });
        });
        showToast('success', 'Выполнено', `Откреплено ${count} постов`);
        selectedPosts.clear();
        loadAdminPosts();
    } catch (error) {
        showToast('error', 'Ошибка', error.message);
    }
}

async function massDeletePosts() {
    const count = selectedPosts.size;
    if (count === 0) return;
    showConfirm('Массовое удаление', `Удалить ${count} постов? Это действие необратимо!`, async () => {
        try {
        selectedPosts.forEach(postId => {
            DB.delete('posts', postId);
            DB.getAll('comments', c => c.post_id === postId).forEach(c => DB.delete('comments', c.id));
        });
        DB.insert('activity_log', {
            user_id: currentUser.id,
            action: 'mass_delete_posts',
            details: `Удалено ${count} постов`,
            created_at: new Date().toISOString()
        });
            selectedPosts.clear();
            showToast('success', 'Выполнено', `Удалено ${count} постов`);
            loadAdminPosts();
        } catch (error) {
            showToast('error', 'Ошибка', error.message);
        }
    });
}

// ===== ADMIN NOTIFICATIONS =====
function checkAdminNotifications() {
    if (!currentUser || !ROLES_INFO[currentUser.role] || ROLES_INFO[currentUser.role].level < 2) return;
    
    const settings = JSON.parse(localStorage.getItem('forum_settings') || '{}');
    const applications = DB.getAll('admin_applications', a => a.status === 'pending');
    const newPosts = DB.getAll('posts', p => {
        const postDate = new Date(p.created_at);
        const now = new Date();
        return (now - postDate) < 24 * 60 * 60 * 1000; // Last 24 hours
    });
    
    if (settings.notifyNewApplications !== false && applications.length > 0) {
        const count = applications.length;
        showToast('info', 'Новые заявки', `Ожидают рассмотрения: ${count}`, 5000);
    }
    
    if (settings.notifyNewPosts !== false && newPosts.length > 10) {
        showToast('info', 'Активность', `За последние 24 часа: ${newPosts.length} новых постов`, 5000);
    }
}

// Check admin notifications every 5 minutes
setInterval(checkAdminNotifications, 5 * 60 * 1000);

// ===== GLOBAL EXPORTS =====
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthForm = switchAuthForm;
window.togglePassword = togglePassword;
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.checkPasswordStrength = checkPasswordStrength;
window.checkPasswordMatch = checkPasswordMatch;
window.showWelcomeModal = showWelcomeModal;
window.closeWelcomeModal = closeWelcomeModal;
window.logout = logout;
window.toggleUserMenu = toggleUserMenu;
window.openProfile = openProfile;
window.openMyPosts = openMyPosts;
window.openSettings = openSettings;
window.openProfileSettings = openProfileSettings;
window.closeProfileSettingsModal = closeProfileSettingsModal;
window.closeSiteSettingsModal = closeSiteSettingsModal;
window.saveSiteSettings = saveSiteSettings;
window.changeLanguage = changeLanguage;
window.clearCookies = clearCookies;
window.selectAvatar = selectAvatar;
window.uploadAvatar = uploadAvatar;
window.saveSettings = saveSettings;
window.openDeleteAccountModal = openDeleteAccountModal;
window.closeDeleteAccountModal = closeDeleteAccountModal;
window.confirmDeleteAccount = confirmDeleteAccount;
window.openAccountSwitcher = openAccountSwitcher;
window.closeAccountSwitcher = closeAccountSwitcher;
window.switchToAccount = switchToAccount;
window.removeAccount = removeAccount;
window.openAccountSwitcher = openAccountSwitcher;
window.closeAccountSwitcher = closeAccountSwitcher;
window.switchToAccount = switchToAccount;
window.removeAccount = removeAccount;
window.openProfileManager = openProfileManager; // Для совместимости
window.closeProfileManager = closeProfileManager; // Для совместимости
window.switchToProfile = switchToProfile; // Для совместимости
window.removeProfile = removeProfile; // Для совместимости
window.addNewProfile = addNewProfile;
window.handleCreatePost = handleCreatePost;
window.closeCreateModal = closeCreateModal;
window.goToStep1 = goToStep1;
window.selectPostCategory = selectPostCategory;
window.submitPost = submitPost;
window.viewPost = viewPost;
window.goBackToForum = goBackToForum;
window.deletePost = deletePost;
window.submitComment = submitComment;
window.filterByCategory = filterByCategory;
window.loadMorePosts = loadMorePosts;
window.searchPosts = searchPosts;
window.showRules = showRules;
window.closeRulesModal = closeRulesModal;
window.showForumRules = showForumRules;
window.closeForumRulesModal = closeForumRulesModal;
window.showFAQ = showFAQ;
window.closeFAQModal = closeFAQModal;
window.toggleFAQ = toggleFAQ;
window.goHome = goHome;
window.openAdminApplication = openAdminApplication;
window.closeAdminApplicationModal = closeAdminApplicationModal;
window.submitAdminApplication = submitAdminApplication;
window.approvePost = approvePost;
window.rejectPost = rejectPost;
window.closePostAsResolved = closePostAsResolved;
window.reopenPost = reopenPost;
window.toggleFavorite = toggleFavorite;
window.openFavorites = openFavorites;
window.openMessages = openMessages;
window.openConversation = openConversation;
window.sendMessage = sendMessage;
window.openMessageModal = openMessageModal;
window.closeMessageModal = closeMessageModal;
window.sendNewMessage = sendNewMessage;
window.openNotifications = openNotifications;
window.handleNotificationClick = handleNotificationClick;
window.markAllNotificationsRead = markAllNotificationsRead;
window.giveReputation = giveReputation;
window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.switchAdminTab = switchAdminTab;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminPosts = loadAdminPosts;
window.openAdminUserModal = openAdminUserModal;
window.closeAdminUserModal = closeAdminUserModal;
window.changeUserRole = changeUserRole;
window.banUser = banUser;
window.unbanUser = unbanUser;
window.deleteUserAdmin = deleteUserAdmin;
window.togglePinPost = togglePinPost;
window.toggleHotPost = toggleHotPost;
window.deletePostAdmin = deletePostAdmin;
window.assignStaffRole = assignStaffRole;
window.demoteStaff = demoteStaff;
window.loadAdminApplications = loadAdminApplications;
window.approveApplication = approveApplication;
window.rejectApplication = rejectApplication;
window.loadAdminVerifications = loadAdminVerifications;
window.approveVerification = approveVerification;
window.rejectVerification = rejectVerification;
window.closeBanModal = closeBanModal;
window.confirmBan = confirmBan;
window.muteUser = muteUser;
window.closeMuteModal = closeMuteModal;
window.confirmMute = confirmMute;
window.unmuteUser = unmuteUser;
window.closeRejectModal = closeRejectModal;
window.confirmReject = confirmReject;
window.rejectPost = rejectPost;
window.closeRejectPostModal = closeRejectPostModal;
window.confirmRejectPost = confirmRejectPost;
window.openEmailVerifyModal = openEmailVerifyModal;
window.closeEmailVerifyModal = closeEmailVerifyModal;
window.verifyEmail = verifyEmail;
window.refreshEmailCode = refreshEmailCode;
window.openRobloxVerifyModal = openRobloxVerifyModal;
window.closeRobloxVerifyModal = closeRobloxVerifyModal;
window.verifyRobloxByUserId = verifyRobloxByUserId;
window.useEmailSuggestion = useEmailSuggestion;
window.loadAdminComments = loadAdminComments;
window.toggleCommentSelection = toggleCommentSelection;
window.deleteCommentAdmin = deleteCommentAdmin;
window.deleteSelectedComments = deleteSelectedComments;
window.loadAnalytics = loadAnalytics;
window.exportAnalytics = exportAnalytics;
window.loadTemplates = loadTemplates;
window.openTemplateModal = openTemplateModal;
window.saveTemplate = saveTemplate;
window.editTemplate = editTemplate;
window.deleteTemplate = deleteTemplate;
window.useTemplate = useTemplate;
window.sendTemplate = sendTemplate;
window.exportData = exportData;
window.handleImportFile = handleImportFile;
window.createBackup = createBackup;
window.optimizeDatabase = optimizeDatabase;
window.clearOldData = clearOldData;
window.checkDatabaseIntegrity = checkDatabaseIntegrity;
window.loadAdminSettings = loadAdminSettings;
window.saveSetting = saveSetting;
window.exportActivityLog = exportActivityLog;
window.toggleUserSelection = toggleUserSelection;
window.toggleUserSelectionByClick = toggleUserSelectionByClick;
window.togglePostSelection = togglePostSelection;
window.massBanUsers = massBanUsers;
window.massUnbanUsers = massUnbanUsers;
window.massDeleteUsers = massDeleteUsers;
window.massPinPosts = massPinPosts;
window.massUnpinPosts = massUnpinPosts;
window.massDeletePosts = massDeletePosts;
window.showConfirm = showConfirm;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
window.showPrompt = showPrompt;
window.closePromptModal = closePromptModal;
window.executePromptAction = executePromptAction;

// ===== UNIVERSAL CONFIRM/PROMPT MODALS =====
let confirmCallback = null;
let promptCallback = null;

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').innerHTML = `<i class="fas fa-question-circle"></i> ${title}`;
    document.getElementById('confirmModalMessage').textContent = message;
    confirmCallback = onConfirm;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
    confirmCallback = null;
}

function executeConfirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

function showPrompt(title, label, placeholder, onConfirm) {
    document.getElementById('promptModalTitle').innerHTML = `<i class="fas fa-edit"></i> ${title}`;
    document.getElementById('promptModalLabel').textContent = label;
    document.getElementById('promptModalInput').value = '';
    document.getElementById('promptModalInput').placeholder = placeholder || 'Введите текст...';
    promptCallback = onConfirm;
    document.getElementById('promptModal').classList.remove('hidden');
}

function closePromptModal() {
    document.getElementById('promptModal').classList.add('hidden');
    promptCallback = null;
}

function executePromptAction() {
    if (promptCallback) {
        const value = document.getElementById('promptModalInput').value.trim();
        promptCallback(value);
    }
    closePromptModal();
}

// Replace browser confirm/prompt
function customConfirm(message) {
    return new Promise((resolve) => {
        showConfirm('Подтвердите действие', message, () => {
            resolve(true);
        });
        // If user clicks cancel, resolve with false
        const cancelBtn = document.querySelector('#confirmModal .btn-glass');
        const originalOnclick = cancelBtn.onclick;
        cancelBtn.onclick = () => {
            closeConfirmModal();
            resolve(false);
        };
    });
}

function customPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        showPrompt('Введите данные', message, '', (value) => {
            resolve(value || null);
        });
        // If user clicks cancel, resolve with null
        const cancelBtn = document.querySelector('#promptModal .btn-glass');
        const originalOnclick = cancelBtn.onclick;
        cancelBtn.onclick = () => {
            closePromptModal();
            resolve(null);
        };
        if (defaultValue) {
            document.getElementById('promptModalInput').value = defaultValue;
        }
    });
}
