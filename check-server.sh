#!/bin/bash
echo "Проверка запущенного сервера..."
echo ""
echo "Процессы Node.js:"
ps aux | grep "node.*server-mysql" | grep -v grep
echo ""
echo "Процессы на порту 3000:"
lsof -i :3000 2>/dev/null || netstat -tulpn 2>/dev/null | grep :3000 || echo "Команда lsof/netstat недоступна"
echo ""
echo "Проверка доступности сервера:"
curl -s http://localhost:3000 > /dev/null && echo "✅ Сервер отвечает на http://localhost:3000" || echo "❌ Сервер не отвечает"

