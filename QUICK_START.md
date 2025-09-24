# 🚀 Быстрый запуск Task Manager без Docker

## Автоматическая установка (1 команда)

```bash
# На сервере Timeweb (IP: 194.87.118.34)
cd /root/task-manager
./install-simple.sh
```

**Всё! Через 2-3 минуты приложение будет работать.**

---

## Ручная установка (если нужен контроль)

### 1. Подготовка сервера
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка необходимых пакетов
apt install -y python3 python3-pip python3-venv nginx git
```

### 2. Запуск приложения
```bash
cd /root/task-manager

# Создание .env файла
cp env.sqlite .env

# Запуск (в фоне добавьте & в конец)
./run-simple.sh
```

### 3. Настройка nginx (для фронтенда)
```bash
# Копирование конфигурации
cp nginx-simple.conf /etc/nginx/sites-available/taskmanager
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Перезапуск nginx
nginx -t
systemctl restart nginx
```

### 4. Автозапуск (опционально)
```bash
# Установка systemd сервиса
cp taskmanager.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable taskmanager
systemctl start taskmanager
```

---

## 📍 Адреса после установки

- **Frontend:** http://194.87.118.34
- **API документация:** http://194.87.118.34:8000/docs  
- **Health check:** http://194.87.118.34:8000/health

---

## 🔧 Управление

```bash
# Статус
systemctl status taskmanager

# Логи
journalctl -u taskmanager -f

# Перезапуск
systemctl restart taskmanager

# Остановка
systemctl stop taskmanager

# Ручной запуск (если systemd не нужен)
cd /root/task-manager && ./run-simple.sh
```

---

## 📁 Файлы

- **База данных:** `/root/task-manager/backend/task_manager_debug.db` (SQLite)
- **Логи nginx:** `/var/log/nginx/taskmanager_access.log`
- **Конфигурация:** `/root/task-manager/.env`

---

## 🐛 Решение проблем

### Backend не работает
```bash
# Проверка логов
journalctl -u taskmanager -f

# Ручной запуск для отладки
cd /root/task-manager
./run-simple.sh
```

### Frontend не работает
```bash
# Проверка nginx
systemctl status nginx
nginx -t

# Проверка файлов
ls -la /root/task-manager/frontend/
```

### Проблемы с зависимостями
```bash
cd /root/task-manager
source venv/bin/activate
pip install -r backend/requirements.txt
```

---

## ✨ Преимущества простого деплоя

- ✅ **Быстро:** запуск за 2-3 минуты
- ✅ **Просто:** нет сложностей с Docker
- ✅ **Надежно:** SQLite база в одном файле
- ✅ **Легко отлаживать:** прямой доступ к логам
- ✅ **Мало ресурсов:** минимальное потребление RAM
