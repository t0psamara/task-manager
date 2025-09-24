# 🚀 Деплой Task Manager на сервер Timeweb

## Быстрый деплой

**Вариант 1: Деплой в /var/www/ (требует root прав)**
```bash
./deploy.sh
```

**Вариант 2: Деплой в домашнюю директорию (безопаснее)**
```bash
./deploy-home.sh
```

Любой из скриптов автоматически:
- Создаст нужную директорию на сервере
- Скопирует проект на сервер 194.87.118.34
- Установит зависимости Python
- Создаст виртуальное окружение
- Запустит API сервер на порту 8000

## После деплоя

**Приложение будет доступно по адресам:**
- 🔧 **API**: http://194.87.118.34:8000
- 📊 **API Info**: http://194.87.118.34:8000/info
- 💓 **Health Check**: http://194.87.118.34:8000/health
- 🌐 **Frontend**: Требует дополнительной настройки (см. ниже)

## Ручной деплой

Если автоматический скрипт не работает:

### 1. Копируем файлы на сервер
```bash
rsync -avz --exclude='venv' --exclude='__pycache__' ./ root@194.87.118.34:/var/www/task-manager
```

### 2. Подключаемся к серверу и настраиваем
```bash
ssh root@194.87.118.34
cd /var/www/task-manager

# Устанавливаем Python и зависимости
apt update && apt install -y python3 python3-pip python3-venv

# Создаем виртуальное окружение
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Запускаем сервер
export DEBUG=true
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../server.log 2>&1 &
```

### 3. Настраиваем веб-сервер (Nginx)
```bash
# Установка Nginx
apt install -y nginx

# Создаем конфиг для frontend
cat > /etc/nginx/sites-available/task-manager << 'EOF'
server {
    listen 80;
    server_name 194.87.118.34;
    
    # Frontend
    location /frontend/ {
        alias /var/www/task-manager/frontend/;
        index index.html;
        try_files $uri $uri/ =404;
    }
    
    # Корень тоже отдает frontend
    location / {
        alias /var/www/task-manager/frontend/;
        index index.html;
        try_files $uri $uri/ =404;
    }
    
    # Прокси для API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket для real-time
    location /ws/ {
        proxy_pass http://127.0.0.1:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

# Включаем сайт
ln -s /etc/nginx/sites-available/task-manager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

## Управление сервером

### Остановка сервера
```bash
ssh root@194.87.118.34 'pkill -f "uvicorn.*main:app"'
```

### Просмотр логов
```bash
ssh root@194.87.118.34 'tail -f /var/www/task-manager/server.log'
```

### Перезапуск сервера
```bash
ssh root@194.87.118.34 << 'EOF'
pkill -f "uvicorn.*main:app"
cd /var/www/task-manager/backend
source venv/bin/activate
export DEBUG=true
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../server.log 2>&1 &
EOF
```

## Настройки проекта

- **База данных**: SQLite файл `task_manager_debug.db` в директории backend
- **Режим**: DEBUG=true (включен автоматически)
- **Порт API**: 8000
- **CORS**: разрешен для всех доменов
- **Host**: 0.0.0.0 (доступен извне)

## Особенности

1. **Автоматическое определение хоста** - frontend автоматически подключается к API по текущему IP
2. **SQLite база** - файл создается автоматически при первом запуске
3. **WebSocket поддержка** - для real-time обновлений досок
4. **Простая архитектура** - без Docker, минимум зависимостей

## Запуск Frontend после деплоя

После успешного деплоя API нужно запустить frontend:

```bash
# Подключаемся к серверу и запускаем frontend
ssh root@194.87.118.34

# Если использовали deploy.sh
cd /var/www/task-manager/frontend

# Если использовали deploy-home.sh  
cd ~/task-manager/frontend

# Запускаем простой веб-сервер
python3 -m http.server 8080 --bind 0.0.0.0
```

Теперь frontend будет доступен по адресу: http://194.87.118.34:8080

## Требования к серверу

- Python 3.7+
- ~50MB свободного места
- Порты 8000 и 8080 открыты для внешних подключений
- (Опционально) Nginx для проксирования frontend
