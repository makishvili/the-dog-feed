module.exports = {
  apps: [{
    name: 'dog-feeding-bot',
    script: 'dist/bot.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      // Укажите ваши переменные окружения здесь
      // BOT_TOKEN: 'your_token_here',
      // WEBHOOK_URL: 'https://yourdomain.com',
      // PORT: 8080
    },
    env_production: {
      NODE_ENV: 'production'
    },
    // Автоматический перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Логи
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}; 
