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

# Установка необходимых пакетов
install_dependencies() {
    print_status "Установка необходимых пакетов..."
    
    sudo apt-get update
    sudo apt-get install -y curl dnsutils net-tools
    
    print_success "Зависимости установлены"
}

# Установка nginx
install_nginx() {
    print_status "Установка nginx..."
    
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
    
    # Создаем директорию для webroot если её нет
    sudo mkdir -p /var/www/html
    sudo chown -R www-data:www-data /var/www/html
    sudo chmod -R 755 /var/www/html
    
    # Создаем простую страницу для проверки
    echo "Nginx is working! Setting up SSL..." | sudo tee /var/www/html/index.html
    
    # Создаем директорию для ACME challenge
    sudo mkdir -p /var/www/html/.well-known/acme-challenge
    sudo chown -R www-data:www-data /var/www/html/.well-known
    sudo chmod -R 755 /var/www/html/.well-known
    
    # Создаем временную конфигурацию для получения SSL сертификата
    cat > /tmp/temp-nginx.conf << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # Важно: корневая директория для webroot
    root /var/www/html;
    index index.html;
    
    # ACME challenge для Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        try_files \$uri =404;
    }
    
    # Остальные запросы
    location / {
        try_files \$uri \$uri/ =404;
    }
}
EOF
    
    sudo cp /tmp/temp-nginx.conf /etc/nginx/sites-available/temp-setup
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/temp-setup /etc/nginx/sites-enabled/
    
    # Проверка конфигурации
    if ! sudo nginx -t; then
        print_error "Ошибка в конфигурации nginx"
        exit 1
    fi
    
    # Перезагружаем nginx
    sudo systemctl reload nginx
    
    # Ждем запуска nginx
    print_status "Ожидание запуска nginx..."
    sleep 5
    
    # Проверяем что nginx действительно работает
    if ! sudo systemctl is-active --quiet nginx; then
        print_error "Nginx не запущен"
        sudo systemctl status nginx
        exit 1
    fi
    
    # Проверяем что порт 80 доступен
    if ! netstat -tlnp | grep -q ":80 "; then
        print_error "Nginx не слушает порт 80"
        exit 1
    fi
    
    # Тестируем HTTP ответ (если возможно)
    print_status "Проверка HTTP ответа..."
    if curl -s -f http://localhost/ > /dev/null; then
        print_success "Nginx отвечает на HTTP запросы"
    else
        print_warning "Не удалось проверить HTTP ответ localhost, но продолжаем..."
    fi
    
    print_success "Базовая конфигурация настроена и проверена"
}

# Проверка и настройка Security Groups
check_security_groups() {
    print_status "Проверка настроек Security Groups..."
    
    # Проверяем наличие yc CLI
    if ! command -v yc &> /dev/null; then
        print_status "Установка Yandex Cloud CLI..."
        
        # Скачиваем и устанавливаем yc CLI
        curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
        
        # Добавляем в PATH для текущей сессии
        export PATH="$HOME/yandex-cloud/bin:$PATH"
        
        # Добавляем в bashrc для будущих сессий
        if ! grep -q "yandex-cloud/bin" ~/.bashrc; then
            echo 'export PATH="$HOME/yandex-cloud/bin:$PATH"' >> ~/.bashrc
        fi
        
        # Проверяем установку
        if command -v yc &> /dev/null; then
            print_success "Yandex Cloud CLI установлен"
        else
            print_warning "Не удалось установить Yandex Cloud CLI"
            print_warning "Продолжаем без автоматической проверки Security Groups"
        fi
    fi
    
    # Если yc CLI доступен, пробуем его использовать
    if command -v yc &> /dev/null; then
        # Проверяем что yc CLI настроен
        if yc config list &> /dev/null; then
            print_success "Yandex Cloud CLI доступен и настроен"
            
            # Получаем информацию о VM
            VM_INFO=$(yc compute instance list --format json 2>/dev/null)
            if [ $? -eq 0 ]; then
                print_success "Получена информация о VM"
                
                # Показываем текущие Security Groups
                echo ""
                print_status "Текущие Security Groups:"
                yc vpc security-group list 2>/dev/null || print_warning "Не удалось получить список Security Groups"
            else
                print_warning "Не удалось получить информацию о VM"
            fi
        else
            print_warning "Yandex Cloud CLI установлен, но не настроен"
            print_warning "Для автоматической проверки Security Groups выполните: yc init"
            print_warning "Продолжаем с ручной настройкой..."
        fi
    fi
    
    echo ""
    print_warning "🔥 ВАЖНО: Для работы SSL нужно открыть порты в Security Groups!"
    echo ""
    echo "В Yandex Cloud Console:"
    echo "1. Перейдите в раздел 'Compute Cloud' -> 'Виртуальные машины'"
    echo "2. Найдите вашу VM и откройте её"
    echo "3. Перейдите в раздел 'Группы безопасности'"
    echo "4. Убедитесь что есть правила:"
    echo "   - Входящий трафик: TCP/80 (HTTP) - 0.0.0.0/0"
    echo "   - Входящий трафик: TCP/443 (HTTPS) - 0.0.0.0/0"
    echo "   - Входящий трафик: TCP/22 (SSH) - 0.0.0.0/0"
    echo ""
    echo "Или создайте новую Security Group с этими правилами."
    echo ""
    
    read -p "Открыли порты 80 и 443 в Security Groups? (y/n): " PORTS_OPENED
    if [[ ! $PORTS_OPENED =~ ^[Yy] ]]; then
        print_error "Откройте порты в Security Groups и запустите скрипт заново"
        exit 1
    fi
}

# Проверка доступности портов извне
check_external_connectivity() {
    print_status "Проверка внешней доступности портов..."
    
    # Получаем внешний IP
    EXTERNAL_IP=$(curl -s --max-time 10 https://ipv4.icanhazip.com)
    if [ -z "$EXTERNAL_IP" ]; then
        print_warning "Не удалось определить внешний IP"
        return 1
    fi
    
    print_status "Внешний IP сервера: $EXTERNAL_IP"
    
    # Проверяем что nginx слушает на всех интерфейсах
    NGINX_LISTENERS=$(sudo netstat -tlnp | grep :80)
    echo "Nginx слушает на портах:"
    echo "$NGINX_LISTENERS"
    
    if echo "$NGINX_LISTENERS" | grep -q "0.0.0.0:80"; then
        print_success "Nginx слушает на всех интерфейсах (0.0.0.0:80)"
    elif echo "$NGINX_LISTENERS" | grep -q ":::80"; then
        print_success "Nginx слушает на IPv6 интерфейсах"
    else
        print_warning "Nginx может не слушать на внешних интерфейсах"
    fi
    
    # Тестируем подключение к домену
    print_status "Тестирование подключения к домену $DOMAIN..."
    
    # Используем несколько методов проверки
    if timeout 15 curl -v -s "http://$DOMAIN/" > /tmp/curl_test.log 2>&1; then
        print_success "Домен $DOMAIN доступен по HTTP"
        return 0
    else
        print_error "Домен $DOMAIN НЕ доступен по HTTP"
        echo ""
        echo "Детали ошибки подключения:"
        cat /tmp/curl_test.log
        echo ""
        
        # Дополнительная диагностика
        print_status "Дополнительная диагностика..."
        
        # Проверяем DNS
        DNS_IP=$(dig +short $DOMAIN A | head -n1)
        if [ "$DNS_IP" = "$EXTERNAL_IP" ]; then
            print_success "DNS правильный: $DOMAIN -> $DNS_IP"
        else
            print_warning "DNS проблема: $DOMAIN -> $DNS_IP (ожидается $EXTERNAL_IP)"
        fi
        
        # Проверяем прямое подключение к IP
        if timeout 10 curl -s "http://$EXTERNAL_IP/" > /dev/null 2>&1; then
            print_warning "IP доступен, но домен нет - проблема DNS или Virtual Host"
        else
            print_error "IP тоже недоступен - проблема с firewall или nginx"
        fi
        
        return 1
    fi
}

# Настройка локального firewall
configure_local_firewall() {
    print_status "Настройка локального firewall (ufw)..."
    
    # Проверяем статус ufw
    UFW_STATUS=$(sudo ufw status 2>/dev/null | head -n1)
    echo "Статус ufw: $UFW_STATUS"
    
    if echo "$UFW_STATUS" | grep -q "inactive"; then
        print_success "UFW отключен - нет блокировки на уровне ОС"
    else
        print_status "UFW активен, настраиваем правила..."
        
        # Добавляем правила для HTTP/HTTPS/SSH одной командой
        print_status "Добавляем правила firewall для портов 80, 443, 22..."
        sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 22/tcp
        
        if [ $? -eq 0 ]; then
            print_success "✅ Правила UFW успешно добавлены"
        else
            print_error "❌ Ошибка при добавлении правил UFW"
        fi
        
        # Показываем текущие правила
        print_status "Текущие правила UFW:"
        sudo ufw status numbered | grep -E "(80|443|22)"
    fi
    
    # Дополнительная проверка - убеждаемся что порты действительно открыты
    if echo "$UFW_STATUS" | grep -q "active"; then
        print_status "Проверка открытых портов в UFW..."
        
        if sudo ufw status | grep -q "80/tcp"; then
            print_success "✅ Порт 80/tcp открыт в UFW"
        else
            print_warning "⚠️ Порт 80/tcp может быть заблокирован в UFW"
        fi
        
        if sudo ufw status | grep -q "443/tcp"; then
            print_success "✅ Порт 443/tcp открыт в UFW"
        else
            print_warning "⚠️ Порт 443/tcp может быть заблокирован в UFW"
        fi
    fi
    
    # Проверяем iptables
    if sudo iptables -L INPUT | grep -q "DROP\|REJECT"; then
        print_warning "⚠️ Обнаружены ограничительные правила iptables"
        print_warning "Возможно нужно добавить правила для портов 80 и 443"
        echo "Проверьте: sudo iptables -L INPUT"
    else
        print_success "✅ Iptables не блокирует подключения"
    fi
}

# Проверка готовности для получения SSL
verify_readiness() {
    print_status "Комплексная проверка готовности для SSL..."
    
    # Проверяем что nginx запущен
    if ! sudo systemctl is-active --quiet nginx; then
        print_error "Nginx не запущен"
        sudo systemctl status nginx
        return 1
    fi
    print_success "✅ Nginx запущен"
    
    # Проверяем конфигурацию
    if ! sudo nginx -t > /dev/null 2>&1; then
        print_error "Ошибка в конфигурации nginx"
        sudo nginx -t
        return 1
    fi
    print_success "✅ Конфигурация nginx корректна"
    
    # Проверяем Security Groups и firewall
    check_security_groups
    configure_local_firewall
    
    # Проверяем внешнее подключение
    if ! check_external_connectivity; then
        print_error "Домен недоступен извне. SSL сертификат не будет получен."
        echo ""
        print_warning "Возможные причины:"
        echo "1. 🔥 Порты 80/443 заблокированы в Security Groups Yandex Cloud"
        echo "2. 🌐 DNS еще не обновился (нужно подождать)"
        echo "3. 🛡️ Локальный firewall блокирует подключения"
        echo "4. ⚙️ Nginx неправильно настроен"
        echo ""
        
        read -p "Хотите попробовать получить SSL сертификат несмотря на проблемы? (y/n): " FORCE_SSL
        if [[ ! $FORCE_SSL =~ ^[Yy] ]]; then
            print_error "Отменено. Исправьте проблемы с доступностью и запустите снова."
            exit 1
        fi
        print_warning "Принудительно продолжаем получение SSL..."
    else
        print_success "✅ Домен доступен извне"
    fi
    
    print_success "Система готова для получения SSL сертификата"
}

# Получение SSL сертификата
obtain_ssl_certificate() {
    print_status "Проверка SSL сертификата для $DOMAIN..."
    
    # Проверяем, существует ли уже сертификат
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/privkey.pem" ]; then
        print_success "SSL сертификат для $DOMAIN уже установлен"
        
        # Проверяем срок действия сертификата
        CERT_EXPIRY=$(sudo openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" | cut -d= -f2)
        EXPIRY_DATE=$(date -d "$CERT_EXPIRY" +%s)
        CURRENT_DATE=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_DATE - CURRENT_DATE) / 86400 ))
        
        if [ $DAYS_LEFT -gt 30 ]; then
            print_success "Сертификат действителен еще $DAYS_LEFT дней"
            return 0
        else
            print_warning "Сертификат истекает через $DAYS_LEFT дней, обновляем..."
        fi
    else
        print_status "Получение нового SSL сертификата для $DOMAIN..."
    fi
    
    # Проверяем что домен указывает на этот сервер
    print_status "Проверка DNS настроек для $DOMAIN..."
    
    # Получаем внешний IP сервера
    SERVER_IP=$(curl -s --max-time 10 https://ipv4.icanhazip.com || curl -s --max-time 10 https://api.ipify.org)
    if [ -z "$SERVER_IP" ]; then
        print_warning "Не удалось определить внешний IP сервера"
    else
        print_status "Внешний IP сервера: $SERVER_IP"
        
        # Проверяем DNS
        DNS_IP=$(dig +short $DOMAIN A | head -n1)
        if [ -z "$DNS_IP" ]; then
            print_warning "Домен $DOMAIN не резолвится"
        elif [ "$DNS_IP" = "$SERVER_IP" ]; then
            print_success "DNS настроен правильно: $DOMAIN -> $SERVER_IP"
        else
            print_warning "DNS указывает на другой IP: $DOMAIN -> $DNS_IP (ожидается $SERVER_IP)"
        fi
    fi
    
    # Проверяем доступность webroot
    if [ ! -d "/var/www/html/.well-known/acme-challenge" ]; then
        print_error "Директория для ACME challenge не найдена"
        exit 1
    fi
    
    # Тестируем создание файла в webroot
    TEST_FILE="/var/www/html/.well-known/acme-challenge/test-$$"
    if echo "test" | sudo tee "$TEST_FILE" > /dev/null && [ -f "$TEST_FILE" ]; then
        sudo rm -f "$TEST_FILE"
        print_success "Webroot доступен для записи"
    else
        print_error "Нет доступа для записи в webroot"
        exit 1
    fi
    
    print_warning "Убедитесь что домен $DOMAIN указывает на IP этого сервера!"
    read -p "Продолжить получение SSL сертификата? (y/n): " CONTINUE
    
    if [[ ! $CONTINUE =~ ^[Yy] ]]; then
        print_error "Отменено пользователем"
        exit 1
    fi
    
    # Получаем сертификат
    print_status "Запрос SSL сертификата для $DOMAIN..."
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
    print_status "Проверка автообновления SSL сертификатов..."
    
    # Проверяем, что systemd timer для certbot активен
    if systemctl is-active --quiet certbot.timer; then
        print_success "Автообновление certbot уже активно"
    else
        print_status "Включаем автообновление certbot..."
        sudo systemctl enable certbot.timer
        sudo systemctl start certbot.timer
        print_success "Автообновление certbot включено"
    fi
    
    # Показываем статус
    print_status "Статус автообновления:"
    sudo systemctl status certbot.timer --no-pager --lines=3
    
    print_success "Сертификаты будут автоматически обновляться каждые 12 часов"
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
    
    install_dependencies
    install_nginx
    install_certbot
    setup_basic_config
    verify_readiness
    obtain_ssl_certificate
    setup_final_config
    setup_cert_renewal
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
