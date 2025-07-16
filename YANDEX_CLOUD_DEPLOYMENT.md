# Развертывание в Yandex Cloud

## Вариант 1: Yandex Compute Cloud (Виртуальная машина)

### Шаг 1: Создание виртуальной машины

1. Войдите в [Yandex Cloud Console](https://console.cloud.yandex.ru/)
2. Создайте новую VM в Compute Cloud:
   - **Зона доступности**: `ru-central1-a`
   - **Образ**: Ubuntu 22.04 LTS
   - **vCPU**: 2
   - **RAM**: 2 GB
   - **Диск**: 20 GB SSD
   - **Сеть**: Создайте или выберите существующую
   - **Публичный IP**: Назначить автоматически

### Шаг 2: Подключение к VM

```bash
# Подключение по SSH
ssh yc-user@YOUR_VM_PUBLIC_IP

# Или используйте SSH ключ
ssh -i ~/.ssh/your_private_key yc-user@YOUR_VM_PUBLIC_IP
```

### Шаг 3: Настройка окружения

Выполните команды вручную:

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка дополнительных пакетов
sudo apt install -y git build-essential python3
```

### Шаг 4: Развертывание приложения

```bash
# Клонирование репозитория
git clone YOUR_REPOSITORY_URL ~/dog-feeding-bot
cd ~/dog-feeding-bot

# Установка зависимостей
npm install

# Создание .env файла
cp env.example .env
nano .env
```

Настройте `.env` файл:
```env
BOT_TOKEN=your_telegram_bot_token
NODE_ENV=production
WEBHOOK_URL=https://YOUR_VM_PUBLIC_IP
PORT=3000
```

```bash
# Сборка проекта
npm run build

# Запуск через PM2
pm2 start ecosystem.yandex.config.js

# Сохранение конфигурации PM2
pm2 save

# Автозапуск PM2 при перезагрузке системы
pm2 startup
# Выполните команду, которую выведет pm2 startup
```

### Шаг 5: Настройка файрвола (по желанию)

```bash
# Установка ufw
sudo apt install ufw

# Разрешение SSH
sudo ufw allow ssh

# Разрешение порта для webhook
sudo ufw allow 3000

# Включение файрвола
sudo ufw enable
```

### Шаг 6: Настройка webhook в Telegram

Выполните запрос для установки webhook:
```bash
curl -X POST \
  "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR_VM_PUBLIC_IP:3000/webhook"}'
```

### Мониторинг

```bash
# Просмотр логов
pm2 logs

# Статус процессов
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Перезапуск бота
pm2 restart dog-feeding-bot
```

## Вариант 2: Yandex Cloud Functions (Serverless)

### Ограничения Cloud Functions:
- Максимальное время выполнения функции: 10 минут
- Не подходит для long-polling
- Подходит только для webhook режима
- Ограниченная файловая система (только `/tmp`)

### Настройка для Cloud Functions:

1. Создайте функцию в Yandex Cloud Functions
2. Загрузите код как ZIP архив
3. Установите переменные окружения:
   - `BOT_TOKEN`: ваш токен бота
   - `NODE_ENV`: production
   - `WEBHOOK_URL`: URL вашей функции

### Особенности для Cloud Functions:

```javascript
// Для Cloud Functions нужен специальный обработчик
exports.handler = async (event, context) => {
  // Ваш код бота здесь
  // Обработка webhook запросов
};
```

## Обновление приложения

### Автоматическое обновление с GitHub:

```bash
# Настройка автодеплоя через PM2
pm2 deploy ecosystem.yandex.config.js production setup
pm2 deploy ecosystem.yandex.config.js production
```

### Ручное обновление:

```bash
cd ~/dog-feeding-bot
git pull origin main
npm install
npm run build
pm2 restart dog-feeding-bot
```

## Резервное копирование

### База данных:

```bash
# Создание бэкапа SQLite базы
cp dog_feeding.db ~/backups/dog_feeding_$(date +%Y%m%d_%H%M%S).db

# Автоматическое резервное копирование (cron)
echo "0 2 * * * cp ~/dog-feeding-bot/dog_feeding.db ~/backups/dog_feeding_\$(date +\%Y\%m\%d_\%H\%M\%S).db" | crontab -
```

## Полезные команды

```bash
# Просмотр использования ресурсов
htop
df -h
free -h

# Просмотр портов
netstat -tlnp | grep :3000

# Проверка работы бота
curl -X POST http://localhost:3000/webhook

# Просмотр системных логов
journalctl -u your-service-name -f
```

## Устранение неполадок

### Бот не отвечает:
1. Проверьте статус PM2: `pm2 status`
2. Проверьте логи: `pm2 logs`
3. Проверьте доступность порта: `curl localhost:3000/webhook`
4. Проверьте webhook в Telegram: вызовите `getWebhookInfo`

### Проблемы с SSL:
Если нужен HTTPS, используйте автоматический скрипт настройки nginx с SSL:
```bash
# Скопируйте файлы на VM
scp scripts/setup-nginx-yandex.sh yc-user@YOUR_VM_IP:~/
scp nginx.yandex.conf yc-user@YOUR_VM_IP:~/

# Запустите автоматическую настройку
ssh yc-user@YOUR_VM_IP
./setup-nginx-yandex.sh yourdomain.com
```

Или настройте вручную:
```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
``` 
