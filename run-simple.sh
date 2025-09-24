#!/bin/bash

# Простой запуск Task Manager без Docker с SQLite

echo "🚀 Простой запуск Task Manager с SQLite..."

# Переходим в директорию проекта
cd "$(dirname "$0")"

# Создаем .env файл если его нет
if [ ! -f ".env" ]; then
    echo "📋 Создаем .env файл..."
    cp env.sqlite .env
    echo "✅ Файл .env создан с настройками SQLite"
fi

# Проверяем Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 не установлен!"
    echo "Установите Python3: apt install python3 python3-pip python3-venv"
    exit 1
fi

# Создаем виртуальное окружение если его нет
if [ ! -d "venv" ]; then
    echo "📦 Создаем виртуальное окружение..."
    python3 -m venv venv
fi

# Активируем виртуальное окружение
echo "🔧 Активируем виртуальное окружение..."
source venv/bin/activate

# Обновляем pip
echo "📥 Обновляем pip..."
pip install --upgrade pip

# Устанавливаем зависимости
echo "📥 Устанавливаем зависимости..."
pip install -r backend/requirements.txt

# Переходим в директорию backend
cd backend

# Запускаем сервер
echo "🚀 Запускаем Task Manager на http://194.87.118.34:8000"
echo "📍 Frontend будет доступен через nginx на http://194.87.118.34"
echo "📋 API документация: http://194.87.118.34:8000/docs"
echo ""
echo "Для остановки нажмите Ctrl+C"
echo ""

# Запуск с автоматической перезагрузкой
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
