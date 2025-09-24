#!/bin/bash

# Быстрое исправление 500 ошибки (без детальной диагностики)

echo "⚡ БЫСТРОЕ ИСПРАВЛЕНИЕ 500 ОШИБКИ"
echo "================================"

cd /root/task-manager

# Останавливаем сервисы
systemctl stop taskmanager nginx

# Исправляем права
chown -R root:root frontend/
chmod -R 755 frontend/
chmod 644 frontend/*.html

# Создаем простую рабочую конфигурацию nginx
cat > /etc/nginx/sites-available/taskmanager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34 dashboard.petrenkov.ru;
    
    location / {
        root /root/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }
    
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
        proxy_set_header Host $host;
    }
}
EOF

# Активируем
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверяем nginx
nginx -t

# Создаем .env если нет
if [ ! -f ".env" ]; then
    cp env.sqlite .env 2>/dev/null || cp env.example .env 2>/dev/null
fi

# Запускаем сервисы
systemctl start taskmanager
sleep 3
systemctl start nginx

# Тест
echo ""
echo "🧪 Тест:"
curl -s http://localhost:8000/health && echo " ✅ Backend OK"
curl -s -I http://localhost/ | head -1

echo ""
echo "📍 Проверьте: http://194.87.118.34"
