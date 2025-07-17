#!/bin/bash

# 🔍 Скрипт диагностики проблем подключения для SSL
# Использование: ./scripts/diagnose-connectivity.sh [domain]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Получаем домен
if [ -z "$1" ]; then
    read -p "🌐 Введите домен для диагностики: " DOMAIN
else
    DOMAIN=$1
fi

echo "🔍 Диагностика подключения для домена: $DOMAIN"
echo "================================================"

# 1. Проверка DNS
echo ""
print_status "1. Проверка DNS..."
DNS_IP=$(dig +short $DOMAIN A | head -n1)
if [ -z "$DNS_IP" ]; then
    print_error "Домен $DOMAIN не резолвится"
    echo "❌ DNS не настроен или еще не обновился"
else
    print_success "DNS резолвится: $DOMAIN -> $DNS_IP"
fi

# 2. Получение внешнего IP сервера
echo ""
print_status "2. Проверка внешнего IP сервера..."
SERVER_IP=$(curl -s --max-time 10 https://ipv4.icanhazip.com)
if [ -z "$SERVER_IP" ]; then
    print_error "Не удалось определить внешний IP сервера"
else
    print_success "Внешний IP сервера: $SERVER_IP"
    
    if [ "$DNS_IP" = "$SERVER_IP" ]; then
        print_success "✅ DNS правильно указывает на этот сервер"
    else
        print_warning "⚠️ DNS указывает на другой IP ($DNS_IP != $SERVER_IP)"
    fi
fi

# 3. Проверка статуса nginx
echo ""
print_status "3. Проверка nginx..."
if sudo systemctl is-active --quiet nginx; then
    print_success "✅ Nginx запущен"
    
    # Проверяем на каких портах слушает
    NGINX_PORTS=$(sudo netstat -tlnp | grep nginx | grep :80)
    if [ -n "$NGINX_PORTS" ]; then
        print_success "✅ Nginx слушает порт 80"
        echo "$NGINX_PORTS"
    else
        print_error "❌ Nginx не слушает порт 80"
    fi
else
    print_error "❌ Nginx не запущен"
    sudo systemctl status nginx --no-pager
fi

# 4. Проверка конфигурации nginx
echo ""
print_status "4. Проверка конфигурации nginx..."
if sudo nginx -t > /dev/null 2>&1; then
    print_success "✅ Конфигурация nginx корректна"
else
    print_error "❌ Ошибка в конфигурации nginx"
    sudo nginx -t
fi

# 5. Проверка webroot
echo ""
print_status "5. Проверка webroot для ACME challenge..."
WEBROOT="/var/www/html/.well-known/acme-challenge"
if [ -d "$WEBROOT" ]; then
    print_success "✅ Директория $WEBROOT существует"
    
    # Проверяем права
    WEBROOT_PERMS=$(ls -ld $WEBROOT)
    echo "Права: $WEBROOT_PERMS"
    
    # Тестируем запись
    TEST_FILE="$WEBROOT/test-$$"
    if echo "test" | sudo tee "$TEST_FILE" > /dev/null && [ -f "$TEST_FILE" ]; then
        print_success "✅ Запись в webroot работает"
        sudo rm -f "$TEST_FILE"
    else
        print_error "❌ Нет доступа для записи в webroot"
    fi
else
    print_error "❌ Директория $WEBROOT не существует"
fi

# 6. Проверка локального firewall
echo ""
print_status "6. Проверка локального firewall..."

# UFW
UFW_STATUS=$(sudo ufw status 2>/dev/null | head -n1)
echo "UFW статус: $UFW_STATUS"
if echo "$UFW_STATUS" | grep -q "active"; then
    if sudo ufw status | grep -q "80\|443"; then
        print_success "✅ UFW разрешает порты 80/443"
    else
        print_warning "⚠️ UFW может блокировать порты 80/443"
        echo "Исправление: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
    fi
fi

# iptables
if sudo iptables -L INPUT | grep -q "DROP\|REJECT"; then
    print_warning "⚠️ Iptables имеет ограничительные правила"
    echo "Проверьте: sudo iptables -L"
else
    print_success "✅ Iptables не блокирует подключения"
fi

# 7. Проверка подключения к домену
echo ""
print_status "7. Тестирование HTTP подключения..."

# Тест curl с подробностями
echo "Тестируем: curl -v http://$DOMAIN/"
if timeout 15 curl -v "http://$DOMAIN/" > /tmp/curl_test.log 2>&1; then
    print_success "✅ HTTP подключение к домену работает"
else
    print_error "❌ HTTP подключение к домену НЕ работает"
    echo ""
    echo "Детали ошибки curl:"
    cat /tmp/curl_test.log
fi

# Тест прямого подключения к IP
if [ -n "$SERVER_IP" ]; then
    echo ""
    print_status "Тестируем прямое подключение к IP: $SERVER_IP"
    if timeout 10 curl -s "http://$SERVER_IP/" > /dev/null 2>&1; then
        print_success "✅ Прямое подключение к IP работает"
    else
        print_error "❌ Прямое подключение к IP НЕ работает"
    fi
fi

# 8. Проверка из внешнего источника
echo ""
print_status "8. Проверка доступности извне..."
echo "Проверяем через внешний сервис: https://www.whatsmydns.net/"

# Тестируем с помощью nslookup из разных источников
print_status "DNS проверка с внешних серверов:"
echo "Google DNS (8.8.8.8):"
nslookup $DOMAIN 8.8.8.8 2>/dev/null | grep "Address:" | tail -n +2 || echo "Не резолвится"

echo "Cloudflare DNS (1.1.1.1):"
nslookup $DOMAIN 1.1.1.1 2>/dev/null | grep "Address:" | tail -n +2 || echo "Не резолвится"

# 9. Yandex Cloud Security Groups
echo ""
print_status "9. Проверка Yandex Cloud Security Groups..."

if command -v yc &> /dev/null; then
    print_success "✅ Yandex Cloud CLI доступен"
    
    echo ""
    echo "Текущие Security Groups:"
    yc vpc security-group list --format table 2>/dev/null || print_warning "Не удалось получить список"
    
    echo ""
    echo "Список VM и их Security Groups:"
    yc compute instance list --format table 2>/dev/null || print_warning "Не удалось получить список VM"
else
    print_warning "⚠️ Yandex Cloud CLI не установлен"
fi

# 10. Резюме и рекомендации
echo ""
echo "🎯 РЕЗЮМЕ И РЕКОМЕНДАЦИИ"
echo "================================"

if [ -n "$DNS_IP" ] && [ "$DNS_IP" = "$SERVER_IP" ]; then
    print_success "✅ DNS настроен правильно"
else
    print_error "❌ Проблема с DNS - исправьте настройки домена"
fi

if sudo systemctl is-active --quiet nginx && sudo nginx -t > /dev/null 2>&1; then
    print_success "✅ Nginx работает корректно"
else
    print_error "❌ Проблема с nginx - исправьте конфигурацию"
fi

if timeout 10 curl -s "http://$DOMAIN/" > /dev/null 2>&1; then
    print_success "✅ Домен доступен - SSL должен работать"
    echo ""
    echo "🚀 Можно запускать: ./scripts/setup-nginx-yandex.sh $DOMAIN"
else
    print_error "❌ Домен недоступен - нужно исправить проблемы"
    echo ""
    echo "🔧 Что нужно сделать:"
    echo "1. 🔥 Откройте порты 80/443 в Security Groups Yandex Cloud"
    echo "2. 🌐 Убедитесь что DNS указывает на IP $SERVER_IP"
    echo "3. 🛡️ Проверьте что firewall разрешает подключения"
    echo "4. ⚙️ Проверьте что nginx слушает на 0.0.0.0:80"
    echo ""
    echo "После исправления запустите диагностику снова:"
    echo "./scripts/diagnose-connectivity.sh $DOMAIN"
fi

echo ""
echo "🔗 Полезные ссылки:"
echo "• Yandex Cloud Console: https://console.cloud.yandex.ru/"
echo "• DNS checker: https://www.whatsmydns.net/"
echo "• SSL test: https://www.ssllabs.com/ssltest/"
echo "" 
