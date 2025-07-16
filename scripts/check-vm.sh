#!/bin/bash

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m'

echo -e "${BLUE}=== Диагностика VM и перенаправления ===${NC}"
echo ""

# Получаем информацию о VM
read -p "Введите имя вашей VM: " VM_NAME
echo ""

echo -e "${YELLOW}📋 Получаем информацию о VM...${NC}"
VM_INFO=$(yc compute instance get --name $VM_NAME --format json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ VM '$VM_NAME' не найдена${NC}"
    echo "Доступные VM:"
    yc compute instance list --format table
    exit 1
fi

# Извлекаем данные
VM_IP=$(echo $VM_INFO | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
VM_INTERNAL_IP=$(echo $VM_INFO | jq -r '.network_interfaces[0].primary_v4_address.address')
VM_STATUS=$(echo $VM_INFO | jq -r '.status')
VM_ZONE=$(echo $VM_INFO | jq -r '.zone_id')

echo -e "${GREEN}✅ VM найдена:${NC}"
echo "  Имя: $VM_NAME"
echo "  Статус: $VM_STATUS"
echo "  Зона: $VM_ZONE"
echo "  Внешний IP: $VM_IP"
echo "  Внутренний IP: $VM_INTERNAL_IP"
echo ""

# Проверяем статус VM
if [ "$VM_STATUS" != "RUNNING" ]; then
    echo -e "${RED}❌ VM не запущена! Статус: $VM_STATUS${NC}"
    read -p "Запустить VM? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}🔄 Запускаем VM...${NC}"
        yc compute instance start --name $VM_NAME
        echo "Ждем запуска (30 секунд)..."
        sleep 30
        VM_STATUS="RUNNING"
    else
        echo -e "${RED}VM должна быть запущена для тестирования${NC}"
        exit 1
    fi
fi

# Проверяем публичный IP
if [ "$VM_IP" = "null" ] || [ -z "$VM_IP" ]; then
    echo -e "${RED}❌ У VM нет публичного IP адреса${NC}"
    echo -e "${YELLOW}Это нужно исправить в настройках VM${NC}"
    exit 1
fi

echo -e "${BLUE}=== Тест 1: Проверка сетевой доступности ===${NC}"

# Ping тест
echo -n "🏓 Ping тест... "
if ping -c 3 -W 3 $VM_IP >/dev/null 2>&1; then
    echo -e "${GREEN}✅ VM отвечает на ping${NC}"
else
    echo -e "${RED}❌ VM не отвечает на ping${NC}"
    echo -e "${YELLOW}Возможные причины:${NC}"
    echo "  - Файрвол блокирует ICMP"
    echo "  - Проблемы с сетью"
fi

# Проверяем основные порты
echo ""
echo -e "${BLUE}=== Тест 2: Проверка портов ===${NC}"

check_port() {
    local port=$1
    local service=$2
    
    echo -n "🔌 Порт $port ($service)... "
    if timeout 5 bash -c "cat < /dev/null > /dev/tcp/$VM_IP/$port" 2>/dev/null; then
        echo -e "${GREEN}✅ Открыт${NC}"
        return 0
    else
        echo -e "${RED}❌ Закрыт${NC}"
        return 1
    fi
}

# Проверяем популярные порты
HTTP_OPEN=$(check_port 80 "HTTP")
HTTPS_OPEN=$(check_port 443 "HTTPS")
check_port 22 "SSH"
check_port 8080 "Alt HTTP"
check_port 3000 "Node.js"
check_port 8000 "Python"

echo ""
echo -e "${BLUE}=== Тест 3: HTTP проверка ===${NC}"

# Проверяем HTTP
echo -n "🌐 HTTP запрос к http://$VM_IP... "
HTTP_RESPONSE=$(curl -s -m 10 -w "STATUS:%{http_code}|TIME:%{time_total}" "http://$VM_IP" 2>/dev/null)

if [ $? -eq 0 ]; then
    STATUS=$(echo "$HTTP_RESPONSE" | grep -o "STATUS:[0-9]*" | cut -d: -f2)
    TIME=$(echo "$HTTP_RESPONSE" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
    CONTENT=$(echo "$HTTP_RESPONSE" | sed 's/STATUS:[0-9]*|TIME:[0-9.]*$//')
    
    if [ "$STATUS" = "200" ]; then
        echo -e "${GREEN}✅ HTTP $STATUS (${TIME}s)${NC}"
        echo -e "${GREEN}📄 Веб-сервер работает!${NC}"
        
        # Показываем первые строки контента
        if [ ! -z "$CONTENT" ]; then
            echo -e "${YELLOW}📋 Первые строки ответа:${NC}"
            echo "$CONTENT" | head -3
        fi
    else
        echo -e "${YELLOW}⚠️ HTTP $STATUS (${TIME}s)${NC}"
        echo -e "${YELLOW}Сервер отвечает, но не HTTP 200${NC}"
    fi
else
    echo -e "${RED}❌ Нет ответа${NC}"
    echo -e "${YELLOW}Возможные причины:${NC}"
    echo "  - Веб-сервер не установлен"
    echo "  - Веб-сервер не запущен"
    echo "  - Файрвол блокирует порт 80"
fi

echo ""
echo -e "${BLUE}=== Тест 4: GitHub Pages ===${NC}"

# Проверяем GitHub Pages
echo -n "🐙 GitHub Pages (https://your-domain.com)... "
GH_STATUS=$(curl -s -m 10 -w "%{http_code}" "https://your-domain.com" -o /dev/null)

if [ "$GH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Работает${NC}"
    
    # Проверяем содержимое на наличие IP
    GH_CONTENT=$(curl -s -m 10 "https://your-domain.com")
    if echo "$GH_CONTENT" | grep -q "$VM_IP"; then
        echo -e "${GREEN}✅ Перенаправление на $VM_IP настроено${NC}"
    else
        echo -e "${YELLOW}⚠️ Перенаправление на $VM_IP НЕ найдено${NC}"
    fi
else
    echo -e "${RED}❌ Не работает (HTTP $GH_STATUS)${NC}"
fi

echo ""
echo -e "${BLUE}=== Тест 5: Полный тест перенаправления ===${NC}"

echo -e "${YELLOW}🔄 Тестируем полную цепочку:${NC}"
echo "1. https://your-domain.com"
echo "2. ↓ перенаправление"
echo "3. http://$VM_IP"
echo ""

# Симуляция пользователя
echo -e "${YELLOW}Что увидит пользователь:${NC}"
echo "---"

if [ "$GH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Шаг 1: GitHub Pages загрузился${NC}"
    
    if [ "$HTTP_OPEN" = "0" ]; then
        echo -e "${GREEN}✅ Шаг 2: VM доступна по HTTP${NC}"
        echo -e "${GREEN}🎉 УСПЕХ: Полная цепочка работает!${NC}"
    else
        echo -e "${RED}❌ Шаг 2: VM недоступна по HTTP${NC}"
        echo -e "${YELLOW}Пользователь увидит ошибку подключения${NC}"
    fi
else
    echo -e "${RED}❌ Шаг 1: GitHub Pages не работает${NC}"
fi

echo ""
echo -e "${BLUE}=== Рекомендации ===${NC}"

if [ "$HTTP_OPEN" != "0" ]; then
    echo -e "${YELLOW}🔧 Нужно установить веб-сервер:${NC}"
    echo "ssh ubuntu@$VM_IP"
    echo "sudo apt update && sudo apt install -y nginx"
    echo "sudo systemctl start nginx"
    echo ""
fi

echo -e "${YELLOW}🧪 Команды для тестирования:${NC}"
echo "curl -I http://$VM_IP"
echo "curl -L -I https://your-domain.com"
echo "ping $VM_IP"
echo ""

echo -e "${YELLOW}📱 Тест в браузере:${NC}"
echo "1. Откройте: https://your-domain.com"
echo "2. Дождитесь перенаправления (3 сек)"
echo "3. Проверьте, что открылся: http://$VM_IP"

echo ""
echo -e "${GREEN}=== Диагностика завершена ===${NC}"
