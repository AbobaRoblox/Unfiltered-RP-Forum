# Гайд по настройке онлайн-функциональности форума

Этот гайд поможет вам настроить форум для работы в реальном времени, чтобы пользователи из разных городов могли взаимодействовать с сайтом, и все данные (онлайн, пользователи, темы) отображались реально.

## Требования

1. **Сервер с Node.js** (версия 10+)
2. **MySQL база данных**
3. **Хостинг с поддержкой Node.js** (например, Timeweb, Beget и т.д.)
4. **Домен или поддомен**

## Шаг 1: Подготовка сервера

### 1.1 Загрузка файлов на сервер

Загрузите все файлы форума на сервер через FTP/SFTP:
- `index.html`
- `styles.css`
- `script.js`
- `package.json`
- `server-mysql.js`
- Все папки с иконками (`icons/`)

### 1.2 Настройка базы данных MySQL

1. Создайте базу данных MySQL через панель хостинга
2. Импортируйте `database_dump.sql` в базу данных
3. Запишите данные для подключения:
   - Хост (обычно `localhost`)
   - Имя пользователя
   - Пароль
   - Имя базы данных

### 1.3 Настройка server-mysql.js

Откройте файл `server-mysql.js` и обновите параметры подключения к базе данных:

```javascript
const dbConfig = {
    host: 'localhost',           // Хост MySQL
    user: 'your_username',       // Ваш логин MySQL
    password: 'your_password',   // Ваш пароль MySQL
    database: 'your_database'    // Имя базы данных
};
```

## Шаг 2: Установка зависимостей

Подключитесь к серверу через SSH и выполните:

```bash
cd /путь/к/проекту
npm install
```

Это установит все необходимые пакеты (например, `mysql2`, `express` и т.д.)

## Шаг 3: Настройка клиентской части для работы с сервером

### 3.1 Изменение API endpoint в script.js

Найдите в файле `script.js` объект `api` и измените базовый URL:

```javascript
const api = {
    token: localStorage.getItem('urp_token'),
    
    async request(endpoint, options = {}) {
        const baseURL = 'https://your-domain.com'; // Замените на ваш домен
        const url = `${baseURL}${endpoint}`;
        
        // ... остальной код
    }
}
```

Или, если используете относительные пути, убедитесь, что запросы идут на тот же домен.

### 3.2 Настройка CORS на сервере

В файле `server-mysql.js` убедитесь, что CORS настроен правильно для вашего домена:

```javascript
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://your-domain.com');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
```

## Шаг 4: Запуск сервера

### 4.1 Ручной запуск (для тестирования)

```bash
cd /путь/к/проекту
node server-mysql.js
```

Сервер должен запуститься на порту 3000 (или на том, который указан в коде).

### 4.2 Автоматический запуск через PM2 (рекомендуется)

Установите PM2 глобально:
```bash
npm install -g pm2
```

Запустите сервер через PM2:
```bash
pm2 start server-mysql.js --name forum-server
pm2 save
pm2 startup
```

PM2 будет автоматически перезапускать сервер при перезагрузке системы.

### 4.3 Настройка CRON (альтернатива PM2)

Создайте файл `start-server.sh`:
```bash
#!/bin/bash
cd /путь/к/проекту
node server-mysql.js >> server.log 2>&1
```

Сделайте его исполняемым:
```bash
chmod +x start-server.sh
```

Настройте CRON задачу (выполнять каждые 5 минут):
```bash
*/5 * * * * /путь/к/start-server.sh
```

## Шаг 5: Настройка домена и проксирования

### 5.1 Настройка Nginx (если используется)

Создайте конфигурацию Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5.2 Настройка Apache (если используется)

В файле `.htaccess` добавьте:

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]
```

## Шаг 6: Настройка реального времени (опционально)

Для полноценной работы в реальном времени (обновление комментариев, уведомлений без перезагрузки страницы) рекомендуется использовать WebSocket.

### 6.1 Установка Socket.io

```bash
npm install socket.io
```

### 6.2 Настройка на сервере

Добавьте в `server-mysql.js`:

```javascript
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "https://your-domain.com",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Пользователь подключен');
    
    socket.on('disconnect', () => {
        console.log('Пользователь отключен');
    });
});

server.listen(3000, () => {
    console.log('Сервер запущен на порту 3000');
});
```

### 6.3 Настройка на клиенте

В `index.html` перед закрывающим тегом `</body>` добавьте:

```html
<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
<script>
    const socket = io('https://your-domain.com');
    
    socket.on('newComment', (data) => {
        // Обновить комментарии на странице
    });
    
    socket.on('newPost', (data) => {
        // Обновить список постов
    });
</script>
```

## Шаг 7: Проверка работы

1. Откройте сайт в браузере: `https://your-domain.com`
2. Зарегистрируйте тестовый аккаунт
3. Создайте тему
4. Откройте сайт с другого устройства/браузера
5. Проверьте, что тема отображается
6. Проверьте счетчики онлайн пользователей

## Шаг 8: Безопасность

### 8.1 HTTPS

Настройте SSL сертификат (Let's Encrypt бесплатный):
```bash
certbot --nginx -d your-domain.com
```

### 8.2 Защита от SQL инъекций

Убедитесь, что в `server-mysql.js` используются параметризованные запросы:

```javascript
await pool.execute('SELECT * FROM users WHERE id = ?', [userId]);
```

### 8.3 Ограничение частоты запросов

Установите `express-rate-limit`:
```bash
npm install express-rate-limit
```

Используйте в `server-mysql.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100 // максимум 100 запросов
});

app.use('/api/', limiter);
```

## Решение проблем

### Сервер не запускается

1. Проверьте логи: `pm2 logs forum-server` или `cat server.log`
2. Убедитесь, что порт 3000 свободен: `netstat -tulpn | grep 3000`
3. Проверьте подключение к базе данных

### База данных не подключается

1. Проверьте правильность данных в `dbConfig`
2. Убедитесь, что MySQL запущен
3. Проверьте права доступа пользователя MySQL

### CORS ошибки

1. Убедитесь, что в заголовках указан правильный домен
2. Проверьте, что сервер отвечает на OPTIONS запросы

### Данные не сохраняются

1. Проверьте права на запись в базу данных
2. Проверьте логи сервера на наличие ошибок SQL

## Поддержка

При возникновении проблем:
1. Проверьте логи сервера
2. Проверьте консоль браузера (F12)
3. Убедитесь, что все зависимости установлены
4. Проверьте настройки хостинга

## Дополнительные улучшения

- **Кэширование**: Используйте Redis для кэширования популярных запросов
- **CDN**: Настройте CDN для статических файлов (CSS, JS, изображения)
- **Резервное копирование**: Настройте автоматическое резервное копирование базы данных
- **Мониторинг**: Используйте PM2 Monitor или другие инструменты для мониторинга сервера

