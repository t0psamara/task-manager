#!/bin/bash

# Скрипт для запуска frontend сервера
echo "🌐 Запуск Frontend сервера"

# Переходим в директорию frontend
cd frontend

# Проверяем есть ли Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не найден. Установите Python3."
    exit 1
fi

echo "📁 Запуск веб-сервера для frontend на порту 8080..."
echo "🌐 Frontend будет доступен по адресу: http://localhost:8080"
echo ""
echo "Убедитесь что API сервер запущен на порту 8000"
echo "Нажмите Ctrl+C для остановки"

# Запускаем простой HTTP сервер
python3 -m http.server 8080
