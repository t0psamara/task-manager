#!/bin/bash

# Скрипт для запуска frontend на удаленном сервере
SERVER_IP="194.87.118.34"
SERVER_USER="root"

echo "🌐 Запуск Frontend на сервере $SERVER_IP"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
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

log_info "Запуск frontend сервера на $SERVER_IP:8080..."
log_warn "Нажмите Ctrl+C для остановки"

# Запускаем frontend на сервере
ssh ${SERVER_USER}@${SERVER_IP} << EOF
    cd ${PROJECT_PATH}/frontend
    echo "🌐 Запуск веб-сервера для frontend на порту 8080..."
    echo "Frontend будет доступен по адресу: http://${SERVER_IP}:8080"
    echo "Нажмите Ctrl+C для остановки"
    python3 -m http.server 8080 --bind 0.0.0.0
EOF
