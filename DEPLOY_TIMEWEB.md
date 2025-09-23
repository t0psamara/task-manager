# 🚀 Инструкция по развертыванию Task Manager на Timeweb

## Обзор

Ваш проект Task Manager готов к развертыванию и включает:
- ✅ FastAPI backend с async/await архитектурой
- ✅ PostgreSQL база данных с миграциями
- ✅ HTML/CSS/JS frontend с real-time WebSocket
- ✅ Docker контейнеризация
- ✅ Production-ready конфигурация

## 📋 Предварительные требования

### 1. Подготовка на Timeweb
- [ ] VPS/VDS сервер (рекомендуется от 2GB RAM)
- [ ] PostgreSQL база данных (можно создать в панели управления)
- [ ] Домен (опционально, для SSL)

### 2. Локальная подготовка
- [ ] Git репозиторий с проектом
- [ ] SSH доступ к серверу

---

## 🐳 Способ 1: Docker деплой (Рекомендуемый)

### Шаг 1: Подготовка сервера

```bash
# Подключение к серверу
ssh root@ваш_ip_адрес

# Обновление системы
apt update && apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Проверка установки
docker --version
docker-compose --version
```

### Шаг 2: Загрузка проекта

**Вариант A: Через Git (рекомендуемый)**
```bash
# Установка Git
apt install git -y

# Клонирование репозитория
git clone https://github.com/ваш_username/task-manager.git
cd task-manager
```

**Вариант B: Загрузка файлов**
```bash
# С локального компьютера
scp -r /path/to/task-manager root@ваш_ip:/opt/task-manager
```

### Шаг 3: Настройка переменных окружения

```bash
# Создание production конфигурации
cp env.production.example .env.production

# Редактирование файла
nano .env.production
```

**Настройте следующие параметры:**
```env
# Отключаем debug режим
DEBUG=False

# PostgreSQL подключение (получите данные в панели Timeweb)
DATABASE_URL=postgresql://ваш_пользователь:ваш_пароль@ваш_хост:5432/ваша_база

# Генерация секретного ключа
SECRET_KEY=super_secret_key_here_generate_new_one

# Настройки домена
ALLOWED_HOSTS=ваш_домен.ru,ваш_ip_адрес
CORS_ORIGINS=https://ваш_домен.ru,http://ваш_ip_адрес

# Настройки PostgreSQL для docker-compose
POSTGRES_DB=ваша_база
POSTGRES_USER=ваш_пользователь
POSTGRES_PASSWORD=ваш_пароль
```

### Шаг 4: Запуск деплоя

```bash
# Автоматический деплой
./deploy.sh

# Или ручной запуск
docker-compose -f docker-compose.production.yml up -d --build
```

### Шаг 5: Проверка работы

```bash
# Проверка статуса контейнеров
docker-compose -f docker-compose.production.yml ps

# Просмотр логов
docker-compose -f docker-compose.production.yml logs

# Тест API
curl http://ваш_ip:8000/health

# Тест фронтенда
curl http://ваш_ip
```

---

## 🔧 Способ 2: Ручная установка без Docker

### Шаг 1: Подготовка сервера

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Python 3.11
apt install software-properties-common -y
add-apt-repository ppa:deadsnakes/ppa -y
apt update
apt install python3.11 python3.11-venv python3.11-dev -y

# Установка дополнительных зависимостей
apt install nginx postgresql-client git curl -y
```

### Шаг 2: Настройка PostgreSQL

```bash
# Если используете локальный PostgreSQL
apt install postgresql postgresql-contrib -y

# Создание пользователя и базы данных
sudo -u postgres psql -c "CREATE USER taskmanager WITH PASSWORD 'ваш_пароль';"
sudo -u postgres psql -c "CREATE DATABASE taskmanager OWNER taskmanager;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager;"
```

### Шаг 3: Установка приложения

```bash
# Создание пользователя для приложения
adduser --disabled-password --gecos "" taskmanager
usermod -aG sudo taskmanager

# Переключение на пользователя
su - taskmanager

# Клонирование проекта
git clone https://github.com/ваш_username/task-manager.git
cd task-manager

# Создание виртуального окружения
python3.11 -m venv venv
source venv/bin/activate

# Установка зависимостей
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### Шаг 4: Настройка конфигурации

```bash
# Создание .env файла
cp env.production.example .env

# Настройка переменных окружения
nano .env
```

### Шаг 5: Настройка Nginx

```bash
# Создание конфигурации сайта
sudo nano /etc/nginx/sites-available/taskmanager
```

```nginx
server {
    listen 80;
    server_name ваш_домен.ru www.ваш_домен.ru;

    location / {
        root /home/taskmanager/task-manager/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Активация сайта
sudo ln -s /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Шаг 6: Создание systemd сервиса

```bash
sudo nano /etc/systemd/system/taskmanager.service
```

```ini
[Unit]
Description=Task Manager FastAPI application
After=network.target

[Service]
Type=exec
User=taskmanager
Group=taskmanager
WorkingDirectory=/home/taskmanager/task-manager/backend
Environment="PATH=/home/taskmanager/task-manager/venv/bin"
ExecStart=/home/taskmanager/task-manager/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Запуск сервиса
sudo systemctl daemon-reload
sudo systemctl enable taskmanager
sudo systemctl start taskmanager
sudo systemctl status taskmanager
```

---

## 🗄️ Настройка PostgreSQL на Timeweb

### Способ 1: Использование облачной БД Timeweb

1. **Создание базы данных в панели управления:**
   - Войдите в панель управления Timeweb
   - Перейдите в раздел "Базы данных"
   - Создайте новую PostgreSQL базу данных
   - Сохраните данные подключения

2. **Настройка подключения:**
```env
DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

### Способ 2: Локальная PostgreSQL на VPS

```bash
# Установка PostgreSQL
apt install postgresql postgresql-contrib -y

# Настройка PostgreSQL
sudo -u postgres psql

# В консоли PostgreSQL
CREATE USER taskmanager WITH PASSWORD 'сложный_пароль';
CREATE DATABASE taskmanager OWNER taskmanager;
GRANT ALL PRIVILEGES ON DATABASE taskmanager TO taskmanager;
\q

# Настройка аутентификации
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Измените строку:
# local   all             all                                     peer
# на:
# local   all             all                                     md5

# Перезапуск PostgreSQL
sudo systemctl restart postgresql
```

---

## 🔒 Настройка SSL (Let's Encrypt)

```bash
# Установка Certbot
apt install certbot python3-certbot-nginx -y

# Получение сертификата
certbot --nginx -d ваш_домен.ru -d www.ваш_домен.ru

# Автоматическое обновление
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

---

## 🔧 Полезные команды для обслуживания

### Docker команды
```bash
# Просмотр логов
docker-compose -f docker-compose.production.yml logs

# Перезапуск сервисов
docker-compose -f docker-compose.production.yml restart

# Обновление кода и перезапуск
git pull origin main
docker-compose -f docker-compose.production.yml up -d --build

# Бэкап базы данных
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U username database_name > backup.sql

# Восстановление базы данных
docker-compose -f docker-compose.production.yml exec -T postgres psql -U username database_name < backup.sql
```

### Системные команды
```bash
# Мониторинг системы
htop
df -h
free -h

# Просмотр логов nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Статус сервисов
systemctl status taskmanager
systemctl status nginx
systemctl status postgresql
```

---

## 🐛 Решение проблем

### Проблема: Backend не запускается
```bash
# Проверка логов
docker-compose -f docker-compose.production.yml logs backend

# Проверка переменных окружения
docker-compose -f docker-compose.production.yml exec backend env

# Проверка подключения к БД
docker-compose -f docker-compose.production.yml exec backend python -c "
from app.database import engine
print('Database connection test')
"
```

### Проблема: Frontend не отображается
```bash
# Проверка nginx логов
docker-compose -f docker-compose.production.yml logs frontend

# Проверка файлов
docker-compose -f docker-compose.production.yml exec frontend ls -la /usr/share/nginx/html
```

### Проблема: WebSocket не работает
```bash
# Проверка nginx конфигурации для WebSocket
nginx -t

# Тест WebSocket соединения
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://ваш_ip/ws/1
```

---

## 📊 Мониторинг и производительность

### Установка monitoring (опционально)
```bash
# Установка htop для мониторинга
apt install htop -y

# Установка docker stats для мониторинга контейнеров
docker stats

# Настройка логrotate для логов
echo "/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 www-data adm
    postrotate
        systemctl reload nginx
    endscript
}" > /etc/logrotate.d/nginx
```

---

## ✅ Финальная проверка

После успешного деплоя проверьте:

1. **Frontend:** http://ваш_ip_адрес
2. **API документация:** http://ваш_ip_адрес:8000/docs  
3. **API health check:** http://ваш_ip_адрес:8000/health
4. **WebSocket:** тестируйте real-time функции в интерфейсе

🎉 **Поздравляем! Ваш Task Manager успешно развернут на Timeweb!**

---

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker-compose logs` или `systemctl status taskmanager`
2. Убедитесь, что все порты открыты в firewall
3. Проверьте настройки базы данных
4. Свяжитесь с технической поддержкой Timeweb при проблемах с сервером
