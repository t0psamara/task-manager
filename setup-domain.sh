#!/bin/bash

# Настройка домена dashboard.petrenkov.ru и SSL сертификата

echo "🌐 Настройка домена dashboard.petrenkov.ru..."
echo "=============================================="

# Проверяем DNS
echo "🔍 Проверяем DNS настройки..."
nslookup dashboard.petrenkov.ru
dig dashboard.petrenkov.ru

# Устанавливаем certbot если не установлен
echo "📦 Устанавливаем Certbot для SSL..."
apt update
apt install -y certbot python3-certbot-nginx

# Создаем конфигурацию nginx с поддержкой домена
echo "⚙️  Обновляем nginx конфигурацию для домена..."

cat > /etc/nginx/sites-available/taskmanager << 'EOF'
# HTTP сервер (будет перенаправлять на HTTPS)
server {
    listen 80;
    server_name dashboard.petrenkov.ru www.dashboard.petrenkov.ru 194.87.118.34;

    # Разрешаем certbot для получения сертификата
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Временно разрешаем HTTP доступ для тестирования
    # После получения SSL можно раскомментировать редирект ниже
    
    # return 301 https://$server_name$request_uri;

    # Логирование
    access_log /var/log/nginx/taskmanager_access.log;
    error_log /var/log/nginx/taskmanager_error.log;

    # Frontend - статические файлы
    location / {
        root /root/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
        
        # CORS заголовки
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
        
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
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
    }

    # API эндпоинты
    location ~ ^/(docs|redoc|openapi.json|health|info)$ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS сервер (будет создан автоматически certbot)
# server {
#     listen 443 ssl http2;
#     server_name dashboard.petrenkov.ru www.dashboard.petrenkov.ru;
#
#     ssl_certificate /etc/letsencrypt/live/dashboard.petrenkov.ru/fullchain.pem;
#     ssl_certificate_key /etc/letsencrypt/live/dashboard.petrenkov.ru/privkey.pem;
#     
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
#     ssl_prefer_server_ciphers off;
#
#     # Остальная конфигурация такая же как в HTTP блоке
# }
EOF

# Тестируем конфигурацию
echo "🧪 Тестируем nginx конфигурацию..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Конфигурация корректна"
    
    # Перезапускаем nginx
    systemctl restart nginx
    
    echo ""
    echo "🎯 Текущий статус:"
    echo "📍 HTTP: http://dashboard.petrenkov.ru"
    echo "📍 IP: http://194.87.118.34"
    echo ""
    
    # Получаем SSL сертификат
    echo "🔒 Получаем SSL сертификат..."
    echo "ВАЖНО: убедитесь что DNS dashboard.petrenkov.ru указывает на 194.87.118.34"
    echo ""
    
    read -p "DNS настроен? Продолжить получение SSL? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Получаем сертификат
        certbot --nginx -d dashboard.petrenkov.ru -d www.dashboard.petrenkov.ru --non-interactive --agree-tos --email admin@petrenkov.ru
        
        if [ $? -eq 0 ]; then
            echo "✅ SSL сертификат получен!"
            echo "🎉 Сайт доступен по адресу: https://dashboard.petrenkov.ru"
            
            # Настраиваем автообновление сертификата
            echo "⚙️  Настраиваем автообновление SSL..."
            (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
            
        else
            echo "❌ Ошибка получения SSL сертификата"
            echo "Возможные причины:"
            echo "  - DNS не настроен правильно"
            echo "  - Домен не указывает на сервер"
            echo "  - Порт 80 заблокирован"
        fi
    else
        echo "⏭️  Пропускаем SSL. Сначала настройте DNS:"
        echo ""
        echo "📋 Инструкции по настройке DNS:"
        echo "  1. Зайдите в панель управления доменом petrenkov.ru"
        echo "  2. Создайте A-запись:"
        echo "     Имя: dashboard"
        echo "     Тип: A"
        echo "     Значение: 194.87.118.34"
        echo "     TTL: 300"
        echo ""
        echo "  3. После настройки DNS запустите:"
        echo "     ./setup-domain.sh"
    fi
    
else
    echo "❌ Ошибка в конфигурации nginx!"
    nginx -t
fi

echo ""
echo "📋 Полезные команды:"
echo "  🔍 Проверить SSL: certbot certificates"
echo "  🔄 Обновить SSL: certbot renew"
echo "  📊 Статус nginx: systemctl status nginx"
echo "  📜 Логи nginx: tail -f /var/log/nginx/taskmanager_error.log"
