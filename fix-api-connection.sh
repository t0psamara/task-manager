#!/bin/bash

# Исправление связи frontend-backend

echo "🔗 ИСПРАВЛЕНИЕ СВЯЗИ FRONTEND-BACKEND"
echo "====================================="

cd /root/task-manager

# 1. Проверим текущие подключения
echo "1️⃣  ДИАГНОСТИКА"
echo "Backend:"
curl -s http://localhost:8000/health || echo "❌ Backend не отвечает"

echo ""
echo "Frontend через nginx:"
curl -s -I http://localhost/ | head -1

echo ""
echo "API через nginx:"
curl -s http://localhost/api/info || echo "❌ API не работает через nginx"

echo ""
echo "Прямой доступ к API:"
curl -s http://localhost:8000/info || echo "❌ API не работает напрямую"

echo ""
echo "2️⃣  ИСПРАВЛЕНИЕ NGINX ПРОКСИРОВАНИЯ"

# Создаем правильную nginx конфигурацию с фиксированным API
cat > /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34 dashboard.petrenkov.ru;
    
    # Логирование для отладки
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log debug;
    
    # Frontend файлы
    location / {
        root /root/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ @fallback;
        
        # CORS заголовки для всех запросов
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
    }
    
    # Fallback для SPA
    location @fallback {
        root /root/task-manager/frontend;
        try_files /index.html =404;
    }
    
    # API проксирование - КРИТИЧЕСКИ ВАЖНО
    location /api/ {
        # Убираем trailing slash из проксирования
        proxy_pass http://127.0.0.1:8000;
        
        # Заголовки для правильной работы
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS заголовки для API
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
        
        # Обработка OPTIONS запросов
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type "text/plain charset=UTF-8";
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # Прямые API эндпоинты без /api/ префикса
    location ~ ^/(docs|redoc|openapi\.json|health|info)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
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
}
EOF

echo "🔧 Перезапускаем nginx..."
nginx -t
systemctl restart nginx

echo ""
echo "3️⃣  ПРОВЕРКА BACKEND CORS"

# Проверим что backend правильно настроен для CORS
echo "Проверяем CORS настройки в backend..."

# Обновляем .env для правильного CORS
cat > .env << 'EOF'
DEBUG=True
HOST=0.0.0.0
PORT=8000
SECRET_KEY=timeweb_production_key_2025
ALLOWED_HOSTS=194.87.118.34,dashboard.petrenkov.ru,localhost,127.0.0.1,*
CORS_ORIGINS=*
LOG_LEVEL=INFO
EOF

echo "🔄 Перезапускаем backend..."
systemctl restart taskmanager
sleep 5

echo ""
echo "4️⃣  ТЕСТИРОВАНИЕ API"

echo "Тест 1 - Прямой backend:"
curl -s http://localhost:8000/health

echo ""
echo "Тест 2 - API через nginx (без api/ префикса):"
curl -s http://localhost/health

echo ""
echo "Тест 3 - API через nginx (с api/ префиксом):"
curl -s http://localhost/api/health

echo ""
echo "Тест 4 - Info endpoint:"
curl -s http://localhost/info | head -5

echo ""
echo "Тест 5 - CORS preflight test:"
curl -s -X OPTIONS -H "Origin: http://194.87.118.34" -H "Access-Control-Request-Method: GET" http://localhost/api/info -v

echo ""
echo "5️⃣  ПРОВЕРКА FRONTEND API КОНФИГУРАЦИИ"

# Проверим как frontend обращается к API
if [ -f "frontend/js/api.js" ]; then
    echo "Конфигурация API в frontend:"
    grep -n "localhost\|8000\|api" frontend/js/api.js | head -5
else
    echo "❌ Файл api.js не найден"
fi

echo ""
echo "6️⃣  СОЗДАНИЕ ТЕСТОВОЙ СТРАНИЦЫ"

# Создаем простую тестовую страницу для проверки API
cat > frontend/test-api.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>API Test</title>
</head>
<body>
    <h1>API Connection Test</h1>
    <button onclick="testAPI()">Test API</button>
    <div id="result"></div>
    
    <script>
    async function testAPI() {
        const result = document.getElementById('result');
        result.innerHTML = 'Testing...';
        
        try {
            // Тест 1: Health check
            const healthResponse = await fetch('/health');
            const health = await healthResponse.text();
            result.innerHTML += '<p>Health check: ' + health + '</p>';
            
            // Тест 2: API through nginx
            const apiResponse = await fetch('/api/info');
            const api = await apiResponse.text();
            result.innerHTML += '<p>API Info: ' + api + '</p>';
            
            // Тест 3: Boards API
            const boardsResponse = await fetch('/api/boards');
            const boards = await boardsResponse.text();
            result.innerHTML += '<p>Boards: ' + boards + '</p>';
            
        } catch (error) {
            result.innerHTML += '<p style="color: red;">Error: ' + error.message + '</p>';
        }
    }
    </script>
</body>
</html>
EOF

echo ""
echo "7️⃣  ФИНАЛЬНЫЕ ТЕСТЫ"

echo "Frontend доступен:"
curl -s -I http://localhost/ | head -1

echo ""
echo "API через /health:"
curl -s http://localhost/health

echo ""
echo "API через /api/info:"
curl -s http://localhost/api/info

echo ""
echo "🎯 РЕЗУЛЬТАТ:"
echo "✅ Backend: http://194.87.118.34:8000"
echo "✅ Frontend: http://194.87.118.34"
echo "✅ API Health: http://194.87.118.34/health"
echo "✅ API Docs: http://194.87.118.34/docs"
echo "🧪 Test page: http://194.87.118.34/test-api.html"

echo ""
echo "📋 Откройте в браузере http://194.87.118.34/test-api.html"
echo "   и нажмите 'Test API' для проверки подключения"

echo ""
echo "🔍 Если не работает, проверьте:"
echo "   F12 -> Console - ошибки JavaScript"
echo "   F12 -> Network - какие запросы не проходят"
echo "   tail -f /var/log/nginx/taskmanager_error.log"
