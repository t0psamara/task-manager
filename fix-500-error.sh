#!/bin/bash

# Полная диагностика и исправление 500 ошибки

echo "🔍 ДИАГНОСТИКА 500 ОШИБКИ ФРОНТЕНДА"
echo "=================================="

# Функция для вывода разделителя
separator() {
    echo ""
    echo "----------------------------------------"
    echo ""
}

echo "📍 Сервер: 194.87.118.34"
echo "🕐 Время: $(date)"

separator

# 1. Проверяем статус процессов
echo "1️⃣  СТАТУС СЕРВИСОВ"
echo "Backend (taskmanager):"
systemctl is-active taskmanager
systemctl status taskmanager --no-pager -l | head -10

echo ""
echo "Nginx:"
systemctl is-active nginx  
systemctl status nginx --no-pager -l | head -10

separator

# 2. Проверяем порты
echo "2️⃣  ПРОВЕРКА ПОРТОВ"
echo "Порт 8000 (backend):"
ss -tlnp | grep :8000 || echo "❌ Порт 8000 не слушается!"

echo "Порт 80 (nginx):"
ss -tlnp | grep :80 || echo "❌ Порт 80 не слушается!"

separator

# 3. Тестируем backend напрямую
echo "3️⃣  ТЕСТ BACKEND"
echo "Health check:"
BACKEND_RESPONSE=$(curl -s -w "%{http_code}" http://localhost:8000/health -o /tmp/backend_test.txt)
echo "HTTP код: $BACKEND_RESPONSE"
if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo "✅ Backend работает"
    cat /tmp/backend_test.txt
else
    echo "❌ Backend не отвечает!"
    echo "Ответ:"
    cat /tmp/backend_test.txt 2>/dev/null || echo "Нет ответа"
fi

separator

# 4. Проверяем файлы фронтенда
echo "4️⃣  ПРОВЕРКА ФАЙЛОВ ФРОНТЕНДА"
if [ -d "/root/task-manager/frontend" ]; then
    echo "✅ Директория frontend существует"
    echo "Содержимое:"
    ls -la /root/task-manager/frontend/ | head -10
    
    echo ""
    echo "Права доступа:"
    ls -ld /root/task-manager/frontend/
    
    if [ -f "/root/task-manager/frontend/index.html" ]; then
        echo "✅ index.html найден"
        echo "Размер файла: $(stat -c%s /root/task-manager/frontend/index.html) байт"
    else
        echo "❌ index.html не найден!"
    fi
else
    echo "❌ Директория frontend не найдена!"
fi

separator

# 5. Проверяем nginx конфигурацию
echo "5️⃣  NGINX КОНФИГУРАЦИЯ"
echo "Тест конфигурации:"
nginx -t

echo ""
echo "Активные сайты:"
ls -la /etc/nginx/sites-enabled/

echo ""
echo "Конфигурация taskmanager:"
if [ -f "/etc/nginx/sites-available/taskmanager" ]; then
    echo "✅ Конфигурация существует"
    echo "Первые строки:"
    head -20 /etc/nginx/sites-available/taskmanager
else
    echo "❌ Конфигурация не найдена!"
fi

separator

# 6. Проверяем логи nginx
echo "6️⃣  ЛОГИ NGINX"
echo "Последние ошибки:"
if [ -f "/var/log/nginx/taskmanager_error.log" ]; then
    tail -20 /var/log/nginx/taskmanager_error.log
else
    echo "Лог не найден, проверяем основной лог:"
    tail -20 /var/log/nginx/error.log
fi

separator

# 7. Тестируем nginx напрямую
echo "7️⃣  ТЕСТ NGINX"
echo "Главная страница:"
NGINX_RESPONSE=$(curl -s -w "%{http_code}" http://localhost/ -o /tmp/nginx_test.txt)
echo "HTTP код: $NGINX_RESPONSE"
echo "Ответ:"
head -10 /tmp/nginx_test.txt

separator

# 8. ИСПРАВЛЕНИЕ ПРОБЛЕМ
echo "8️⃣  АВТОМАТИЧЕСКОЕ ИСПРАВЛЕНИЕ"
echo "==============================="

# Останавливаем сервисы
echo "⏹️  Останавливаем сервисы..."
systemctl stop taskmanager 2>/dev/null
systemctl stop nginx 2>/dev/null

# Исправляем права доступа
echo "🔧 Исправляем права доступа..."
if [ -d "/root/task-manager/frontend" ]; then
    chown -R root:root /root/task-manager/frontend/
    chmod -R 755 /root/task-manager/frontend/
    chmod 644 /root/task-manager/frontend/*.html 2>/dev/null
    chmod 644 /root/task-manager/frontend/**/*.* 2>/dev/null
    echo "✅ Права доступа исправлены"
else
    echo "❌ Директория frontend не найдена!"
fi

# Пересоздаем nginx конфигурацию с правильными путями
echo "🔧 Создаем новую nginx конфигурацию..."
cat > /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34 dashboard.petrenkov.ru;
    
    # Подробное логирование для отладки
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log debug;
    
    # Основная локация для фронтенда
    location / {
        root /root/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # Отладочные заголовки
        add_header X-Debug-Root "/root/task-manager/frontend" always;
        add_header X-Debug-URI "$uri" always;
        
        # CORS заголовки
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
    }
    
    # Статические файлы
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /root/task-manager/frontend;
        expires 1h;
        add_header Cache-Control "public";
        access_log off;
    }
    
    # API проксирование
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # CORS для API
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # Обработка OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            return 204;
        }
    }
    
    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Прямые эндпоинты
    location ~ ^/(docs|redoc|openapi.json|health|info)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Отладочная страница
    location /debug {
        return 200 "OK: Frontend path = /root/task-manager/frontend\nServer: nginx\nTime: $time_iso8601";
        add_header Content-Type text/plain;
    }
}
EOF

# Активируем конфигурацию
echo "🔗 Активируем nginx конфигурацию..."
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Тестируем конфигурацию nginx
echo "🧪 Тестируем nginx конфигурацию..."
if nginx -t; then
    echo "✅ Конфигурация nginx корректна"
else
    echo "❌ Ошибка в конфигурации nginx!"
    exit 1
fi

# Проверяем и исправляем .env
echo "🔧 Проверяем .env файл..."
cd /root/task-manager
if [ ! -f ".env" ]; then
    if [ -f "env.sqlite" ]; then
        cp env.sqlite .env
        echo "✅ Создан .env файл"
    else
        echo "❌ Файл env.sqlite не найден!"
    fi
fi

# Запускаем backend
echo "🚀 Запускаем backend..."
systemctl start taskmanager
sleep 3

# Проверяем статус backend
if systemctl is-active --quiet taskmanager; then
    echo "✅ Backend запущен"
    
    # Тестируем backend
    if curl -s http://localhost:8000/health > /dev/null; then
        echo "✅ Backend отвечает"
    else
        echo "❌ Backend не отвечает!"
        echo "Логи backend:"
        journalctl -u taskmanager --no-pager -l | tail -10
    fi
else
    echo "❌ Backend не запустился!"
    echo "Логи backend:"
    journalctl -u taskmanager --no-pager -l | tail -10
    exit 1
fi

# Запускаем nginx
echo "🚀 Запускаем nginx..."
systemctl start nginx
sleep 2

# Проверяем статус nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx запущен"
else
    echo "❌ Nginx не запустился!"
    echo "Логи nginx:"
    journalctl -u nginx --no-pager -l | tail -10
    exit 1
fi

separator

# 9. ФИНАЛЬНЫЕ ТЕСТЫ
echo "9️⃣  ФИНАЛЬНЫЕ ТЕСТЫ"
echo "=================="

echo "Backend health check:"
FINAL_BACKEND=$(curl -s -w "%{http_code}" http://localhost:8000/health -o /tmp/final_backend.txt)
echo "HTTP код: $FINAL_BACKEND"
if [ "$FINAL_BACKEND" = "200" ]; then
    echo "✅ Backend работает"
else
    echo "❌ Backend проблема!"
    cat /tmp/final_backend.txt
fi

echo ""
echo "Frontend test:"
FINAL_FRONTEND=$(curl -s -w "%{http_code}" http://localhost/ -o /tmp/final_frontend.txt)
echo "HTTP код: $FINAL_FRONTEND"
if [ "$FINAL_FRONTEND" = "200" ]; then
    echo "✅ Frontend работает"
    echo "Размер ответа: $(wc -c < /tmp/final_frontend.txt) байт"
else
    echo "❌ Frontend проблема!"
    echo "Ответ:"
    head -10 /tmp/final_frontend.txt
fi

echo ""
echo "Debug endpoint:"
curl -s http://localhost/debug

separator

# 10. ИТОГОВЫЙ СТАТУС
echo "🎯 ИТОГОВЫЙ СТАТУС"
echo "=================="

if [ "$FINAL_BACKEND" = "200" ] && [ "$FINAL_FRONTEND" = "200" ]; then
    echo "🎉 ВСЁ РАБОТАЕТ!"
    echo ""
    echo "📍 Доступные адреса:"
    echo "   🌐 Frontend: http://194.87.118.34"
    echo "   🌐 Frontend: http://dashboard.petrenkov.ru"
    echo "   📋 API docs: http://194.87.118.34/docs"
    echo "   💚 Health: http://194.87.118.34/health"
    echo "   🔧 Debug: http://194.87.118.34/debug"
else
    echo "❌ ЕСТЬ ПРОБЛЕМЫ!"
    echo ""
    echo "📋 Что проверить:"
    echo "   1. journalctl -u taskmanager -f"
    echo "   2. tail -f /var/log/nginx/taskmanager_error.log"
    echo "   3. ls -la /root/task-manager/frontend/"
    echo "   4. curl -v http://localhost/"
fi

echo ""
echo "📊 Статус сервисов:"
echo "   Backend: $(systemctl is-active taskmanager)"
echo "   Nginx: $(systemctl is-active nginx)"

echo ""
echo "🕐 Время завершения: $(date)"
