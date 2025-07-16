#!/bin/bash

DOMAIN="makishvili.ru"

echo "=== Анализ DNS записей для $DOMAIN ==="
echo ""

# Функция для красивого вывода
print_section() {
    echo -e "\033[1;34m=== $1 ===\033[0m"
}

print_ok() {
    echo -e "\033[0;32m✅ $1\033[0m"
}

print_warning() {
    echo -e "\033[1;33m⚠️  $1\033[0m"
}

print_error() {
    echo -e "\033[0;31m❌ $1\033[0m"
}

# Проверяем A-записи
print_section "A-записи (IP адреса)"
MAIN_IP=$(dig +short $DOMAIN A)
WWW_IP=$(dig +short www.$DOMAIN A)

echo "makishvili.ru → $MAIN_IP"
echo "www.makishvili.ru → $WWW_IP"

if [ ! -z "$MAIN_IP" ]; then
    print_ok "Основной домен настроен"
else
    print_error "Основной домен не найден"
fi

echo ""

# Проверяем CNAME
print_section "CNAME-записи"
WWW_CNAME=$(dig +short www.$DOMAIN CNAME)
if [ ! -z "$WWW_CNAME" ]; then
    echo "www.makishvili.ru → $WWW_CNAME (CNAME)"
else
    echo "www.makishvili.ru → прямая A-запись или не настроено"
fi

echo ""

# Проверяем NS серверы
print_section "NS-серверы (кто управляет DNS)"
NS_SERVERS=$(dig +short $DOMAIN NS)
echo "$NS_SERVERS"

# Определяем провайдера DNS
if echo "$NS_SERVERS" | grep -q "yandexcloud.net"; then
    print_ok "DNS управляется Yandex Cloud"
    DNS_PROVIDER="Yandex Cloud"
elif echo "$NS_SERVERS" | grep -q "cloudflare"; then
    print_warning "DNS управляется Cloudflare"
    DNS_PROVIDER="Cloudflare"
elif echo "$NS_SERVERS" | grep -q "reg.ru"; then
    print_warning "DNS управляется REG.RU"
    DNS_PROVIDER="REG.RU"
elif echo "$NS_SERVERS" | grep -q "timeweb"; then
    print_warning "DNS управляется Timeweb"
    DNS_PROVIDER="Timeweb"
else
    print_warning "DNS управляется другим провайдером"
    DNS_PROVIDER="Неизвестно"
fi

echo ""

# Проверяем MX записи (почта)
print_section "MX-записи (почта)"
MX_RECORDS=$(dig +short $DOMAIN MX)
if [ ! -z "$MX_RECORDS" ]; then
    echo "$MX_RECORDS"
    print_warning "Настроена почта - будьте осторожны с изменениями DNS"
else
    echo "Нет MX записей"
fi

echo ""

# Проверяем TXT записи
print_section "TXT-записи"
TXT_RECORDS=$(dig +short $DOMAIN TXT)
if [ ! -z "$TXT_RECORDS" ]; then
    echo "$TXT_RECORDS"
    if echo "$TXT_RECORDS" | grep -q "spf1"; then
        print_warning "Найдены SPF записи для почты"
    fi
    if echo "$TXT_RECORDS" | grep -q "dkim"; then
        print_warning "Найдены DKIM записи для почты"
    fi
else
    echo "Нет TXT записей"
fi

echo ""

# Проверяем доступность сайта
print_section "Проверка доступности сайта"

# HTTP проверка
echo -n "HTTP makishvili.ru: "
HTTP_STATUS=$(curl -s -I "http://$DOMAIN" 2>/dev/null | head -1)
if [ $? -eq 0 ]; then
    print_ok "ДОСТУПЕН - $HTTP_STATUS"
else
    print_error "НЕ ДОСТУПЕН"
fi

# HTTPS проверка
echo -n "HTTPS makishvili.ru: "
HTTPS_STATUS=$(curl -s -I "https://$DOMAIN" 2>/dev/null | head -1)
if [ $? -eq 0 ]; then
    print_ok "ДОСТУПЕН - $HTTPS_STATUS"
    
    # Проверяем SSL сертификат
    SSL_INFO=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null)
    if [ $? -eq 0 ]; then
        print_ok "SSL сертификат активен"
    fi
else
    print_error "НЕ ДОСТУПЕН"
fi

echo ""

# Информация о хостинге
print_section "Информация о хостинге"
if [ ! -z "$MAIN_IP" ]; then
    echo "IP адрес: $MAIN_IP"
    
    # Определяем провайдера хостинга
    WHOIS_INFO=$(whois $MAIN_IP 2>/dev/null)
    if echo "$WHOIS_INFO" | grep -qi "yandex"; then
        print_ok "Сервер размещен в Yandex Cloud"
        HOSTING_PROVIDER="Yandex Cloud"
    elif echo "$WHOIS_INFO" | grep -qi "selectel"; then
        print_warning "Сервер размещен в Selectel"
        HOSTING_PROVIDER="Selectel"
    elif echo "$WHOIS_INFO" | grep -qi "timeweb"; then
        print_warning "Сервер размещен в Timeweb"
        HOSTING_PROVIDER="Timeweb"
    else
        ORG_NAME=$(echo "$WHOIS_INFO" | grep -i "orgname\|org-name\|organization" | head -1)
        if [ ! -z "$ORG_NAME" ]; then
            print_warning "Провайдер: $ORG_NAME"
            HOSTING_PROVIDER="$ORG_NAME"
        else
            HOSTING_PROVIDER="Неизвестно"
        fi
    fi
fi

echo ""

# Проверяем поддомены
print_section "Проверка популярных поддоменов"
SUBDOMAINS=("api" "admin" "blog" "shop" "app" "dashboard" "panel")

for sub in "${SUBDOMAINS[@]}"; do
    SUB_IP=$(dig +short $sub.$DOMAIN A)
    if [ ! -z "$SUB_IP" ]; then
        echo "$sub.$DOMAIN → $SUB_IP"
    fi
done

echo ""

# Итоговый анализ
print_section "ИТОГОВЫЙ АНАЛИЗ"
echo "Провайдер DNS: $DNS_PROVIDER"
echo "Провайдер хостинга: $HOSTING_PROVIDER"

if [ "$DNS_PROVIDER" = "Yandex Cloud" ]; then
    print_ok "DNS уже в Yandex Cloud - можно безопасно добавлять записи"
    echo "Команда для добавления поддомена:"
    echo "yc dns zone add-records --name <zone-name> --record \"vm.makishvili.ru. 300 A <your-vm-ip>\""
else
    print_warning "DNS НЕ в Yandex Cloud - требуется осторожность"
    echo ""
    echo "Рекомендации:"
    echo "1. Используйте поддомен (vm.makishvili.ru)"
    echo "2. Добавьте запись в панели $DNS_PROVIDER"
    echo "3. Или мигрируйте DNS в Yandex Cloud (с осторожностью)"
fi

# Проверяем, есть ли зона в Yandex Cloud
echo ""
print_section "Проверка зоны в Yandex Cloud"
YC_ZONE=$(yc dns zone list --format json 2>/dev/null | jq -r ".[] | select(.zone==\"makishvili.ru.\") | .name" 2>/dev/null)

if [ ! -z "$YC_ZONE" ]; then
    print_ok "Зона найдена в Yandex Cloud: $YC_ZONE"
    echo "Текущие записи в зоне:"
    yc dns zone list-records --name $YC_ZONE
else
    print_warning "Зона НЕ найдена в Yandex Cloud"
fi

echo ""
echo "=== Проверка завершена ==="
