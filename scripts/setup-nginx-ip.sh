#!/bin/bash

# Скрипт для настройки nginx с IP-адресом
# Использование: ./scripts/setup-nginx-ip.sh

set -e

echo "🔧 Настройка nginx для работы с IP адресом..."

# Проверяем, что мы на сервере
if [ ! -d "/etc/nginx" ]; then
    echo "❌ Nginx не найден. Убедитесь, что вы запускаете скрипт на сервере."
    exit 1
fi

# Копируем конфигурацию
echo "📋 Копирование конфигурации nginx..."
sudo cp nginx.ip.conf /etc/nginx/sites-available/dog-feeding-bot-ip

# Отключаем старый сайт если есть
if [ -L "/etc/nginx/sites-enabled/dog-feeding-bot" ]; then
    echo "🔄 Отключение старой конфигурации..."
    sudo rm /etc/nginx/sites-enabled/dog-feeding-bot
fi

# Включаем новый сайт
echo "✅ Включение новой конфигурации..."
sudo ln -sf /etc/nginx/sites-available/dog-feeding-bot-ip /etc/nginx/sites-enabled/

# Отключаем default сайт если включен
if [ -L "/etc/nginx/sites-enabled/default" ]; then
    echo "🔄 Отключение default сайта..."
    sudo rm /etc/nginx/sites-enabled/default
fi

# Проверяем конфигурацию
echo "🔍 Проверка конфигурации nginx..."
if sudo nginx -t; then
    echo "✅ Конфигурация nginx корректна"
    
    # Перезагружаем nginx
    echo "🔄 Перезагрузка nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx перезагружен"
    
    echo ""
    echo "🎉 Nginx настроен для работы с IP!"
    echo ""
    echo "📝 Не забудьте обновить переменные окружения:"
    echo "   WEBHOOK_URL=http://89.169.189.202"
    echo "   NODE_ENV=production"
    echo ""
    echo "🔗 Webhook будет доступен по адресу: http://89.169.189.202/webhook"
    
else
    echo "❌ Ошибка в конфигурации nginx"
    exit 1
fi 
