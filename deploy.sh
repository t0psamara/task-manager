#!/bin/bash

# Простой скрипт деплоя на сервер timeweb
# IP: 194.87.118.34

SERVER_IP="194.87.118.34"
SERVER_USER="root"  # или ваш пользователь
PROJECT_PATH="/var/www/task-manager"

echo "🚀 Деплой Task Manager на сервер $SERVER_IP"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция для логов
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверяем что мы в директории проекта
if [ ! -f "backend/app/main.py" ]; then
    log_error "Запустите скрипт из корня проекта task-manager"
    exit 1
fi

# Создаем директорию на сервере если её нет
log_info "Создание директории проекта на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${PROJECT_PATH}"

if [ $? -ne 0 ]; then
    log_error "Ошибка создания директории на сервере"
    exit 1
fi

# Копируем файлы на сервер
log_info "Копирование файлов на сервер..."
rsync -avz --exclude='venv' --exclude='__pycache__' --exclude='.git' \
    --exclude='*.log' --exclude='*.db' \
    ./ ${SERVER_USER}@${SERVER_IP}:${PROJECT_PATH}

if [ $? -ne 0 ]; then
    log_error "Ошибка копирования файлов"
    exit 1
fi

# Выполняем команды на сервере
log_info "Настройка на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
    set -e
    cd /var/www/task-manager
    
    echo "🐍 Установка Python и зависимостей..."
    
    # Устанавливаем Python3 и pip если нет
    which python3 || (apt update && apt install -y python3 python3-pip)
    
    # Устанавливаем python3-venv отдельно для Ubuntu/Debian
    apt update && apt install -y python3-venv
    
    # Создаем виртуальное окружение
    if [ ! -d "backend/venv" ]; then
        echo "Создание виртуального окружения..."
        cd backend
        python3 -m venv venv
        cd ..
    fi
    
    # Активируем и устанавливаем зависимости
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    
    # Проверяем что .env файл существует
    if [ ! -f ".env" ]; then
        echo "DEBUG=true" > .env
        echo "Создан .env файл с DEBUG=true"
    fi
    
    # Останавливаем предыдущий процесс если есть
    pkill -f "uvicorn.*main:app" || true
    sleep 2
    
    # Запускаем сервер в background с DEBUG=true
    echo "🚀 Запуск сервера..."
    export DEBUG=true
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../server.log 2>&1 &
    
    echo "✅ Сервер запущен на порту 8000"
    echo "📁 Логи: /var/www/task-manager/server.log"
    echo "🌐 Доступен по адресу: http://194.87.118.34:8000"
    
    # Проверяем что сервер запустился
    sleep 3
    if pgrep -f "uvicorn.*main:app" > /dev/null; then
        echo "✅ Процесс сервера запущен"
    else
        echo "❌ Ошибка запуска сервера, проверьте логи"
    fi
EOF

if [ $? -eq 0 ]; then
    log_info "✅ Деплой завершен успешно!"
    log_info "🌐 Frontend: http://${SERVER_IP}/frontend/"
    log_info "🔧 API: http://${SERVER_IP}:8000"
    log_info "📊 API Info: http://${SERVER_IP}:8000/info"
    log_info "💓 Health: http://${SERVER_IP}:8000/health"
    echo ""
    log_warn "Для остановки сервера выполните на сервере:"
    echo "ssh ${SERVER_USER}@${SERVER_IP} 'pkill -f \"uvicorn.*main:app\"'"
else
    log_error "Ошибка деплоя"
    exit 1
fi