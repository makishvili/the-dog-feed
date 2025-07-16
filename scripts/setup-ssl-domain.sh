#!/bin/bash

# Полный автоматический скрипт настройки SSL домена
# Сохраните как setup-ssl-domain.sh

# Настройки
VM_NAME="my-vm"  # Замените на имя вашей VM
DOMAIN="makishvili"
FULL_DOMAIN="makishvili.duckdns.org"

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m'

echo -e "${BLUE}=== Полная настройка SSL домена ===${NC}"
echo ""
echo "Этот скрипт настроит:"
echo "1. Домен $FULL_DOMAIN"
echo "2. SSL сертификат от Let's Encrypt"
echo "3. Автоматическое обновление IP и SSL"
echo ""

read -p "Продолжить? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Проверяем зависимости
echo -e "${YELLOW}📋 Проверка зависимостей...${NC}"

if ! command -v yc &> /dev/null; then
    echo -e "${RED}❌ Yandex Cloud CLI не найден${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️ Установка jq...${NC}"
    sudo apt update && sudo apt install -y jq
fi

# Получаем информацию о VM
echo -e "${YELLOW}🔍 Получаем информацию о VM...${NC}"
VM_INFO=$(yc compute instance get --name $VM_NAME --format json 2>/dev/null)

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ VM '$VM_NAME' не найдена${NC}"
    echo "Доступные VM:"
    yc compute instance list --format table
    exit 1
fi

VM_IP=$(echo $VM_INFO | jq -r '.network_interfaces[0].primary_v4_address.one_to_one_nat.address')
VM_STATUS=$(echo $VM_INFO | jq -r '.status')

if [ "$VM_IP" = "null" ] || [ -z "$VM_IP" ]; then
    echo -e "${RED}❌ У VM нет публичного IP${NC}"
    exit 1
fi

echo -e "${GREEN}✅ VM найдена: $VM_NAME${NC}"
echo -e "${GREEN}✅ IP адрес: $VM_IP${NC}"
echo -e "${GREEN}✅ Статус: $VM_STATUS${NC}"

# Проверяем доступность VM
echo -e "${YELLOW}🏓 Проверяем доступность VM...${NC}"
if ping -c 1 -W 3 $VM_IP >/dev/null 2>&1; then
    echo -e "${GREEN}✅ VM доступна${NC}"
else
    echo -e "${RED}❌ VM недоступна${NC}"
    exit 1
fi

# Шаг 1: Инструкции по DuckDNS
echo ""
echo -e "${BLUE}=== Шаг 1: Регистрация домена на DuckDNS ===${NC}"
echo ""
echo "1. Откройте: https://duckdns.org"
echo "2. Войдите через Google/GitHub"
echo "3. В поле 'Sub Domain' введите: $DOMAIN"
echo "4. Нажмите 'add domain'"
echo "5. В поле 'current ip' введите: $VM_IP"
echo "6. Нажмите 'update ip'"
echo ""

read -p "Введите ваш DuckDNS токен: " DUCKDNS_TOKEN

if [ -z "$DUCKDNS_TOKEN" ]; then
    echo -e "${RED}❌ Токен не может быть пустым${NC}"
    exit 1
fi

# Проверяем и обновляем DuckDNS
echo -e "${YELLOW}🔄 Обновляем DuckDNS...${NC}"
DUCKDNS_RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=$DOMAIN&token=$DUCKDNS_TOKEN&ip=$VM_IP")

if [ "$DUCKDNS_RESPONSE" = "OK" ]; then
    echo -e "${GREEN}✅ DuckDNS обновлен успешно${NC}"
else
    echo -e "${RED}❌ Ошибка обновления DuckDNS: $DUCKDNS_RESPONSE${NC}"
    exit 1
fi

# Ждем распространения DNS
echo -e "${YELLOW}⏰ Ожидание распространения DNS (30 секунд)...${NC}"
sleep 30

# Проверяем DNS
echo -e "${YELLOW}🔍 Проверяем DNS...${NC}"
DNS_IP=$(dig +short $FULL_DOMAIN A)
if [ "$DNS_IP" = "$VM_IP" ]; then
    echo -e "${GREEN}✅ DNS настроен правильно${NC}"
else
    echo -e "${YELLOW}⚠️ DNS еще не обновился ($DNS_IP != $VM_IP)${NC}"
    echo "Продолжаем настройку..."
fi

# Шаг 2: Генерация скриптов для VM
echo ""
echo -e "${BLUE}=== Шаг 2: Создание скриптов для VM ===${NC}"

# Создаем скрипт установки веб-сервера
cat > vm-setup.sh << 'EOF'
#!/bin/bash

echo "=== Настройка веб-сервера на VM ==="

# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем необходимые пакеты
sudo apt install -y nginx certbot python3-certbot-nginx curl

# Запускаем и включаем Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

echo "✅ Веб-сервер установлен"
EOF

# Создаем скрипт настройки Nginx
cat > nginx-config.sh << EOF
#!/bin/bash

echo "=== Настройка Nginx ==="

# Создаем конфигурацию
sudo tee /etc/nginx/sites-available/$DOMAIN << 'NGINX_EOF'
server {
    listen 80;
    server_name $FULL_DOMAIN;
    
    root /var/www/html;
    index index.html index.htm;
    
    location / {
        try_files \$uri \$uri/ =404;
    }
    
    location ~ /.well-known/acme-challenge {
        allow all;
        root /var/www/html;
    }
}
NGINX_EOF

# Включаем сайт
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
sudo nginx -t

# Перезапускаем Nginx
sudo systemctl reload nginx

echo "✅ Nginx настроен"
EOF

# Создаем красивую веб-страницу
cat > create-page.sh << EOF
#!/bin/bash

echo "=== Создание веб-страницы ==="

sudo tee /var/www/html/index.html << 'HTML_EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Makishvili - Мое приложение</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            max-width: 800px; 
            padding: 50px;
            text-align: center;
        }
        .card { 
            background: rgba(255,255,255,0.1); 
            padding: 40px; 
            border-radius: 20px; 
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        h1 { 
            font-size: 3em; 
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .info { 
            font-size: 1.2em; 
            margin: 20px 0;
            opacity: 0.9;
        }
        .status { 
            background: rgba(76, 175, 80, 0.2);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .details { 
            margin-top: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            text-align: left;
        }
        .highlight { 
            color: #4CAF50;
            font-weight: bold;
        }
        .ssl-badge {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            display: inline-block;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <h1>🚀 Makishvili App</h1>
            <div class="ssl-badge">🔒 Защищено SSL</div>
            <p class="info">Добро пожаловать на мой безопасный сервер!</p>
            
            <div class="status">
                <strong>✅ Статус:</strong> Сервер работает с SSL
            </div>
            
            <div class="details">
                <h3>📋 Информация о сервере:</h3>
                <p><strong>Домен:</strong> <span class="highlight">$FULL_DOMAIN</span></p>
                <p><strong>Протокол:</strong> <span class="highlight">HTTPS</span></p>
                <p><strong>Сертификат:</strong> <span class="highlight">Let's Encrypt</span></p>
                <p><strong>Сервер:</strong> <span class="highlight">Nginx на Ubuntu</span></p>
                <p><strong>Хостинг:</strong> <span class="highlight">Yandex Cloud</span></p>
                <p><strong>IP:</strong> <span class="highlight">$VM_IP</span></p>
                <p><strong>Время:</strong> <span class="highlight" id="time"></span></p>
            </div>
            
            <div class="details" style="margin-top: 20px;">
                <h3>🔗 Ссылки:</h3>
                <p><a href="https://github.com/makishvili" style="color: #4CAF50;">GitHub Profile</a></p>
            </div>
        </div>
    </div>
    
    <script>
        function updateTime() {
            document.getElementById('time').textContent = new Date().toLocaleString('ru-RU');
        }
        updateTime();
        setInterval(updateTime, 1000);
        
        // Проверяем SSL
        if (location.protocol === 'https:') {
            console.log('✅ SSL активен');
        } else {
            console.log('⚠️ SSL не активен');
        }
    </script>
</body>
</html>
HTML_EOF

sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html

echo "✅ Веб-страница создана"
EOF

# Создаем скрипт для получения SSL
cat > ssl-setup.sh << EOF
#!/bin/bash

echo "=== Получение SSL сертификата ==="

# Получаем сертификат
sudo certbot --nginx -d $FULL_DOMAIN --non-interactive --agree-tos --email admin@$FULL_DOMAIN

if [ \$? -eq 0 ]; then
    echo "✅ SSL сертификат получен"
    
    # Настраиваем автообновление
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    echo "✅ Автообновление SSL настроено"
else
    echo "❌ Ошибка получения SSL сертификата"
    exit 1
fi
EOF

# Создаем скрипт для автообновления DuckDNS
cat > duckdns-setup.sh << EOF
#!/bin/bash

echo "=== Настройка автообновления DuckDNS ==="

# Создаем скрипт обновления
sudo tee /usr/local/bin/duckdns-update.sh << 'SCRIPT_EOF'
#!/bin/bash
DOMAIN="$DOMAIN"
TOKEN="$DUCKDNS_TOKEN"
LOG_FILE="/var/log/duckdns.log"

# Создаем лог файл если его нет
sudo touch \$LOG_FILE
sudo chmod 644 \$LOG_FILE

# Получаем текущий IP
CURRENT_IP=\$(curl -s --max-time 10 https://ipv4.icanhazip.com)

if [ -z "\$CURRENT_IP" ]; then
    echo "\$(date): Не удалось получить IP" >> \$LOG_FILE
    exit 1
fi

# Получаем IP из DNS
DNS_IP=\$(dig +short \$DOMAIN.duckdns.org A)

# Обновляем только если IP изменился
if [ "\$CURRENT_IP" != "\$DNS_IP" ]; then
    RESPONSE=\$(curl -s "https://www.duckdns.org/update?domains=\$DOMAIN&token=\$TOKEN&ip=\$CURRENT_IP")
    
    if [ "\$RESPONSE" = "OK" ]; then
        echo "\$(date): IP обновлен \$DNS_IP -> \$CURRENT_IP" >> \$LOG_FILE
    else
        echo "\$(date): Ошибка обновления: \$RESPONSE" >> \$LOG_FILE
    fi
else
    echo "\$(date): IP не изменился: \$CURRENT_IP" >> \$LOG_FILE
fi
SCRIPT_EOF

sudo chmod +x /usr/local/bin/duckdns-update.sh

# Добавляем в cron
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/duckdns-update.sh") | crontab -

# Запускаем первый раз
sudo /usr/local/bin/duckdns-update.sh

echo "✅ Автообновление DuckDNS настроено"
EOF

# Создаем мастер-скрипт
cat > setup-all.sh << 'EOF'
#!/bin/bash

echo "=== Полная настройка сервера ==="

# Выполняем все скрипты по порядку
./vm-setup.sh
./nginx-config.sh
./create-page.sh

# Ждем немного
sleep 10

./ssl-setup.sh
./duckdns-setup.sh

echo ""
echo "✅ Настройка сервера завершена!"
echo "Проверьте: https://makishvili.duckdns.org"
EOF

# Делаем скрипты исполняемыми
chmod +x *.sh

echo -e "${GREEN}✅ Скрипты для VM созданы${NC}"

# Шаг 3: Копирование и выполнение на VM
echo ""
echo -e "${BLUE}=== Шаг 3: Копирование скриптов на VM ===${NC}"

echo -e "${YELLOW}📤 Копируем скрипты на VM...${NC}"
scp -o StrictHostKeyChecking=no *.sh ubuntu@$VM_IP:~/

echo -e "${YELLOW}🔧 Выполняем настройку на VM...${NC}"
ssh -o StrictHostKeyChecking=no ubuntu@$VM_IP 'bash setup-all.sh'

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Настройка VM завершена${NC}"
else
    echo -e "${RED}❌ Ошибка настройки VM${NC}"
    exit 1
fi

# Шаг 4: Проверка настройки
echo ""
echo -e "${BLUE}=== Шаг 4: Проверка настройки ===${NC}"

echo -e "${YELLOW}🔍 Проверяем HTTPS...${NC}"
sleep 10

HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$FULL_DOMAIN)
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ HTTPS работает${NC}"
else
    echo -e "${YELLOW}⚠️ HTTPS статус: $HTTPS_STATUS${NC}"
fi

# Финальная проверка
echo ""
echo -e "${BLUE}=== Финальная проверка ===${NC}"
echo ""

echo -e "${GREEN}🎉 Настройка завершена!${NC}"
echo ""
echo "Ваши ссылки:"
echo "🔒 https://$FULL_DOMAIN - основное приложение с SSL"
echo ""

echo "Что настроено:"
echo "✅ Домен: $FULL_DOMAIN"
echo "✅ SSL сертификат от Let's Encrypt"
echo "✅ Автообновление IP в DuckDNS"
echo "✅ Автообновление SSL сертификата"
echo "✅ Красивая веб-страница"
echo ""

echo "Проверьте в браузере:"
echo "curl -I https://$FULL_DOMAIN"
echo ""

echo "Логи:"
echo "tail -f /var/log/duckdns.log  # на VM"
echo "sudo certbot certificates      # на VM"
echo ""

echo -e "${GREEN}✅ Полная настройка завершена успешно!${NC}"
