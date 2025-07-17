#!/bin/bash

# 🧹 Скрипт полной очистки VM до девственного состояния
# Использование: ./scripts/reset-vm.sh

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

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка наличия конфигурации
if [ ! -f ".deploy-config" ]; then
    print_error "Файл конфигурации .deploy-config не найден"
    print_status "Введите данные для подключения к VM:"
    read -p "🌐 IP адрес VM: " VM_IP
    read -p "👤 SSH пользователь (по умолчанию: yc-user): " SSH_USER
    SSH_USER=${SSH_USER:-yc-user}
    
    # Сохраняем минимальную конфигурацию
    cat > .deploy-config << EOF
VM_IP=$VM_IP
SSH_USER=$SSH_USER
EOF
else
    source .deploy-config
fi

print_warning "⚠️  ВНИМАНИЕ! Этот скрипт полностью очистит VM $VM_IP"
print_warning "Будут удалены:"
echo "  - Все Node.js приложения и PM2 процессы"
echo "  - Nginx и все его конфигурации"
echo "  - SSL сертификаты"
echo "  - Весь проект ~/dog-feeding-bot/"
echo "  - Все логи и временные файлы"
echo ""

read -p "Вы уверены, что хотите продолжить? (yes/no): " CONFIRM
if [[ ! $CONFIRM == "yes" ]]; then
    print_error "Операция отменена"
    exit 1
fi

print_status "Начинаю полную очистку VM $VM_IP..."

# Функция выполнения команд на удаленной машине
run_remote() {
    local commands="$1"
    local description="$2"
    
    print_status "$description"
    ssh "$SSH_USER@$VM_IP" << EOF
$commands
EOF
}

# 1. Остановка всех служб
run_remote "
echo '🛑 Остановка всех служб...'

# PM2 процессы
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

# Nginx
sudo systemctl stop nginx 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true

# Certbot timer
sudo systemctl stop certbot.timer 2>/dev/null || true
sudo systemctl disable certbot.timer 2>/dev/null || true

echo '✅ Службы остановлены'
" "Остановка всех служб на VM"

# 2. Удаление пакетов
run_remote "
echo '📦 Удаление установленных пакетов...'

# Удаление PM2 глобально (если остался)
sudo npm uninstall -g pm2 2>/dev/null || true

# Удаление Node.js и npm
sudo apt remove --purge -y nodejs npm 2>/dev/null || true

# Удаление nginx
sudo apt remove --purge -y nginx nginx-common nginx-core 2>/dev/null || true

# Удаление certbot
sudo apt remove --purge -y certbot python3-certbot-nginx 2>/dev/null || true

# Очистка
sudo apt autoremove -y 2>/dev/null || true
sudo apt autoclean 2>/dev/null || true

echo '✅ Пакеты удалены'
" "Удаление установленных пакетов"

# 3. Очистка конфигурационных файлов
run_remote "
echo '🗂️  Удаление конфигурационных файлов...'

# Nginx конфигурации
sudo rm -rf /etc/nginx/ 2>/dev/null || true
sudo rm -rf /var/log/nginx/ 2>/dev/null || true

# SSL сертификаты
sudo rm -rf /etc/letsencrypt/ 2>/dev/null || true

# Проект и логи
rm -rf ~/dog-feeding-bot/ 2>/dev/null || true
rm -rf ~/logs/ 2>/dev/null || true
rm -rf ~/.pm2/ 2>/dev/null || true

# Node.js остатки
sudo rm -rf /usr/local/lib/node_modules/ 2>/dev/null || true
rm -rf ~/.npm/ 2>/dev/null || true
rm -rf ~/.node-gyp/ 2>/dev/null || true

# Временные файлы скриптов
rm -f ~/setup-nginx-yandex.sh 2>/dev/null || true
rm -f ~/nginx.yandex.conf 2>/dev/null || true

echo '✅ Файлы удалены'
" "Удаление конфигурационных файлов"

# 4. Сброс firewall
run_remote "
echo '🔥 Сброс firewall...'

# Сброс UFW правил
sudo ufw --force reset 2>/dev/null || true
sudo ufw disable 2>/dev/null || true

echo '✅ Firewall сброшен'
" "Сброс настроек firewall"

# 5. Финальная проверка
print_status "Проверка результатов очистки..."

ssh "$SSH_USER@$VM_IP" << 'EOF'
echo "🔍 Проверяем результаты очистки:"
echo ""

# Проверяем удаление программ
which node >/dev/null 2>&1 && echo "❌ Node.js все еще установлен" || echo "✅ Node.js удален"
which nginx >/dev/null 2>&1 && echo "❌ Nginx все еще установлен" || echo "✅ Nginx удален"
which certbot >/dev/null 2>&1 && echo "❌ Certbot все еще установлен" || echo "✅ Certbot удален"
which pm2 >/dev/null 2>&1 && echo "❌ PM2 все еще установлен" || echo "✅ PM2 удален"

# Проверяем директории
[ -d ~/dog-feeding-bot ] && echo "❌ Проект все еще существует" || echo "✅ Проект удален"
[ -d /etc/nginx ] && echo "❌ Nginx конфиги все еще существуют" || echo "✅ Nginx конфиги удалены"
[ -d /etc/letsencrypt ] && echo "❌ SSL сертификаты все еще существуют" || echo "✅ SSL сертификаты удалены"

# Проверяем процессы
PM2_PROCS=$(ps aux | grep -c '[p]m2' || true)
if [ "$PM2_PROCS" -gt 0 ]; then
    echo "❌ PM2 процессы все еще запущены"
else
    echo "✅ PM2 процессы остановлены"
fi

NGINX_PROCS=$(ps aux | grep -c '[n]ginx' || true)
if [ "$NGINX_PROCS" -gt 0 ]; then
    echo "❌ Nginx процессы все еще запущены"
else
    echo "✅ Nginx процессы остановлены"
fi

echo ""
echo "🧹 Очистка завершена!"
EOF

# 6. Очистка локальной конфигурации
print_status "Очистка локальной конфигурации..."
rm -f .deploy-config .vm-info 2>/dev/null || true
print_success "Локальная конфигурация очищена"

echo ""
print_success "🎉 VM полностью очищена и готова к повторному развертыванию!"
echo ""
print_status "Следующие шаги:"
echo "1. Запустите: ./scripts/deploy-yandex.sh"
echo "2. Настройте nginx: ./scripts/setup-nginx-yandex.sh"
echo "3. Проверьте статус: ./scripts/status-yandex.sh"
echo ""
print_warning "📋 Подробную инструкцию см. в docs/FULL_RESET_TEST.md" 
