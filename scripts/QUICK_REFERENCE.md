# ⚡ Быстрая памятка - Dog Feeding Bot

Самые часто используемые команды для работы с ботом.

## 🚀 Первое развертывание

```bash
# 1. Развертывание бота
./scripts/deployment/deploy-yandex.sh

# 2. Настройка SSL (включая DuckDNS домены)
./scripts/deployment/setup-nginx-yandex.sh yourdomain.com

# 3. Проверка работы
./scripts/maintenance/status-yandex.sh
```

## 🔧 Повседневные команды

```bash
# Статус бота
./scripts/maintenance/status-yandex.sh

# Логи
./scripts/maintenance/logs-yandex.sh

# Обновление кода
./scripts/maintenance/update-yandex.sh

# Диагностика проблем
./scripts/maintenance/diagnose-connectivity.sh yourdomain.com
```

## 🚨 Экстренные ситуации

```bash
# Если бот не отвечает
ssh username@vm-ip "pm2 restart dog-feeding-bot"

# Если нужен полный сброс (ОСТОРОЖНО!)
./scripts/maintenance/reset-vm.sh
./scripts/deployment/deploy-yandex.sh
```

## 📱 Прямые SSH команды

```bash
# Замените username@vm-ip на ваши данные

# Статус процессов
ssh username@vm-ip "pm2 status"

# Логи в реальном времени
ssh username@vm-ip "pm2 logs dog-feeding-bot --lines 0"

# Перезапуск
ssh username@vm-ip "pm2 restart dog-feeding-bot"

# Остановка
ssh username@vm-ip "pm2 stop dog-feeding-bot"

# Запуск
ssh username@vm-ip "pm2 start dog-feeding-bot"

# Обновление кода вручную
ssh username@vm-ip "cd ~/dog-feeding-bot && git pull && npm install && npm run build && pm2 restart dog-feeding-bot"
```

## 🔍 Диагностика SSL проблем

```bash
# Проверка сертификата
ssh username@vm-ip "sudo certbot certificates"

# Ручное обновление SSL
ssh username@vm-ip "sudo certbot renew"

# Проверка nginx
ssh username@vm-ip "sudo nginx -t && sudo systemctl status nginx"

# Проверка портов
ssh username@vm-ip "sudo netstat -tlnp | grep ':80\|:443'"
```

## 📊 Мониторинг

```bash
# Системная информация
ssh username@vm-ip "df -h && free -h && uptime"

# Использование ресурсов ботом
ssh username@vm-ip "pm2 monit"

# Проверка webhook
curl -I https://yourdomain.com/webhook
```

## 🔧 Настройка нового домена

```bash
# 1. Обновить .env на VM
ssh username@vm-ip "nano ~/dog-feeding-bot/.env"

# 2. Настроить SSL для нового домена
./scripts/deployment/setup-nginx-yandex.sh newdomain.com

# 3. Перезапустить бота
ssh username@vm-ip "pm2 restart dog-feeding-bot"
```

## 🆘 Если ничего не работает

1. **Проверить статус:** `./scripts/maintenance/status-yandex.sh`
2. **Посмотреть логи:** `./scripts/maintenance/logs-yandex.sh`
3. **Диагностика:** `./scripts/maintenance/diagnose-connectivity.sh`
4. **Документация:** `docs/SSL_TROUBLESHOOTING.md`
5. **Крайний случай:** Полный пересброс и переразвертывание
