-- ============================================
-- ДАМП БАЗЫ ДАННЫХ ДЛЯ ФОРУМА UNFILTERED RP
-- MySQL 8.0+
-- ============================================

-- Создание базы данных (если нужно)
-- CREATE DATABASE IF NOT EXISTS `u3372230_unfilteredrp-bd` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `u3372230_unfilteredrp-bd`;

-- ============================================
-- ТАБЛИЦА: users (Пользователи)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(36) PRIMARY KEY,
    `username` VARCHAR(20) UNIQUE NOT NULL,
    `email` VARCHAR(255) UNIQUE NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `roblox_nick` VARCHAR(100) DEFAULT NULL,
    `rod` VARCHAR(100) DEFAULT NULL,
    `discord` VARCHAR(100) DEFAULT NULL,
    `avatar` VARCHAR(10) DEFAULT NULL,
    `avatar_url` TEXT DEFAULT NULL,
    `role` VARCHAR(20) DEFAULT 'user',
    `reputation` INT DEFAULT 0,
    `is_email_verified` TINYINT(1) DEFAULT 0,
    `is_roblox_verified` TINYINT(1) DEFAULT 0,
    `is_banned` TINYINT(1) DEFAULT 0,
    `ban_reason` TEXT DEFAULT NULL,
    `roblox_user_id` VARCHAR(50) DEFAULT NULL,
    `email_code` VARCHAR(6) DEFAULT NULL,
    `email_code_expires` DATETIME DEFAULT NULL,
    `is_online` TINYINT(1) DEFAULT 0,
    `last_seen` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_username` (`username`),
    INDEX `idx_email` (`email`),
    INDEX `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: posts (Посты/Темы)
-- ============================================
CREATE TABLE IF NOT EXISTS `posts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `category` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `content` TEXT NOT NULL,
    `extra_data` JSON DEFAULT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `views` INT DEFAULT 0,
    `is_pinned` TINYINT(1) DEFAULT 0,
    `is_hot` TINYINT(1) DEFAULT 0,
    `status` VARCHAR(20) DEFAULT 'open',
    `status_text` VARCHAR(100) DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    `updated_at` DATETIME NOT NULL,
    INDEX `idx_category` (`category`),
    INDEX `idx_author` (`author_id`),
    INDEX `idx_status` (`status`),
    INDEX `idx_created` (`created_at`),
    FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: comments (Комментарии)
-- ============================================
CREATE TABLE IF NOT EXISTS `comments` (
    `id` VARCHAR(36) PRIMARY KEY,
    `post_id` VARCHAR(36) NOT NULL,
    `author_id` VARCHAR(36) NOT NULL,
    `text` TEXT NOT NULL,
    `is_admin_action` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_post` (`post_id`),
    INDEX `idx_author` (`author_id`),
    INDEX `idx_created` (`created_at`),
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: messages (Сообщения)
-- ============================================
CREATE TABLE IF NOT EXISTS `messages` (
    `id` VARCHAR(36) PRIMARY KEY,
    `sender_id` VARCHAR(36) NOT NULL,
    `receiver_id` VARCHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_sender` (`sender_id`),
    INDEX `idx_receiver` (`receiver_id`),
    INDEX `idx_created` (`created_at`),
    FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`receiver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: favorites (Избранное)
-- ============================================
CREATE TABLE IF NOT EXISTS `favorites` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `post_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME NOT NULL,
    UNIQUE KEY `unique_favorite` (`user_id`, `post_id`),
    INDEX `idx_user` (`user_id`),
    INDEX `idx_post` (`post_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: reputation (Репутация)
-- ============================================
CREATE TABLE IF NOT EXISTS `reputation` (
    `id` VARCHAR(36) PRIMARY KEY,
    `from_user_id` VARCHAR(36) NOT NULL,
    `to_user_id` VARCHAR(36) NOT NULL,
    `post_id` VARCHAR(36) DEFAULT NULL,
    `value` INT DEFAULT 1,
    `created_at` DATETIME NOT NULL,
    UNIQUE KEY `unique_reputation` (`from_user_id`, `to_user_id`, `post_id`),
    INDEX `idx_from_user` (`from_user_id`),
    INDEX `idx_to_user` (`to_user_id`),
    INDEX `idx_post` (`post_id`),
    FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: notifications (Уведомления)
-- ============================================
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `message` TEXT NOT NULL,
    `link` VARCHAR(255) DEFAULT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_read` (`is_read`),
    INDEX `idx_created` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: admin_applications (Заявки на админа)
-- ============================================
CREATE TABLE IF NOT EXISTS `admin_applications` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `nick` VARCHAR(100) DEFAULT NULL,
    `age` INT DEFAULT NULL,
    `hours` INT DEFAULT NULL,
    `experience` TEXT DEFAULT NULL,
    `reason` TEXT DEFAULT NULL,
    `discord` VARCHAR(100) DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'pending',
    `reject_reason` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_status` (`status`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: roblox_verifications (Верификации Roblox)
-- ============================================
CREATE TABLE IF NOT EXISTS `roblox_verifications` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `roblox_nick` VARCHAR(100) DEFAULT NULL,
    `roblox_user_id` VARCHAR(50) DEFAULT NULL,
    `status` VARCHAR(20) DEFAULT 'pending',
    `reject_reason` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_status` (`status`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ТАБЛИЦА: activity_log (Лог активности)
-- ============================================
CREATE TABLE IF NOT EXISTS `activity_log` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `details` TEXT DEFAULT NULL,
    `created_at` DATETIME NOT NULL,
    INDEX `idx_user` (`user_id`),
    INDEX `idx_action` (`action`),
    INDEX `idx_created` (`created_at`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ВСТАВКА ДАННЫХ: Администратор по умолчанию
-- ============================================
-- Пароль: admin123 (в реальности нужно использовать хеш!)
INSERT INTO `users` (
    `id`, 
    `username`, 
    `email`, 
    `password`, 
    `roblox_nick`, 
    `avatar`, 
    `role`, 
    `is_email_verified`, 
    `is_online`,
    `created_at`, 
    `updated_at`
) VALUES (
    CONCAT(UNIX_TIMESTAMP(), '-', SUBSTRING(MD5(RAND()), 1, 10)),
    'Admin',
    'admin@unfilteredrp.com',
    'admin123', -- ВАЖНО: Замените на хеш пароля!
    'AdminRP',
    '👑',
    'management',
    1,
    0,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE `username`=`username`;

-- ============================================
-- КОНЕЦ ДАМПА
-- ============================================

