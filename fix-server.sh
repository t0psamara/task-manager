#!/bin/bash

# Скрипт для исправления проблемы с python3-venv на сервере
# IP: 194.87.118.34

SERVER_IP="194.87.118.34"
SERVER_USER="root"

echo "🔧 Исправление проблемы с python3-venv на сервере $SERVER_IP"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "Выберите путь к проекту на сервере:"
echo "1) /var/www/task-manager (если использовали deploy.sh)"
echo "2) ~/task-manager (если использовали deploy-home.sh)"
read -p "Введите номер (1 или 2): " choice

case $choice in
    1)
        PROJECT_PATH="/var/www/task-manager"
        ;;
    2)
        PROJECT_PATH="~/task-manager"
        ;;
    *)
        echo "Неверный выбор. Используем ~/task-manager"
        PROJECT_PATH="~/task-manager"
        ;;
esac

log_info "Исправление на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} << EOF
    set -e
    cd ${PROJECT_PATH}
    
    echo "🔧 Установка python3-venv..."
    apt update && apt install -y python3-venv
    
    echo "🗑️ Удаление поврежденного виртуального окружения..."
    rm -rf backend/venv
    
    echo "🐍 Создание нового виртуального окружения..."
    cd backend
    python3 -m venv venv
    source venv/bin/activate
    
    echo "📦 Установка зависимостей..."
    pip install -r requirements.txt
    
    echo "📝 Создание .env файла..."
    if [ ! -f ".env" ]; then
        echo "DEBUG=true" > .env
        echo "Создан .env файл с DEBUG=true"
    fi
    
    echo "🛑 Остановка предыдущих процессов..."
    pkill -f "uvicorn.*main:app" || true
    sleep 2
    
    echo "🚀 Запуск сервера..."
    export DEBUG=true
    nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > ../server.log 2>&1 &
    
    echo "✅ Сервер запущен на порту 8000"
    echo "📁 Логи: ${PROJECT_PATH}/server.log"
    echo "🌐 Доступен по адресу: http://194.87.118.34:8000"
    
    # Проверяем что сервер запустился
    sleep 3
    if pgrep -f "uvicorn.*main:app" > /dev/null; then
        echo "✅ Процесс сервера запущен успешно"
    else
        echo "❌ Ошибка запуска сервера, проверьте логи"
    fi
EOF

if [ $? -eq 0 ]; then
    log_info "✅ Исправление завершено успешно!"
    log_info "🔧 API: http://${SERVER_IP}:8000"
    log_info "📊 API Info: http://${SERVER_IP}:8000/info"
    log_info "💓 Health: http://${SERVER_IP}:8000/health"
    echo ""
    log_warn "Для запуска frontend выполните:"
    echo "./start-frontend-server.sh"
else
    log_error "Ошибка исправления"
    exit 1
fi
