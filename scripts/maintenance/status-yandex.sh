#!/bin/bash

# 📊 Скрипт проверки статуса Dog Feeding Bot в Yandex Cloud
# Использование: ./scripts/status-yandex.sh

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

# Загрузка конфигурации
if [ ! -f ".deploy-config" ]; then
    echo -e "${RED}[ERROR]${NC} Файл конфигурации .deploy-config не найден"
    echo "Запустите сначала ./scripts/deploy-yandex.sh"
    exit 1
fi

source .deploy-config

print_status "Проверяю статус бота на VM $VM_IP..."

ssh "$SSH_USER@$VM_IP" << 'EOF'
echo "🖥️  === ИНФОРМАЦИЯ О СИСТЕМЕ ==="
echo "Время: $(date)"
echo "Загрузка: $(uptime)"
echo "Память: $(free -h | grep Mem)"
echo "Диск: $(df -h / | tail -1)"

echo ""
echo "🤖 === СТАТУС БОТА ==="
pm2 status

echo ""
echo "📊 === МОНИТОРИНГ ==="
pm2 monit --no-daemon --lines 5 2>/dev/null || echo "PM2 мониторинг недоступен"

echo ""
echo "🌐 === ПРОВЕРКА СОЕДИНЕНИЯ ==="
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000/webhook || echo "Webhook недоступен"

echo ""
echo "🔒 === СТАТУС FIREWALL ==="
sudo ufw status

echo ""
echo "💾 === РАЗМЕР БАЗЫ ДАННЫХ ==="
if [ -f "~/dog-feeding-bot/dog_feeding.db" ]; then
    ls -lh ~/dog-feeding-bot/dog_feeding.db
else
    echo "База данных не найдена"
fi

echo ""
echo "📝 === ПОСЛЕДНИЕ ОШИБКИ ==="
pm2 logs dog-feeding-bot --err --lines 5 2>/dev/null || echo "Ошибок не найдено"
EOF

echo ""
echo -e "${GREEN}✅ Проверка завершена${NC}"
echo ""
echo "🔧 Полезные команды:"
echo "  ./scripts/logs-yandex.sh     - просмотр логов"
echo "  ./scripts/update-yandex.sh   - обновление бота"
echo "  ssh $SSH_USER@$VM_IP         - подключение к VM" 
