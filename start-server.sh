#!/bin/bash

# Скрипт для автозапуска Node.js сервера через CRON
# Путь к директории проекта
PROJECT_DIR="/var/www/u3372230/data"
SERVER_FILE="server-mysql.js"
LOG_FILE="$PROJECT_DIR/server.log"
PID_FILE="$PROJECT_DIR/server.pid"

# Переходим в директорию проекта
cd "$PROJECT_DIR" || exit 1

# Проверяем, запущен ли уже сервер
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        # Процесс уже запущен
        exit 0
    else
        # PID файл есть, но процесс не запущен - удаляем старый PID файл
        rm -f "$PID_FILE"
    fi
fi

# Запускаем сервер в фоновом режиме
nohup node "$SERVER_FILE" >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Сохраняем PID процесса
echo $SERVER_PID > "$PID_FILE"

# Ждем немного и проверяем, что процесс действительно запустился
sleep 2
if ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo "$(date): Сервер успешно запущен (PID: $SERVER_PID)" >> "$LOG_FILE"
else
    echo "$(date): Ошибка запуска сервера" >> "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi

exit 0

