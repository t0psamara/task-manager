#!/bin/bash

# Скрипт для запуска Task Manager локально
echo "🚀 Запуск Task Manager"

# Переходим в директорию backend
cd backend

# Активируем виртуальное окружение
if [ ! -d "venv" ]; then
    echo "🔧 Создание виртуального окружения..."
    python3 -m venv venv
    source venv/bin/activate
    echo "📦 Установка зависимостей..."
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Устанавливаем DEBUG=true для использования SQLite
export DEBUG=true

echo "🐍 Запуск API сервера на порту 8000..."
echo "📁 База данных: SQLite (task_manager_debug.db)"
echo "🌐 API будет доступен по адресу: http://localhost:8000"
echo "📊 API Info: http://localhost:8000/info"
echo ""
echo "Нажмите Ctrl+C для остановки"

# Запускаем сервер
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
