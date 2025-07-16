#!/bin/bash

# 🌐 Скрипт настройки nginx с SSL для Yandex Cloud
# Использование: ./scripts/setup-nginx-yandex.sh

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

# Проверка что мы на сервере
if [ ! -f "/etc/os-release" ]; then
    print_error "Скрипт должен запускаться на сервере Ubuntu/Debian"
    exit 1
fi

# Получаем домен из пользователя
if [ -z "$1" ]; then
    read -p "🌐 Введите домен для SSL сертификата (например: yourdomain.com): " DOMAIN
else
    DOMAIN=$1
fi

print_status "Настройка nginx с SSL для домена: $DOMAIN"

# Установка nginx
install_nginx() {
    print_status "Установка nginx..."
    
    sudo apt-get update
    sudo apt-get install -y nginx
    
    # Запуск и включение автозапуска
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    print_success "Nginx установлен и запущен"
}

# Установка certbot
install_certbot() {
    print_status "Установка certbot для SSL сертификатов..."
    
    sudo apt-get install -y certbot python3-certbot-nginx
    
    print_success "Certbot установлен"
}

# Настройка базовой конфигурации nginx
setup_basic_config() {
    print_status "Настройка базовой конфигурации nginx..."
    
    # Создаем временную конфигурацию для получения SSL сертификата
    cat > /tmp/temp-nginx.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 200 'Nginx is working! Setting up SSL...';
        add_header Content-Type text/plain;
    }
}
EOF
    
    sudo cp /tmp/temp-nginx.conf /etc/nginx/sites-available/temp-setup
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/temp-setup /etc/nginx/sites-enabled/
    
    # Проверка и перезагрузка
    sudo nginx -t
    sudo systemctl reload nginx
    
    print_success "Базовая конфигурация настроена"
}

# Получение SSL сертификата
obtain_ssl_certificate() {
    print_status "Получение SSL сертификата для $DOMAIN..."
    
    # Проверяем что домен указывает на этот сервер
    print_warning "Убедитесь что домен $DOMAIN указывает на IP этого сервера!"
    read -p "Продолжить получение SSL сертификата? (y/n): " CONTINUE
    
    if [[ ! $CONTINUE =~ ^[Yy] ]]; then
        print_error "Отменено пользователем"
        exit 1
    fi
    
    # Получаем сертификат
    sudo certbot certonly --webroot -w /var/www/html -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
        print_error "Не удалось получить SSL сертификат"
        print_warning "Проверьте что:"
        echo "  - Домен $DOMAIN указывает на IP этого сервера"
        echo "  - Порт 80 открыт в Security Groups"
        echo "  - DNS записи обновились"
        exit 1
    }
    
    print_success "SSL сертификат получен"
}

# Настройка финальной конфигурации
setup_final_config() {
    print_status "Настройка финальной конфигурации nginx..."
    
    # Обновляем nginx.yandex.conf с правильным доменом
    sed "s/your-domain\.com/$DOMAIN/g" nginx.yandex.conf > /tmp/nginx-final.conf
    
    # Копируем конфигурацию
    sudo cp /tmp/nginx-final.conf /etc/nginx/sites-available/dog-feeding-bot
    
    # Отключаем временную конфигурацию
    sudo rm -f /etc/nginx/sites-enabled/temp-setup
    
    # Включаем финальную конфигурацию
    sudo ln -sf /etc/nginx/sites-available/dog-feeding-bot /etc/nginx/sites-enabled/
    
    # Проверяем конфигурацию
    if sudo nginx -t; then
        print_success "Конфигурация nginx корректна"
        
        # Перезагружаем nginx
        sudo systemctl reload nginx
        print_success "Nginx перезагружен с новой конфигурацией"
    else
        print_error "Ошибка в конфигурации nginx"
        exit 1
    fi
    
    # Очистка временных файлов
    rm -f /tmp/temp-nginx.conf /tmp/nginx-final.conf
}

# Настройка автообновления сертификатов
setup_cert_renewal() {
    print_status "Настройка автообновления SSL сертификатов..."
    
    # Проверяем автообновление
    sudo certbot renew --dry-run
    
    print_success "Автообновление SSL сертификатов настроено"
}

# Открытие портов в firewall
configure_firewall() {
    print_status "Настройка firewall..."
    
    sudo ufw allow 'Nginx Full'
    sudo ufw allow ssh
    
    print_success "Firewall настроен"
}

# Проверка работы
verify_setup() {
    print_status "Проверка работы..."
    
    echo ""
    echo "=== Статус nginx ==="
    sudo systemctl status nginx --no-pager
    
    echo ""
    echo "=== SSL сертификат ==="
    sudo certbot certificates
    
    echo ""
    echo "=== Проверка конфигурации ==="
    sudo nginx -t
    
    print_success "Проверка завершена"
}

# Основная функция
main() {
    echo "🌐 Установка и настройка nginx с SSL для Yandex Cloud"
    echo "===================================================="
    
    install_nginx
    install_certbot
    setup_basic_config
    obtain_ssl_certificate
    setup_final_config
    setup_cert_renewal
    configure_firewall
    verify_setup
    
    echo ""
    echo "🎉 Nginx с SSL успешно настроен!"
    echo "================================================"
    echo "🔗 Ваш бот будет доступен по адресу: https://$DOMAIN"
    echo "📋 Webhook URL: https://$DOMAIN/webhook"
    echo ""
    echo "📝 Не забудьте обновить переменные окружения:"
    echo "   WEBHOOK_URL=https://$DOMAIN"
    echo "   NODE_ENV=production"
    echo ""
    echo "🔧 Полезные команды:"
    echo "   sudo systemctl status nginx     # Статус nginx"
    echo "   sudo nginx -t                   # Проверка конфигурации"
    echo "   sudo certbot certificates       # Статус SSL сертификатов"
    echo "   sudo certbot renew             # Обновление сертификатов"
    echo ""
    echo "⚠️  Обязательно перезапустите бота с новым WEBHOOK_URL!"
}

# Запуск скрипта
main "$@" 
