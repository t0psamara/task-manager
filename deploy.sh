#!/bin/bash

# Скрипт для автоматического деплоя Task Manager на Timeweb

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой Task Manager на Timeweb..."

# Проверяем наличие .env.production
if [ ! -f ".env.production" ]; then
    echo "❌ Файл .env.production не найден!"
    echo "Создайте файл .env.production на основе env.production.example"
    exit 1
fi

# Останавливаем существующие контейнеры
echo "⏹️  Останавливаем существующие контейнеры..."
docker-compose -f docker-compose.production.yml down

# Обновляем код из git (если используется git)
if [ -d ".git" ]; then
    echo "📥 Обновляем код из репозитория..."
    git pull origin main
fi

# Создаем директории для логов и бэкапов
echo "📁 Создаем необходимые директории..."
mkdir -p backend/logs
mkdir -p backup
mkdir -p ssl

# Собираем и запускаем контейнеры
echo "🔨 Собираем образы..."
docker-compose -f docker-compose.production.yml build --no-cache

echo "🚀 Запускаем контейнеры..."
docker-compose -f docker-compose.production.yml up -d

# Ждем запуска postgres
echo "⏳ Ждем запуска PostgreSQL..."
sleep 10

# Проверяем статус контейнеров
echo "📊 Проверяем статус контейнеров..."
docker-compose -f docker-compose.production.yml ps

# Проверяем health check
echo "🏥 Проверяем здоровье приложения..."
sleep 5

# Тестируем API
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend работает корректно!"
else
    echo "❌ Backend не отвечает!"
    docker-compose -f docker-compose.production.yml logs backend
fi

# Тестируем фронтенд
if curl -f http://localhost > /dev/null 2>&1; then
    echo "✅ Frontend работает корректно!"
else
    echo "❌ Frontend не отвечает!"
    docker-compose -f docker-compose.production.yml logs frontend
fi

echo "🎉 Деплой завершен!"
echo "📍 Приложение доступно по адресу:"
echo "   - Frontend: http://ваш_ip_адрес"
echo "   - Backend API: http://ваш_ip_адрес:8000"
echo "   - API документация: http://ваш_ip_адрес:8000/docs"

echo "📋 Полезные команды:"
echo "   - Просмотр логов: docker-compose -f docker-compose.production.yml logs"
echo "   - Остановка: docker-compose -f docker-compose.production.yml down"
echo "   - Перезапуск: docker-compose -f docker-compose.production.yml restart"
