module.exports = {
  apps: [{
    name: 'dog-feeding-bot',
    script: 'dist/bot.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Переменные окружения для Yandex Cloud
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      // Эти переменные нужно установить через PM2 или в .env файле
      // BOT_TOKEN: 'your_telegram_bot_token',
      // WEBHOOK_URL: 'https://your-vm-ip-or-domain.com',
    },
    
    // Настройки автоперезапуска
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 4000,
    
    // Настройки логов - используем домашнюю директорию текущего пользователя
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Количество попыток перезапуска
    max_restarts: 10,
    min_uptime: '10s',
    
    // Переменные для мониторинга
    pmx: true,
    
    // Настройки для кластера (если нужно)
    kill_timeout: 5000,
    listen_timeout: 8000,
    
    // Дополнительные настройки для стабильности
    source_map_support: true,
    instance_var: 'INSTANCE_ID'
  }],
  
  // Настройки деплоя (опционально)
  deploy: {
    production: {
      user: 'yc-user',
      host: 'your-vm-ip',
      ref: 'origin/main',
      repo: 'git@github.com:your-username/your-repo.git',
      path: '/home/yc-user/dog-feeding-bot',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.yandex.config.js --env production && pm2 save'
    }
  }
}; 
