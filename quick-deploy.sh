#!/bin/bash

# Быстрый деплой с обходом сетевых проблем

echo "🚀 Быстрый деплой Task Manager..."

# Создаем .env если нет
if [ ! -f ".env" ]; then
    if [ -f "env.deploy" ]; then
        cp env.deploy .env
        echo "✅ Создан .env файл"
    else
        echo "❌ Нужен файл env.deploy"
        exit 1
    fi
fi

# Пробуем минимальный образ без компиляции
echo "🔨 Пробуем минимальный образ без компиляции..."
cp backend/Dockerfile.minimal backend/Dockerfile

# Останавливаем контейнеры
docker-compose down 2>/dev/null

# Собираем и запускаем
if docker-compose build --no-cache; then
    echo "✅ Минимальный образ собран!"
    docker-compose up -d
    echo "🎉 Деплой завершен! Проверьте http://your_ip:8000/health"
else
    echo "❌ Ошибка сборки. Попробуйте:"
    echo "   1. Проверить интернет соединение"
    echo "   2. Запустить ./deploy.sh для полного деплоя"
    exit 1
fi
