# 🚀 Быстрое развертывание в Yandex Cloud

## ⚡ Экспресс-установка (10 минут)

### 1. Создайте VM в Yandex Cloud
- Ubuntu 22.04 LTS
- 2 vCPU, 2GB RAM
- Публичный IP

### 2. Подключитесь к VM
```bash
ssh yc-user@YOUR_VM_IP
```

### 3. Одной командой установите всё
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
sudo apt-get install -y nodejs git build-essential python3 && \
sudo npm install -g pm2
```

### 4. Клонируйте и настройте проект
```bash
git clone YOUR_REPO_URL ~/dog-feeding-bot
cd ~/dog-feeding-bot
npm install
cp env.example .env
```

### 5. Настройте .env
```bash
nano .env
```
```env
BOT_TOKEN=your_telegram_bot_token
NODE_ENV=production
WEBHOOK_URL=https://YOUR_VM_IP
PORT=3000
```

### 6. Запустите бота
```bash
npm run yc:deploy
```

### 7. Настройте автозапуск
```bash
pm2 startup
# Выполните команду, которую выведет PM2
```

## ✅ Проверка работы

```bash
# Статус бота
npm run yc:status

# Логи
npm run yc:logs

# Проверка порта
curl http://localhost:3000/webhook
```

## 🔄 Обновление

```bash
cd ~/dog-feeding-bot
npm run yc:update
```

## 📋 Полезные команды

| Команда | Описание |
|---------|----------|
| `npm run yc:deploy` | Развертывание |
| `npm run yc:update` | Обновление |
| `npm run yc:status` | Статус |
| `npm run yc:logs` | Логи |
| `pm2 restart dog-feeding-bot` | Перезапуск |
| `pm2 stop dog-feeding-bot` | Остановка |

## 🌐 Настройка домена (опционально)

### Если у вас есть домен:

1. **Направьте A-запись домена на IP VM**

2. **Установите nginx и SSL:**
```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp nginx.yandex.conf /etc/nginx/sites-available/dog-feeding-bot
sudo ln -s /etc/nginx/sites-available/dog-feeding-bot /etc/nginx/sites-enabled/
```

3. **Отредактируйте конфиг:**
```bash
sudo nano /etc/nginx/sites-available/dog-feeding-bot
# Замените your-domain.com на ваш домен
```

4. **Получите SSL сертификат:**
```bash
sudo certbot --nginx -d yourdomain.com
sudo systemctl reload nginx
```

5. **Обновите .env:**
```env
WEBHOOK_URL=https://yourdomain.com
```

6. **Перезапустите бота:**
```bash
npm run yc:update
```

## 🛟 Быстрое решение проблем

### Бот не отвечает:
```bash
pm2 restart dog-feeding-bot
pm2 logs --lines 50
```

### Webhook не работает:
```bash
# Проверьте, что порт открыт
sudo ufw allow 3000

# Проверьте настройки webhook
curl -X POST "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### База данных заблокирована:
```bash
# Остановите бота, подождите, запустите снова
pm2 stop dog-feeding-bot
sleep 5
pm2 start dog-feeding-bot
```

## 💰 Стоимость

**~800₽/месяц** за VM + IP + диск

Бесплатно первые 30 дней при регистрации!

---

**💡 Совет:** Сохраните IP адрес VM и учетные данные для SSH в надежном месте! 
