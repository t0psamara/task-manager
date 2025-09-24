#!/bin/bash

# Универсальный скрипт запуска Task Manager
# Исправляет все найденные проблемы и запускает проект

echo "🚀 ЗАПУСК TASK MANAGER НА TIMEWEB"
echo "================================="
echo "🕐 Время: $(date)"
echo "📍 Сервер: 194.87.118.34"
echo ""

# Функция для вывода разделителя
separator() {
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Переходим в директорию проекта
cd /root/task-manager || {
    echo "❌ Директория /root/task-manager не найдена!"
    exit 1
}

separator

# 1. Останавливаем старые сервисы
echo "1️⃣  ОСТАНОВКА СТАРЫХ СЕРВИСОВ"
systemctl stop taskmanager 2>/dev/null || echo "taskmanager уже остановлен"
systemctl stop nginx 2>/dev/null || echo "nginx уже остановлен"
echo "✅ Сервисы остановлены"

separator

# 2. Создаем/проверяем .env файл
echo "2️⃣  НАСТРОЙКА КОНФИГУРАЦИИ"
if [ ! -f ".env" ]; then
    echo "📋 Создаем .env файл..."
    cat > .env << 'EOF'
# Task Manager конфигурация для Timeweb
DEBUG=True

# SQLite будет использоваться автоматически при DEBUG=True
# Файл базы: task_manager_debug.db

# Настройки сервера
HOST=0.0.0.0
PORT=8000

# Безопасность
SECRET_KEY=timeweb_production_key_2025

# Настройки для сервера и домена
ALLOWED_HOSTS=194.87.118.34,dashboard.petrenkov.ru,localhost,127.0.0.1
CORS_ORIGINS=https://dashboard.petrenkov.ru,http://dashboard.petrenkov.ru,http://194.87.118.34,http://localhost,http://127.0.0.1

# Логирование
LOG_LEVEL=INFO
EOF
    echo "✅ .env файл создан"
else
    echo "✅ .env файл существует"
fi

separator

# 3. Проверяем Python окружение
echo "3️⃣  ПРОВЕРКА PYTHON ОКРУЖЕНИЯ"
if [ ! -d "venv" ]; then
    echo "📦 Создаем виртуальное окружение..."
    python3 -m venv venv
fi

echo "🔧 Активируем окружение и проверяем зависимости..."
source venv/bin/activate

# Проверяем основные зависимости
if ! pip list | grep -q fastapi; then
    echo "📥 Устанавливаем зависимости..."
    pip install --upgrade pip
    pip install -r backend/requirements.txt
else
    echo "✅ Зависимости установлены"
fi

separator

# 4. Исправляем права доступа к frontend
echo "4️⃣  ИСПРАВЛЕНИЕ ПРАВ ДОСТУПА"
if [ -d "frontend" ]; then
    echo "🔧 Исправляем права доступа к frontend..."
    
    # Устанавливаем правильного владельца
    chown -R root:root frontend/
    
    # Устанавливаем права для директорий
    find frontend/ -type d -exec chmod 755 {} \;
    
    # Устанавливаем права для файлов
    find frontend/ -type f -exec chmod 644 {} \;
    
    echo "✅ Права доступа исправлены"
    echo "📊 Проверка:"
    ls -la frontend/ | head -5
else
    echo "❌ Директория frontend не найдена!"
    exit 1
fi

separator

# 5. Создаем правильную nginx конфигурацию
echo "5️⃣  НАСТРОЙКА NGINX"
echo "🔧 Создаем корректную nginx конфигурацию..."

cat > /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34 dashboard.petrenkov.ru;
    
    # Логирование
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log;
    
    # Основная локация для фронтенда
    location / {
        root /root/task-manager/frontend;
        index index.html;
        
        # ИСПРАВЛЕНИЕ: правильная обработка SPA без циклов
        try_files $uri $uri/ @fallback;
        
        # Безопасность
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Fallback для Single Page Application
    location @fallback {
        root /root/task-manager/frontend;
        try_files /index.html =404;
    }
    
    # Статические файлы с кешированием
    location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|pdf)$ {
        root /root/task-manager/frontend;
        expires 1h;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
    
    # API проксирование на FastAPI
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
        
        # Буферизация
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        
        # CORS заголовки
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
        
        # Обработка OPTIONS запросов для CORS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
            return 204;
        }
    }
    
    # WebSocket для real-time обновлений
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket таймауты
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
    
    # Прямые API эндпоинты
    location ~ ^/(docs|redoc|openapi\.json|health|info|test-db|test-create-board)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Блокируем доступ к системным файлам
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

# Активируем конфигурацию
echo "🔗 Активируем nginx конфигурацию..."
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Тестируем конфигурацию
echo "🧪 Тестируем nginx конфигурацию..."
if nginx -t; then
    echo "✅ Конфигурация nginx корректна"
else
    echo "❌ Ошибка в конфигурации nginx!"
    nginx -t
    exit 1
fi

separator

# 6. Создаем/обновляем systemd сервис
echo "6️⃣  НАСТРОЙКА АВТОЗАПУСКА"
echo "⚙️  Создаем systemd сервис..."

cat > /etc/systemd/system/taskmanager.service << 'EOF'
[Unit]
Description=Task Manager FastAPI Application
After=network.target

[Service]
Type=exec
User=root
Group=root
WorkingDirectory=/root/task-manager/backend
Environment="PATH=/root/task-manager/venv/bin"
EnvironmentFile=/root/task-manager/.env
ExecStart=/root/task-manager/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

# Логирование
StandardOutput=journal
StandardError=journal
SyslogIdentifier=taskmanager

# Безопасность
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/root/task-manager

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd и включаем автозапуск
systemctl daemon-reload
systemctl enable taskmanager
echo "✅ Автозапуск настроен"

separator

# 7. Запускаем сервисы
echo "7️⃣  ЗАПУСК СЕРВИСОВ"

echo "🚀 Запускаем Task Manager backend..."
systemctl start taskmanager
sleep 3

# Проверяем статус backend
if systemctl is-active --quiet taskmanager; then
    echo "✅ Backend запущен успешно"
else
    echo "❌ Backend не запустился!"
    echo "Логи backend:"
    journalctl -u taskmanager --no-pager -l | tail -10
    exit 1
fi

echo "🚀 Запускаем nginx..."
systemctl start nginx
sleep 2

# Проверяем статус nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx запущен успешно"
else
    echo "❌ Nginx не запустился!"
    echo "Логи nginx:"
    journalctl -u nginx --no-pager -l | tail -10
    exit 1
fi

separator

# 8. Финальные тесты
echo "8️⃣  ТЕСТИРОВАНИЕ"

echo "🧪 Тестируем backend..."
BACKEND_TEST=$(curl -s -w "%{http_code}" http://localhost:8000/health -o /tmp/backend_test.txt)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "✅ Backend работает: $(cat /tmp/backend_test.txt)"
else
    echo "❌ Backend не отвечает (код: $BACKEND_TEST)"
    cat /tmp/backend_test.txt
fi

echo ""
echo "🧪 Тестируем frontend..."
FRONTEND_TEST=$(curl -s -w "%{http_code}" http://localhost/ -o /tmp/frontend_test.txt)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ Frontend работает (размер: $(wc -c < /tmp/frontend_test.txt) байт)"
else
    echo "❌ Frontend ошибка (код: $FRONTEND_TEST)"
    echo "Первые строки ответа:"
    head -5 /tmp/frontend_test.txt
fi

echo ""
echo "🧪 Тестируем API через nginx..."
API_TEST=$(curl -s -w "%{http_code}" http://localhost/api/info -o /tmp/api_test.txt)
if [ "$API_TEST" = "200" ]; then
    echo "✅ API работает через nginx"
else
    echo "⚠️  API через nginx: код $API_TEST"
fi

separator

# 9. Итоговый результат
echo "9️⃣  РЕЗУЛЬТАТ"
echo "============="

if [ "$BACKEND_TEST" = "200" ] && [ "$FRONTEND_TEST" = "200" ]; then
    echo "🎉 ВСЁ РАБОТАЕТ ОТЛИЧНО!"
    echo ""
    echo "📍 Ваше приложение доступно:"
    echo "   🌐 Frontend:     http://194.87.118.34"
    echo "   🌐 Домен:       http://dashboard.petrenkov.ru"
    echo "   📋 API docs:    http://194.87.118.34/docs"
    echo "   💚 Health:      http://194.87.118.34/health"
    echo "   🔧 Backend API: http://194.87.118.34:8000"
    echo ""
    echo "📊 Статус сервисов:"
    echo "   Backend: $(systemctl is-active taskmanager)"
    echo "   Nginx:   $(systemctl is-active nginx)"
    echo ""
    echo "📁 База данных SQLite: /root/task-manager/backend/task_manager_debug.db"
    echo ""
    echo "📋 Полезные команды:"
    echo "   📊 Статус:      systemctl status taskmanager"
    echo "   📜 Логи:        journalctl -u taskmanager -f"
    echo "   🔄 Перезапуск:  systemctl restart taskmanager"
    echo "   🌐 Nginx логи:  tail -f /var/log/nginx/taskmanager_error.log"
    
else
    echo "⚠️  ЕСТЬ ПРОБЛЕМЫ!"
    echo ""
    echo "🔍 Диагностика:"
    echo "   Backend статус: $BACKEND_TEST"
    echo "   Frontend статус: $FRONTEND_TEST"
    echo ""
    echo "📋 Что проверить:"
    echo "   1. journalctl -u taskmanager -f"
    echo "   2. tail -f /var/log/nginx/taskmanager_error.log"
    echo "   3. curl -v http://localhost/"
    echo "   4. ls -la /root/task-manager/frontend/"
fi

echo ""
echo "🕐 Время завершения: $(date)"
echo "================================="
