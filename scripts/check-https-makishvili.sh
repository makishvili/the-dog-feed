#!/bin/bash

DOMAIN="makishvili.duckdns.org"

echo "=== Проверка HTTPS для $DOMAIN ==="
echo ""

# Проверяем DNS
echo "1. DNS разрешение:"
DNS_IP=$(dig +short $DOMAIN A)
echo "   $DOMAIN → $DNS_IP"

# Проверяем HTTP
echo ""
echo "2. HTTP доступность:"
HTTP_STATUS=$(curl -s -m 10 -w "%{http_code}" "http://$DOMAIN" -o /dev/null)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "   ✅ HTTP работает (статус: $HTTP_STATUS)"
else
    echo "   ❌ HTTP не работает (статус: $HTTP_STATUS)"
fi

# Проверяем HTTPS
echo ""
echo "3. HTTPS доступность:"
HTTPS_STATUS=$(curl -s -m 10 -w "%{http_code}" "https://$DOMAIN" -o /dev/null 2>/dev/null)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo "   ✅ HTTPS работает (статус: $HTTPS_STATUS)"
    
    # Проверяем сертификат
    echo ""
    echo "4. Информация о SSL сертификате:"
    echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates
    
else
    echo "   ❌ HTTPS не работает (статус: $HTTPS_STATUS)"
    echo "   Нужно настроить SSL сертификат"
fi
