#!/bin/bash

# Полная автоматическая установка Task Manager без Docker

echo "🚀 Автоматическая установка Task Manager на Timeweb"
echo "📍 IP сервера: 194.87.118.34"
echo ""

# Обновляем систему
echo "🔄 Обновляем систему..."
apt update && apt upgrade -y

# Устанавливаем необходимые пакеты
echo "📦 Устанавливаем пакеты..."
apt install -y python3 python3-pip python3-venv nginx git curl

# Переходим в директорию проекта
cd /root/task-manager

# Создаем .env файл
echo "📋 Настраиваем конфигурацию..."
cp env.sqlite .env

# Делаем скрипты исполняемыми
chmod +x run-simple.sh
chmod +x install-simple.sh

# Создаем виртуальное окружение и устанавливаем зависимости
echo "🐍 Настраиваем Python окружение..."
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt

# Настраиваем nginx
echo "🌐 Настраиваем nginx..."
cp nginx-simple.conf /etc/nginx/sites-available/taskmanager
ln -sf /etc/nginx/sites-available/taskmanager /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию nginx
nginx -t

# Настраиваем systemd сервис
echo "⚙️  Настраиваем автозапуск..."
cp taskmanager.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable taskmanager

# Запускаем сервисы
echo "🚀 Запускаем сервисы..."
systemctl start taskmanager
systemctl restart nginx

# Проверяем статус
echo ""
echo "📊 Статус сервисов:"
systemctl status taskmanager --no-pager -l
systemctl status nginx --no-pager -l

# Проверяем работу API
echo ""
echo "🏥 Проверяем работу приложения..."
sleep 3

if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend работает!"
else
    echo "❌ Backend не отвечает. Проверьте логи: journalctl -u taskmanager -f"
fi

if curl -s http://localhost > /dev/null; then
    echo "✅ Frontend работает!"
else
    echo "❌ Frontend не отвечает. Проверьте nginx: systemctl status nginx"
fi

echo ""
echo "🎉 Установка завершена!"
echo ""
echo "📍 Ваше приложение доступно по адресам:"
echo "   🌐 Frontend: http://194.87.118.34"
echo "   🔧 API документация: http://194.87.118.34:8000/docs"
echo "   💚 Health check: http://194.87.118.34:8000/health"
echo ""
echo "📋 Полезные команды:"
echo "   📊 Статус: systemctl status taskmanager"
echo "   📜 Логи: journalctl -u taskmanager -f"
echo "   🔄 Перезапуск: systemctl restart taskmanager"
echo "   ⏹️  Остановка: systemctl stop taskmanager"
echo ""
echo "📁 База данных SQLite: /root/task-manager/backend/task_manager_debug.db"
