#!/bin/bash

# 📋 Скрипт просмотра логов Dog Feeding Bot в Yandex Cloud
# Использование: ./scripts/logs-yandex.sh [количество_строк]

set -e

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Загрузка конфигурации
if [ ! -f ".deploy-config" ]; then
    echo -e "${RED}[ERROR]${NC} Файл конфигурации .deploy-config не найден"
    echo "Запустите сначала ./scripts/deploy-yandex.sh"
    exit 1
fi

source .deploy-config

LINES=${1:-50}

print_status "Показываю последние $LINES строк логов..."

ssh "$SSH_USER@$VM_IP" << EOF
echo "=== Статус PM2 ==="
pm2 status

echo ""
echo "=== Последние $LINES строк логов ==="
pm2 logs dog-feeding-bot --lines $LINES

echo ""
echo "💡 Для просмотра логов в реальном времени:"
echo "   ssh $SSH_USER@$VM_IP"
echo "   pm2 logs dog-feeding-bot --follow"
EOF 
