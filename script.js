// ===== DATABASE (localStorage) =====
const DB = {
    get(key) {
        try {
            const data = localStorage.getItem('urp_' + key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('DB get error:', e);
            return null;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem('urp_' + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('DB set error:', e);
            return false;
        }
    },
    
    delete(key) {
        localStorage.removeItem('urp_' + key);
    },
    
    init() {
        if (!this.get('users')) this.set('users', []);
        if (!this.get('posts')) this.set('posts', []);
        if (!this.get('comments')) this.set('comments', []);
        if (!this.get('adminApplications')) this.set('adminApplications', []);
        if (!this.get('stats')) this.set('stats', { totalVisits: 0 });
        
        // Create default admin user if not exists
        const users = this.get('users') || [];
        if (!users.find(u => u.role === 'admin')) {
            // You can login with admin/admin123 to test admin features
            const adminUser = {
                id: this.generateId(),
                username: 'Admin',
                email: 'admin@unfilteredrp.com',
                robloxNick: 'AdminRP',
                password: 'admin123',
                avatar: '👑',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                role: 'admin',
                isVerified: true,
                postsCount: 0,
                commentsCount: 0
            };
            users.push(adminUser);
            this.set('users', users);
        }
        
        // Increment visit counter
        const stats = this.get('stats');
        stats.totalVisits++;
        this.set('stats', stats);
    },
    
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Find user by ID
    findUser(userId) {
        const users = this.get('users') || [];
        return users.find(u => u.id === userId);
    },
    
    // Find user by username
    findUserByUsername(username) {
        const users = this.get('users') || [];
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    },
    
    // Find user by email
    findUserByEmail(email) {
        const users = this.get('users') || [];
        return users.find(u => u.email.toLowerCase() === email.toLowerCase());
    },
    
    // Add user
    addUser(userData) {
        const users = this.get('users') || [];
        const newUser = {
            id: this.generateId(),
            ...userData,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            role: 'user',
            isVerified: false,
            postsCount: 0,
            commentsCount: 0
        };
        users.push(newUser);
        this.set('users', users);
        return newUser;
    },
    
    // Update user
    updateUser(userId, updates) {
        const users = this.get('users') || [];
        const index = users.findIndex(u => u.id === userId);
        if (index !== -1) {
            users[index] = { ...users[index], ...updates };
            this.set('users', users);
            return users[index];
        }
        return null;
    },
    
    // Add post
    addPost(postData) {
        const posts = this.get('posts') || [];
        const newPost = {
            id: this.generateId(),
            ...postData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            views: 0,
            isPinned: false,
            isHot: false,
            status: 'open',
            statusText: 'Открыто'
        };
        posts.unshift(newPost);
        this.set('posts', posts);
        
        // Update user posts count
        if (postData.authorId) {
            const user = this.findUser(postData.authorId);
            if (user) {
                this.updateUser(postData.authorId, { postsCount: (user.postsCount || 0) + 1 });
            }
        }
        
        return newPost;
    },
    
    // Add comment
    addComment(commentData) {
        const comments = this.get('comments') || [];
        const newComment = {
            id: this.generateId(),
            ...commentData,
            createdAt: new Date().toISOString()
        };
        comments.push(newComment);
        this.set('comments', comments);
        
        // Update user comments count
        if (commentData.authorId) {
            const user = this.findUser(commentData.authorId);
            if (user) {
                this.updateUser(commentData.authorId, { commentsCount: (user.commentsCount || 0) + 1 });
            }
        }
        
        return newComment;
    },
    
    // Get comments for post
    getPostComments(postId) {
        const comments = this.get('comments') || [];
        return comments.filter(c => c.postId === postId);
    },
    
    // Increment post views
    incrementViews(postId) {
        const posts = this.get('posts') || [];
        const index = posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            posts[index].views = (posts[index].views || 0) + 1;
            this.set('posts', posts);
            return posts[index];
        }
        return null;
    },
    
    // Update post status
    updatePostStatus(postId, status, statusText) {
        const posts = this.get('posts') || [];
        const index = posts.findIndex(p => p.id === postId);
        if (index !== -1) {
            posts[index].status = status;
            posts[index].statusText = statusText;
            posts[index].updatedAt = new Date().toISOString();
            this.set('posts', posts);
            return posts[index];
        }
        return null;
    },
    
    // Add admin application
    addAdminApplication(appData) {
        const apps = this.get('adminApplications') || [];
        const newApp = {
            id: this.generateId(),
            ...appData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        apps.push(newApp);
        this.set('adminApplications', apps);
        return newApp;
    },
    
    // Get post by ID
    getPost(postId) {
        const posts = this.get('posts') || [];
        return posts.find(p => p.id === postId);
    }
};

DB.init();

// ===== STATE =====
let currentUser = DB.get('currentUser') || null;
let currentCategory = 'all';
let selectedPostCategory = null;
let currentPostId = null;
let postsPerPage = 10;
let currentPage = 1;
let searchQuery = '';

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

// ===== AUTHENTICATION =====
function openAuthModal(form = 'login') {
    document.getElementById('authModal').classList.add('active');
    switchAuthForm(form);
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
    document.body.style.overflow = '';
    // Clear forms
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

function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showToast('error', 'Ошибка', 'Заполните все поля');
        return;
    }
    
    const user = DB.findUserByUsername(username);
    
    if (user && user.password === password) {
        // Update last login
        DB.updateUser(user.id, { lastLogin: new Date().toISOString() });
        
        currentUser = { ...user, lastLogin: new Date().toISOString() };
        DB.set('currentUser', currentUser);
        closeAuthModal();
        updateAuthUI();
        showToast('success', 'Добро пожаловать!', `Вы вошли как ${user.username}`);
    } else {
        showToast('error', 'Ошибка входа', 'Неверное имя пользователя или пароль');
    }
}

function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const robloxNick = document.getElementById('regRoblox').value.trim();
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // Validation
    if (!username || !email || !robloxNick || !password) {
        showToast('error', 'Ошибка', 'Заполните все обязательные поля');
        return;
    }
    
    // Username validation
    if (username.length < 3) {
        showToast('error', 'Ошибка', 'Имя пользователя должно быть не менее 3 символов');
        return;
    }
    
    if (username.length > 20) {
        showToast('error', 'Ошибка', 'Имя пользователя должно быть не более 20 символов');
        return;
    }
    
    if (!/^[a-zA-Z0-9_а-яА-ЯёЁ]+$/.test(username)) {
        showToast('error', 'Ошибка', 'Имя пользователя может содержать только буквы, цифры и _');
        return;
    }
    
    // Email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showToast('error', 'Ошибка', 'Введите корректный email адрес');
        return;
    }
    
    // Password validation
    if (password.length < 6) {
        showToast('error', 'Ошибка', 'Пароль должен быть не менее 6 символов');
        return;
    }
    
    if (password !== passwordConfirm) {
        showToast('error', 'Ошибка', 'Пароли не совпадают');
        return;
    }
    
    if (!agreeTerms) {
        showToast('error', 'Ошибка', 'Необходимо согласиться с правилами');
        return;
    }
    
    // Check if user exists
    if (DB.findUserByUsername(username)) {
        showToast('error', 'Ошибка', 'Пользователь с таким именем уже существует');
        return;
    }
    
    if (DB.findUserByEmail(email)) {
        showToast('error', 'Ошибка', 'Email уже используется');
        return;
    }
    
    // Create user using improved DB method
    const newUser = DB.addUser({
        username,
        email,
        robloxNick,
        password,
        avatar: avatars[Math.floor(Math.random() * avatars.length)]
    });
    
    // Auto login
    currentUser = newUser;
    DB.set('currentUser', newUser);
    
    closeAuthModal();
    updateAuthUI();
    updateStats();
    
    // Show welcome modal
    showWelcomeModal(newUser);
}

// Password strength checker
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

// Password match checker
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

// Welcome modal
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

function logout() {
    currentUser = null;
    DB.set('currentUser', null);
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
    
    if (currentUser) {
        guestButtons.classList.add('hidden');
        userButtons.classList.remove('hidden');
        userName.textContent = currentUser.username;
        userAvatar.textContent = currentUser.avatar;
    } else {
        guestButtons.classList.remove('hidden');
        userButtons.classList.add('hidden');
    }
    
    updateOnlineUsers();
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

// ===== PROFILE =====
function openProfile(userId = null) {
    closeUserMenu();
    
    const profileUser = userId 
        ? (DB.get('users') || []).find(u => u.id === userId) 
        : currentUser;
    
    if (!profileUser) {
        showToast('error', 'Ошибка', 'Пользователь не найден');
        return;
    }
    
    // Hide other sections
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('forum').classList.add('hidden');
    document.getElementById('postView').classList.add('hidden');
    document.getElementById('profileSection').classList.remove('hidden');
    
    // Fill profile data
    document.getElementById('profileAvatar').textContent = profileUser.avatar;
    document.getElementById('profileName').textContent = profileUser.username;
    document.getElementById('profileRoblox').textContent = profileUser.robloxNick;
    document.getElementById('profileDate').textContent = new Date(profileUser.createdAt).toLocaleDateString('ru-RU');
    
    // Update badges based on role
    const badgesEl = document.querySelector('.profile-badges');
    if (badgesEl) {
        let badgeHTML = '';
        if (profileUser.role === 'admin') {
            badgeHTML = '<span class="profile-badge admin"><i class="fas fa-crown"></i> Администратор</span>';
        } else if (profileUser.role === 'moderator') {
            badgeHTML = '<span class="profile-badge moderator"><i class="fas fa-shield-alt"></i> Модератор</span>';
        } else {
            badgeHTML = '<span class="profile-badge user"><i class="fas fa-user"></i> Пользователь</span>';
        }
        badgesEl.innerHTML = badgeHTML;
    }
    
    // Calculate stats
    const posts = DB.get('posts') || [];
    const comments = DB.get('comments') || [];
    const userPosts = posts.filter(p => p.authorId === profileUser.id);
    const userComments = comments.filter(c => c.authorId === profileUser.id);
    const totalViews = userPosts.reduce((sum, p) => sum + (p.views || 0), 0);
    
    document.getElementById('profilePosts').textContent = userPosts.length;
    document.getElementById('profileComments').textContent = userComments.length;
    document.getElementById('profileViews').textContent = totalViews;
    
    // Profile actions
    const actionsEl = document.getElementById('profileActions');
    if (currentUser && currentUser.id === profileUser.id) {
        actionsEl.innerHTML = `
            <button class="btn btn-glass" onclick="openSettings()">
                <i class="fas fa-cog"></i> Настройки
            </button>
        `;
    } else {
        actionsEl.innerHTML = '';
    }
    
    // Render user posts
    const postsListEl = document.getElementById('profilePostsList');
    if (userPosts.length === 0) {
        postsListEl.innerHTML = '<div class="profile-empty"><i class="fas fa-inbox"></i><p>Пользователь ещё не создал ни одной темы</p></div>';
    } else {
        postsListEl.innerHTML = userPosts.slice(0, 10).map(post => `
            <div class="profile-post-item" onclick="viewPost('${post.id}')">
                <div>
                    <div class="profile-post-title">${escapeHtml(post.title)}</div>
                    <div class="profile-post-meta">
                        <span class="badge-category">${categoryNames[post.category]}</span> • 
                        ${getTimeAgo(post.createdAt)}
                    </div>
                </div>
                <span class="status-badge status-${post.status}">${post.statusText}</span>
            </div>
        `).join('');
    }
    
    window.scrollTo(0, 0);
}

function openMyPosts() {
    closeUserMenu();
    if (!currentUser) return;
    openProfile(currentUser.id);
}

// ===== SETTINGS =====
function openSettings() {
    closeUserMenu();
    if (!currentUser) return;
    
    document.getElementById('settingsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Fill current data
    document.getElementById('settingsRoblox').value = currentUser.robloxNick || '';
    document.getElementById('settingsEmail').value = currentUser.email || '';
    
    // Render avatar grid
    const avatarGrid = document.getElementById('avatarGrid');
    avatarGrid.innerHTML = avatars.map(avatar => `
        <button type="button" class="avatar-option ${avatar === currentUser.avatar ? 'selected' : ''}" 
                onclick="selectAvatar('${avatar}', this)">
            ${avatar}
        </button>
    `).join('');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
    document.body.style.overflow = '';
}

function selectAvatar(avatar, btn) {
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
    currentUser.avatar = avatar;
}

function saveSettings(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const robloxNick = document.getElementById('settingsRoblox').value.trim();
    const email = document.getElementById('settingsEmail').value.trim();
    const currentPassword = document.getElementById('settingsCurrentPassword').value;
    const newPassword = document.getElementById('settingsNewPassword').value;
    
    // Prepare updates
    const updates = {};
    
    if (robloxNick) updates.robloxNick = robloxNick;
    if (email) {
        // Check if email is already used by another user
        const existingUser = DB.findUserByEmail(email);
        if (existingUser && existingUser.id !== currentUser.id) {
            showToast('error', 'Ошибка', 'Этот email уже используется');
            return;
        }
        updates.email = email;
    }
    updates.avatar = currentUser.avatar;
    
    // Change password if provided
    if (currentPassword || newPassword) {
        if (!currentPassword) {
            showToast('error', 'Ошибка', 'Введите текущий пароль');
            return;
        }
        if (currentPassword !== currentUser.password) {
            showToast('error', 'Ошибка', 'Неверный текущий пароль');
            return;
        }
        if (!newPassword) {
            showToast('error', 'Ошибка', 'Введите новый пароль');
            return;
        }
        if (newPassword.length < 6) {
            showToast('error', 'Ошибка', 'Новый пароль должен быть не менее 6 символов');
            return;
        }
        updates.password = newPassword;
    }
    
    // Use improved DB method
    const updatedUser = DB.updateUser(currentUser.id, updates);
    if (updatedUser) {
        currentUser = updatedUser;
        DB.set('currentUser', currentUser);
    }
    
    updateAuthUI();
    closeSettingsModal();
    showToast('success', 'Сохранено', 'Настройки успешно обновлены');
    
    // Clear password fields
    document.getElementById('settingsCurrentPassword').value = '';
    document.getElementById('settingsNewPassword').value = '';
    
    // Refresh profile if open
    if (!document.getElementById('profileSection').classList.contains('hidden')) {
        openProfile();
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
    
    // Show appropriate form
    document.querySelectorAll('.form-fields').forEach(f => f.classList.add('hidden'));
    document.getElementById(category + 'Fields').classList.remove('hidden');
}

function resetPostForm() {
    selectedPostCategory = null;
    document.querySelectorAll('#postForm input, #postForm textarea, #postForm select').forEach(el => {
        if (el.type !== 'submit') el.value = '';
    });
}

function submitPost(e) {
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
    
    // Create post using improved DB method
    DB.addPost({
        category: categoryMap[selectedPostCategory],
        title,
        content,
        extraData,
        authorId: currentUser.id,
        author: currentUser.username,
        avatar: currentUser.avatar
    });
    
    closeCreateModal();
    renderPosts();
    updateStats();
    showToast('success', 'Тема создана!', 'Ваше обращение успешно опубликовано');
}

function renderPosts() {
    const posts = DB.get('posts') || [];
    
    // Filter by category
    let filteredPosts = currentCategory === 'all' 
        ? posts 
        : posts.filter(post => post.category === currentCategory);
    
    // Filter by search
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
            post.title.toLowerCase().includes(query) || 
            post.author.toLowerCase().includes(query)
        );
    }
    
    // Sort
    const sortBy = document.getElementById('sortSelect')?.value || 'newest';
    filteredPosts = sortPosts(filteredPosts, sortBy);
    
    // Update UI
    postsTitle.textContent = categoryNames[currentCategory];
    postsCount.textContent = `Показано ${filteredPosts.length} тем`;
    
    if (filteredPosts.length === 0) {
        postsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        loadMoreBtn.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    // Pagination
    const postsToShow = filteredPosts.slice(0, currentPage * postsPerPage);
    loadMoreBtn.classList.toggle('hidden', postsToShow.length >= filteredPosts.length);
    
    postsList.innerHTML = postsToShow.map((post, index) => {
        const comments = DB.getPostComments(post.id);
        const timeAgo = getTimeAgo(post.createdAt);
        
        return `
            <article class="post-card ${post.isPinned ? 'pinned' : ''}" 
                     style="animation-delay: ${index * 0.03}s"
                     onclick="viewPost('${post.id}')">
                <div class="post-content">
                    <div class="post-avatar">${post.avatar}</div>
                    <div class="post-main">
                        <div class="post-badges">
                            ${post.isPinned ? '<span class="badge badge-pinned"><i class="fas fa-star"></i> Закреплено</span>' : ''}
                            ${post.isHot ? '<span class="badge badge-hot"><i class="fas fa-fire"></i> Горячее</span>' : ''}
                            <span class="badge badge-category">${categoryNames[post.category]}</span>
                        </div>
                        <h3 class="post-title">${escapeHtml(post.title)}</h3>
                        <div class="post-meta">
                            <span><i class="fas fa-user"></i> ${escapeHtml(post.author)}</span>
                            <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                        </div>
                    </div>
                    <div class="post-stats">
                        <span class="status-badge status-${post.status}">${post.statusText}</span>
                        <div class="post-counters">
                            <span title="Комментарии"><i class="fas fa-comment"></i> ${comments.length}</span>
                            <span title="Просмотры"><i class="fas fa-eye"></i> ${post.views}</span>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    updateCategoryCounts();
}

function sortPosts(posts, sortBy) {
    const sorted = [...posts];
    
    // Always put pinned first
    sorted.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    
    switch (sortBy) {
        case 'popular':
            sorted.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
                return (b.views || 0) - (a.views || 0);
            });
            break;
        case 'comments':
            sorted.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
                const aComments = DB.getPostComments(a.id).length;
                const bComments = DB.getPostComments(b.id).length;
                return bComments - aComments;
            });
            break;
        default: // newest
            sorted.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });
    }
    
    return sorted;
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
    
    // Update active button
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });
    
    renderPosts();
    
    // Scroll to forum
    document.getElementById('forum').scrollIntoView({ behavior: 'smooth' });
}

function updateCategoryCounts() {
    const posts = DB.get('posts') || [];
    
    document.getElementById('countAll').textContent = posts.length;
    document.getElementById('countComplaints').textContent = posts.filter(p => p.category === 'complaints').length;
    document.getElementById('countAppeals').textContent = posts.filter(p => p.category === 'appeals').length;
    document.getElementById('countQuestions').textContent = posts.filter(p => p.category === 'questions').length;
    document.getElementById('countSuggestions').textContent = posts.filter(p => p.category === 'suggestions').length;
}

// ===== POST VIEW =====
function viewPost(postId) {
    const posts = DB.get('posts') || [];
    // Handle both string and number IDs
    let post = posts.find(p => p.id === postId || p.id === String(postId));
    
    if (!post) return;
    
    // Increment views using improved method
    post = DB.incrementViews(postId) || post;
    
    currentPostId = postId;
    
    // Hide other sections
    document.getElementById('heroSection').classList.add('hidden');
    document.getElementById('forum').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('postView').classList.remove('hidden');
    
    const comments = DB.getPostComments(postId);
    const timeAgo = getTimeAgo(post.createdAt);
    
    // Render post
    const adminControlsHTML = isAdmin() ? `
        <div class="admin-controls">
            <div class="admin-controls-title">
                <i class="fas fa-shield-alt"></i>
                Панель администратора
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
            ${post.status === 'approved' || post.status === 'resolved' || post.status === 'rejected' ? `
                <button class="btn btn-glass btn-sm" onclick="reopenPost('${post.id}')">
                    <i class="fas fa-redo"></i> Открыть заново
                </button>
            ` : ''}
            ${post.status !== 'resolved' && post.status !== 'rejected' ? `
                <button class="btn btn-primary btn-sm" onclick="closePostAsResolved('${post.id}')">
                    <i class="fas fa-check-double"></i> Решено
                </button>
            ` : ''}
        </div>
    ` : '';
    
    document.getElementById('postFull').innerHTML = `
        <div class="post-full-header">
            <div class="post-full-badges">
                ${post.isPinned ? '<span class="badge badge-pinned"><i class="fas fa-star"></i> Закреплено</span>' : ''}
                <span class="badge badge-category">${categoryNames[post.category]}</span>
                <span class="status-badge status-${post.status}">${post.statusText}</span>
            </div>
            <h1 class="post-full-title">${escapeHtml(post.title)}</h1>
            <div class="post-full-meta">
                <span onclick="openProfile('${post.authorId}')" style="cursor:pointer;"><i class="fas fa-user"></i> ${escapeHtml(post.author)}</span>
                <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                <span><i class="fas fa-eye"></i> ${post.views} просмотров</span>
                <span><i class="fas fa-comment"></i> ${comments.length} комментариев</span>
            </div>
        </div>
        <div class="post-full-content">
            ${formatContent(post.content)}
        </div>
        <div class="post-full-actions">
            ${currentUser && currentUser.id === post.authorId ? `
                <button class="btn btn-danger btn-sm" onclick="deletePost('${post.id}')">
                    <i class="fas fa-trash"></i> Удалить тему
                </button>
            ` : ''}
        </div>
        ${adminControlsHTML}
    `;
    
    // Render comments
    renderComments(postId);
    
    window.scrollTo(0, 0);
}

function goBackToForum() {
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('forum').classList.remove('hidden');
    document.getElementById('postView').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    currentPostId = null;
    renderPosts();
}

function deletePost(postId) {
    if (!confirm('Вы уверены, что хотите удалить эту тему? Это действие нельзя отменить.')) return;
    
    let posts = DB.get('posts') || [];
    posts = posts.filter(p => p.id !== postId && p.id !== String(postId));
    DB.set('posts', posts);
    
    // Delete comments
    let comments = DB.get('comments') || [];
    comments = comments.filter(c => c.postId !== postId && c.postId !== String(postId));
    DB.set('comments', comments);
    
    goBackToForum();
    updateStats();
    showToast('success', 'Удалено', 'Тема успешно удалена');
}

// ===== COMMENTS =====
function renderComments(postId) {
    const comments = DB.getPostComments(postId);
    
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
                <div class="comment ${comment.isAdminAction ? 'comment-admin' : ''}">
                    <div class="comment-avatar">${comment.avatar}</div>
                    <div class="comment-content">
                        <div class="comment-header">
                            <span class="comment-author" onclick="openProfile('${comment.authorId}')" style="cursor:pointer;">${escapeHtml(comment.author)}</span>
                            <span class="comment-date">${getTimeAgo(comment.createdAt)}</span>
                        </div>
                        <p class="comment-text">${comment.isAdminAction ? formatContent(comment.text) : escapeHtml(comment.text)}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function submitComment(postId) {
    if (!currentUser) return;
    
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    
    if (!text) {
        showToast('error', 'Ошибка', 'Введите текст комментария');
        return;
    }
    
    if (text.length > 1000) {
        showToast('error', 'Ошибка', 'Комментарий слишком длинный (максимум 1000 символов)');
        return;
    }
    
    // Use improved DB method
    DB.addComment({
        postId,
        text,
        authorId: currentUser.id,
        author: currentUser.username,
        avatar: currentUser.avatar
    });
    
    renderComments(postId);
    showToast('success', 'Отправлено', 'Комментарий добавлен');
}

// ===== STATS =====
function updateStats() {
    const posts = DB.get('posts') || [];
    const users = DB.get('users') || [];
    
    document.getElementById('totalPosts').textContent = posts.length;
    document.getElementById('totalUsers').textContent = users.length;
}

function updateOnlineUsers() {
    const onlineList = document.getElementById('onlineList');
    
    if (currentUser) {
        onlineList.innerHTML = `
            <div class="online-user">
                <span class="user-dot"></span>
                <span>${currentUser.username}</span>
            </div>
        `;
        document.getElementById('onlineUsers').textContent = '1';
    } else {
        onlineList.innerHTML = '<div class="online-empty">Гости</div>';
        document.getElementById('onlineUsers').textContent = '1';
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
    
    // Pre-fill known data
    document.getElementById('adminAppNick').value = currentUser.robloxNick || '';
}

function closeAdminApplicationModal() {
    document.getElementById('adminApplicationModal').classList.remove('active');
    document.body.style.overflow = '';
    // Clear form
    ['adminAppNick', 'adminAppAge', 'adminAppHours', 'adminAppExperience', 'adminAppReason', 'adminAppDiscord'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function submitAdminApplication(e) {
    e.preventDefault();
    
    if (!currentUser) return;
    
    const nick = document.getElementById('adminAppNick').value.trim();
    const age = document.getElementById('adminAppAge').value;
    const hours = document.getElementById('adminAppHours').value;
    const experience = document.getElementById('adminAppExperience').value.trim();
    const reason = document.getElementById('adminAppReason').value.trim();
    const discord = document.getElementById('adminAppDiscord').value.trim();
    
    if (!nick || !age || !hours || !reason || !discord) {
        showToast('error', 'Ошибка', 'Заполните все обязательные поля');
        return;
    }
    
    if (parseInt(age) < 14) {
        showToast('error', 'Ошибка', 'Минимальный возраст для подачи заявки - 14 лет');
        return;
    }
    
    DB.addAdminApplication({
        userId: currentUser.id,
        username: currentUser.username,
        nick,
        age: parseInt(age),
        hours,
        experience,
        reason,
        discord
    });
    
    closeAdminApplicationModal();
    showToast('success', 'Заявка отправлена!', 'С вами свяжутся в Discord');
}

// ===== ADMIN MODERATION =====
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

function approvePost(postId) {
    if (!isAdmin()) return;
    
    DB.updatePostStatus(postId, 'approved', 'Принято');
    viewPost(postId);
    showToast('success', 'Принято', 'Тема одобрена');
}

function rejectPost(postId) {
    if (!isAdmin()) return;
    
    const reason = prompt('Укажите причину отклонения (необязательно):');
    DB.updatePostStatus(postId, 'rejected', 'Отклонено');
    
    // Add admin comment if reason provided
    if (reason && reason.trim()) {
        DB.addComment({
            postId,
            text: `❌ **Тема отклонена.** Причина: ${reason.trim()}`,
            authorId: currentUser.id,
            author: currentUser.username,
            avatar: currentUser.avatar,
            isAdminAction: true
        });
    }
    
    viewPost(postId);
    showToast('info', 'Отклонено', 'Тема отклонена');
}

function closePostAsResolved(postId) {
    if (!isAdmin()) return;
    
    DB.updatePostStatus(postId, 'resolved', 'Решено');
    viewPost(postId);
    showToast('success', 'Закрыто', 'Тема отмечена как решённая');
}

function reopenPost(postId) {
    if (!isAdmin()) return;
    
    DB.updatePostStatus(postId, 'open', 'Открыто');
    viewPost(postId);
    showToast('info', 'Открыто', 'Тема снова открыта');
}

// ===== NAVIGATION =====
function goHome() {
    document.getElementById('heroSection').classList.remove('hidden');
    document.getElementById('forum').classList.remove('hidden');
    document.getElementById('postView').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    window.scrollTo(0, 0);
}

// ===== UTILITIES =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

// Category buttons
document.getElementById('categoryList').addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) filterByCategory(btn.dataset.category);
});

// Mobile menu
document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

// Close modals on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.active').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.style.background = window.pageYOffset > 100 
        ? 'rgba(15, 23, 42, 0.95)' 
        : 'rgba(15, 23, 42, 0.7)';
});

// Smooth scroll for anchor links
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
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    renderPosts();
    updateStats();
    
    console.log('🎮 Unfiltered RP Forum loaded');
    console.log('👥 Users:', (DB.get('users') || []).length);
    console.log('📝 Posts:', (DB.get('posts') || []).length);
});

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
window.closeSettingsModal = closeSettingsModal;
window.selectAvatar = selectAvatar;
window.saveSettings = saveSettings;
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
