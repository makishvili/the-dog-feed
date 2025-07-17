#!/bin/bash

# 🔄 Скрипт обновления Dog Feeding Bot в Yandex Cloud
# Использование: ./scripts/update-yandex.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Загрузка конфигурации
if [ ! -f ".deploy-config" ]; then
    print_error "Файл конфигурации .deploy-config не найден"
    print_status "Запустите сначала ./scripts/deploy-yandex.sh"
    exit 1
fi

source .deploy-config

print_status "Обновляю бота на VM $VM_IP..."

# Обновление проекта
ssh "$SSH_USER@$VM_IP" << 'EOF'
cd ~/dog-feeding-bot

echo "🔄 Получаю последние изменения..."
git pull

echo "📦 Устанавливаю зависимости..."
npm install

echo "🔨 Собираю проект..."
npm run build

echo "🔄 Перезапускаю бота..."
pm2 restart dog-feeding-bot

echo "✅ Обновление завершено"
EOF

print_success "Бот успешно обновлен!"

# Показать статус
print_status "Статус бота:"
ssh "$SSH_USER@$VM_IP" "pm2 status dog-feeding-bot" 
