#!/bin/bash

# Скрипт диагностики и исправления фронтенда

echo "🔍 Диагностика и исправление фронтенда Task Manager..."
echo "================================================"

# Проверяем статус сервисов
echo "📊 Статус сервисов:"
echo "Backend (taskmanager):"
systemctl status taskmanager --no-pager -l

echo ""
echo "Nginx:"
systemctl status nginx --no-pager -l

echo ""
echo "🔍 Проверяем файлы фронтенда:"
if [ -d "/root/task-manager/frontend" ]; then
    echo "✅ Директория frontend существует"
    ls -la /root/task-manager/frontend/
    
    if [ -f "/root/task-manager/frontend/index.html" ]; then
        echo "✅ index.html найден"
    else
        echo "❌ index.html не найден!"
    fi
else
    echo "❌ Директория frontend не найдена!"
fi

echo ""
echo "🔍 Проверяем конфигурацию nginx:"
if [ -f "/etc/nginx/sites-available/taskmanager" ]; then
    echo "✅ Конфигурация taskmanager существует"
else
    echo "❌ Конфигурация taskmanager не найдена!"
fi

if [ -L "/etc/nginx/sites-enabled/taskmanager" ]; then
    echo "✅ Конфигурация активирована"
else
    echo "❌ Конфигурация не активирована!"
fi

echo ""
echo "🔍 Тест конфигурации nginx:"
nginx -t

echo ""
echo "🔍 Проверяем порты:"
echo "Порт 80 (nginx):"
ss -tlnp | grep :80

echo "Порт 8000 (backend):"
ss -tlnp | grep :8000

echo ""
echo "🔍 Тест подключения:"
echo "Backend health check:"
curl -s http://localhost:8000/health || echo "❌ Backend не отвечает"

echo ""
echo "Frontend (главная страница):"
curl -s -I http://localhost/ | head -1 || echo "❌ Frontend не отвечает"

echo ""
echo "🔧 ИСПРАВЛЕНИЕ ПРОБЛЕМ:"
echo "========================"

# Исправляем права доступа
echo "📁 Исправляем права доступа к файлам..."
chown -R www-data:www-data /root/task-manager/frontend/
chmod -R 644 /root/task-manager/frontend/*
chmod 755 /root/task-manager/frontend/

# Пересоздаем конфигурацию nginx
echo "⚙️  Обновляем конфигурацию nginx..."
cd /root/task-manager

# Создаем улучшенную конфигурацию nginx
cat > /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34 dashboard.petrenkov.ru;

    # Логирование
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log;

    # Frontend - статические файлы
    location / {
        root /root/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # CORS заголовки для локальной разработки
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        # Кеширование статики
        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg)$ {
            expires 1h;
            add_header Cache-Control "public";
        }
    }

    # API проксирование на FastAPI  
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS для API
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
        add_header Access-Control-Allow-Headers "Content-Type, Authorization";
        
        # Обработка OPTIONS запросов
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            return 204;
        }
        
        # Таймауты
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
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
    }

    # Прямой доступ к API docs и другим эндпоинтам
    location ~ ^/(docs|redoc|openapi.json|health|info)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Активируем конфигурацию
echo "🔗 Активируем конфигурацию..."
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Тестируем конфигурацию
echo "🧪 Тестируем новую конфигурацию..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    
    # Перезапускаем nginx
    echo "🔄 Перезапускаем nginx..."
    systemctl restart nginx
    
    # Проверяем статус
    echo "📊 Статус nginx после перезапуска:"
    systemctl status nginx --no-pager
    
    # Финальный тест
    echo ""
    echo "🎯 Финальный тест:"
    echo "Frontend:"
    curl -s -I http://localhost/ | head -1
    
    echo "Backend:"
    curl -s http://localhost:8000/health
    
    echo ""
    echo "🎉 Готово! Проверьте:"
    echo "   🌐 http://194.87.118.34"
    echo "   🌐 http://dashboard.petrenkov.ru (если DNS настроен)"
    echo "   📋 http://194.87.118.34/docs"
    
else
    echo "❌ Ошибка в конфигурации nginx!"
    nginx -t
fi
