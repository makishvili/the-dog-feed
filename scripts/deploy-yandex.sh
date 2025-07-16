#!/bin/bash

# 🚀 Интерактивный скрипт развертывания в Yandex Cloud
# Использование: ./scripts/deploy-yandex.sh

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для красивого вывода
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

# Проверка зависимостей
check_dependencies() {
    print_status "Проверяю зависимости..."
    
    if ! command -v ssh &> /dev/null; then
        print_error "SSH не установлен"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        print_error "SCP не установлен"
        exit 1
    fi
    
    print_success "Все зависимости установлены"
}

# Сбор данных для развертывания
collect_deploy_info() {
    print_status "Сбор информации для развертывания..."
    
    read -p "🌐 IP адрес вашей VM в Yandex Cloud: " VM_IP
    read -p "👤 Пользователь для SSH (по умолчанию: yc-user): " SSH_USER
    SSH_USER=${SSH_USER:-yc-user}
    
    read -p "🤖 Токен Telegram бота: " BOT_TOKEN
    
    read -p "🔗 URL для webhook (по умолчанию: https://$VM_IP): " WEBHOOK_URL
    WEBHOOK_URL=${WEBHOOK_URL:-https://$VM_IP}
    
    read -p "🔌 Порт для бота (по умолчанию: 3000): " PORT
    PORT=${PORT:-3000}
    
    read -p "📂 Git репозиторий (например: https://github.com/user/repo.git): " GIT_REPO
    
    # Сохраняем конфигурацию
    cat > .deploy-config << EOF
VM_IP=$VM_IP
SSH_USER=$SSH_USER
BOT_TOKEN=$BOT_TOKEN
WEBHOOK_URL=$WEBHOOK_URL
PORT=$PORT
GIT_REPO=$GIT_REPO
EOF
    
    print_success "Конфигурация сохранена в .deploy-config"
}

# Проверка соединения с VM
test_connection() {
    print_status "Проверяю соединение с VM..."
    
    if ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_USER@$VM_IP" exit 2>/dev/null; then
        print_success "Соединение с VM установлено"
    else
        print_error "Не удается подключиться к VM по SSH"
        print_warning "Убедитесь что:"
        echo "  - VM создана и запущена"
        echo "  - SSH ключ добавлен в VM"
        echo "  - Порт 22 открыт в Security Groups"
        exit 1
    fi
}

# Установка зависимостей на VM
install_dependencies() {
    print_status "Устанавливаю зависимости на VM..."
    
    ssh "$SSH_USER@$VM_IP" << 'EOF'
# Обновление системы
sudo apt-get update

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка дополнительных пакетов
sudo apt-get install -y git build-essential python3

# Установка PM2
sudo npm install -g pm2

# Создание директорий
mkdir -p ~/logs

echo "Зависимости установлены успешно"
EOF
    
    print_success "Зависимости установлены на VM"
}

# Развертывание проекта
deploy_project() {
    print_status "Развертываю проект на VM..."
    
    # Клонирование или обновление репозитория
    ssh "$SSH_USER@$VM_IP" << EOF
cd ~
if [ -d "dog-feeding-bot" ]; then
    echo "Обновляю существующий проект..."
    cd dog-feeding-bot
    git pull
else
    echo "Клонирую проект..."
    git clone $GIT_REPO dog-feeding-bot
    cd dog-feeding-bot
fi

# Установка зависимостей
npm install

# Сборка проекта
npm run build

echo "Проект развернут"
EOF
    
    print_success "Проект развернут на VM"
}

# Настройка окружения
configure_environment() {
    print_status "Настраиваю переменные окружения..."
    
    # Создание .env файла
    cat > /tmp/.env << EOF
BOT_TOKEN=$BOT_TOKEN
NODE_ENV=production
WEBHOOK_URL=$WEBHOOK_URL
PORT=$PORT
EOF
    
    # Копирование .env на VM
    scp /tmp/.env "$SSH_USER@$VM_IP:~/dog-feeding-bot/.env"
    rm /tmp/.env
    
    print_success "Переменные окружения настроены"
}

# Запуск бота
start_bot() {
    print_status "Запускаю бота..."
    
    ssh "$SSH_USER@$VM_IP" << 'EOF'
cd ~/dog-feeding-bot

# Остановка предыдущего процесса (если есть)
pm2 stop dog-feeding-bot 2>/dev/null || true
pm2 delete dog-feeding-bot 2>/dev/null || true

# Запуск нового процесса
pm2 start ecosystem.yandex.config.js

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска
pm2 startup || true

echo "Бот запущен"
EOF
    
    print_success "Бот запущен и настроен автозапуск"
}

# Проверка работы
verify_deployment() {
    print_status "Проверяю работу бота..."
    
    ssh "$SSH_USER@$VM_IP" << 'EOF'
echo "=== Статус PM2 ==="
pm2 status

echo ""
echo "=== Последние логи ==="
pm2 logs dog-feeding-bot --lines 10

echo ""
echo "=== Проверка порта ==="
curl -s http://localhost:3000/webhook || echo "Webhook endpoint не отвечает"
EOF
}

# Настройка firewall
configure_firewall() {
    print_status "Настраиваю firewall..."
    
    ssh "$SSH_USER@$VM_IP" << EOF
# Включение UFW
sudo ufw --force enable

# Разрешение SSH
sudo ufw allow ssh

# Разрешение порта для бота
sudo ufw allow $PORT

# Показать статус
sudo ufw status
EOF
    
    print_success "Firewall настроен"
}

# Основная функция
main() {
    echo "🚀 Автоматическое развертывание Dog Feeding Bot в Yandex Cloud"
    echo "================================================================"
    
    # Проверка зависимостей
    check_dependencies
    
    # Загрузка существующей конфигурации или создание новой
    if [ -f ".deploy-config" ]; then
        print_status "Загружаю существующую конфигурацию..."
        source .deploy-config
        
        echo "Текущая конфигурация:"
        echo "  VM IP: $VM_IP"
        echo "  SSH User: $SSH_USER" 
        echo "  Webhook URL: $WEBHOOK_URL"
        echo "  Port: $PORT"
        
        read -p "Использовать существующую конфигурацию? (y/n): " USE_EXISTING
        if [[ ! $USE_EXISTING =~ ^[Yy] ]]; then
            collect_deploy_info
            source .deploy-config
        fi
    else
        collect_deploy_info
        source .deploy-config
    fi
    
    # Проверка соединения
    test_connection
    
    # Установка зависимостей
    install_dependencies
    
    # Развертывание проекта
    deploy_project
    
    # Настройка окружения
    configure_environment
    
    # Настройка firewall
    configure_firewall
    
    # Запуск бота
    start_bot
    
    # Проверка работы
    verify_deployment
    
    echo ""
    echo "🎉 Развертывание завершено!"
    echo "================================================================"
    echo "📱 Бот доступен по адресу: $WEBHOOK_URL"
    echo "🔧 Управление ботом:"
    echo "   ssh $SSH_USER@$VM_IP"
    echo "   pm2 status"
    echo "   pm2 logs dog-feeding-bot"
    echo "   pm2 restart dog-feeding-bot"
    echo ""
    echo "💡 Для обновления используйте: ./scripts/update-yandex.sh"
}

# Запуск скрипта
main "$@" 
