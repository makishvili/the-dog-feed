#!/bin/bash

# Скрипт для настройки бота на Yandex Compute Cloud VM
# Запускать от пользователя с sudo правами

echo "🚀 Настройка Dog Feeding Bot на Yandex Cloud VM"

# Обновляем систему
echo "📦 Обновление системы..."
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js 18
echo "🟢 Установка Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Устанавливаем PM2 глобально
echo "⚙️ Установка PM2..."
sudo npm install -g pm2

# Устанавливаем дополнительные пакеты
echo "🔧 Установка дополнительных пакетов..."
sudo apt install -y git build-essential python3

# Создаем пользователя для бота
echo "👤 Создание пользователя botuser..."
sudo useradd -m -s /bin/bash botuser
sudo usermod -aG sudo botuser

# Переключаемся на пользователя botuser
echo "📁 Настройка директорий..."
sudo -u botuser mkdir -p /home/botuser/dog-feeding-bot
sudo -u botuser mkdir -p /home/botuser/logs

echo "✅ Базовая настройка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Склонируйте репозиторий: git clone <your-repo> /home/botuser/dog-feeding-bot"
echo "2. Перейдите в директорию: cd /home/botuser/dog-feeding-bot"
echo "3. Установите зависимости: npm install"
echo "4. Создайте .env файл с переменными окружения"
echo "5. Соберите проект: npm run build"
echo "6. Запустите через PM2: pm2 start ecosystem.config.js" 
