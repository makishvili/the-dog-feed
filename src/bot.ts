import { Telegraf, Scenes, session } from 'telegraf';
import * as dotenv from 'dotenv';
import { BotContext, BotState, DatabaseBotState } from './types';
import { TimerService } from './services/timer';
import { MainHandler } from './handlers/main';
import { DatabaseService } from './services/database';
import { mainScene, setGlobalServices, setGlobalDatabaseForMain } from './scenes/main';
import { setGlobalServicesForInterval } from './scenes/interval-settings';
import { todayHistoryScene, setGlobalDatabaseForTodayHistory } from './scenes/today-history';
import { feedingSuccessScene } from './scenes/feeding-success';
import { settingsScene } from './scenes/settings';
import { historyScene } from './scenes/history';
import { intervalSettingsScene } from './scenes/interval-settings';
import { foodSettingsScene, setGlobalDatabaseForFoodSettings } from './scenes/food-settings';
import { foodTypeSettingsScene, setGlobalDatabaseForFoodTypeSettings } from './scenes/food-type-settings';
import { foodAmountSettingsScene, setGlobalDatabaseForFoodAmountSettings } from './scenes/food-amount-settings';
import { feedingDetailsScene, setGlobalDatabaseForFeedingDetails } from './scenes/feeding-details';
import { notificationSettingsScene, setGlobalDatabaseForNotificationSettings } from './scenes/notification-settings';
import { fullHistoryScene } from './scenes/full-history';
import { exportScene } from './scenes/export';
import { scheduleFeedingScene, setGlobalSchedulerForScheduleFeeding, setGlobalDatabaseForScheduleFeeding } from './scenes/schedule-feeding';
import { scheduledListScene, setGlobalSchedulerForScheduledList } from './scenes/scheduled-list';
import { SchedulerService } from './services/scheduler';
import { SCENES } from './utils/constants';
import { TimeParser } from './services/parser';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

// Переменные для webhook
const NODE_ENV = process.env.NODE_ENV || 'development';
// ВРЕМЕННО: принудительно используем режим разработки для избежания проблем с webhook
const FORCE_DEVELOPMENT = true;
const EFFECTIVE_NODE_ENV = FORCE_DEVELOPMENT ? 'development' : NODE_ENV;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const PORT = parseInt(process.env.PORT || '3000');
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/webhook';

console.log(`Запуск в режиме: ${EFFECTIVE_NODE_ENV} (оригинальный: ${NODE_ENV})`);

// Создание бота
const bot = new Telegraf<BotContext>(BOT_TOKEN);

// Инициализация базы данных
const database = new DatabaseService();

// Глобальное состояние (для обратной совместимости)
const botState: BotState = {
  users: new Map(),
  feedings: [],
  nextFeedingId: 1,
  nextUserId: 1
};

// Новое состояние с базой данных
const databaseBotState: DatabaseBotState = {
  database,
  defaultFeedingInterval: 210 // 3.5 часа
};

// Инициализация сервисов
const timerService = new TimerService(bot, database);
const schedulerService = new SchedulerService(database, timerService);
const mainHandler = new MainHandler(timerService, database);

// Установка глобальных сервисов для сцен
setGlobalServices(timerService, database);
setGlobalServicesForInterval(timerService, database);
setGlobalDatabaseForMain(database);
setGlobalDatabaseForTodayHistory(database);
setGlobalDatabaseForFoodSettings(database);
setGlobalDatabaseForFoodTypeSettings(database);
setGlobalDatabaseForFoodAmountSettings(database);
setGlobalDatabaseForFeedingDetails(database);
setGlobalDatabaseForNotificationSettings(database);
setGlobalSchedulerForScheduleFeeding(schedulerService);
setGlobalDatabaseForScheduleFeeding(database);
setGlobalSchedulerForScheduledList(schedulerService);

// Настройка сцен
const stage = new Scenes.Stage<BotContext>([
  mainScene,
  feedingSuccessScene,
  feedingDetailsScene,
  settingsScene,
  historyScene,
  intervalSettingsScene,
  todayHistoryScene,
  foodSettingsScene,
  foodTypeSettingsScene,
  foodAmountSettingsScene,
  notificationSettingsScene,
  fullHistoryScene,
  exportScene,
  scheduleFeedingScene,
  scheduledListScene
]);

// Команда для проверки статистики уведомлений (для администрирования)
bot.command('notifications', async (ctx) => {
  try {
    const notificationService = timerService.getNotificationService();
    const stats = await notificationService.getNotificationStats();
    
    let message = `📊 Статистика уведомлений:\n\n` +
      `👥 Всего пользователей: ${stats.totalUsers}\n\n`;
    
    // Пользователи с включенными уведомлениями
    message += `🔔 Уведомления включены: ${stats.enabledUsers}\n`;
    if (stats.enabledUsersList.length > 0) {
      message += stats.enabledUsersList.map(name => `  • ${name}`).join('\n') + '\n';
    }
    message += '\n';
    
    // Пользователи с выключенными уведомлениями
    message += `🔕 Уведомления выключены: ${stats.disabledUsers}\n`;
    if (stats.disabledUsersList.length > 0) {
      message += stats.disabledUsersList.map(name => `  • ${name}`).join('\n');
    }
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка получения статистики уведомлений:', error);
    await ctx.reply('❌ Ошибка получения статистики');
  }
});

// Команда для проверки статистики планировщика (для администрирования)
bot.command('scheduler', async (ctx) => {
  try {
    const stats = await schedulerService.getSchedulerStats();
    
    let message = `📅 Статистика планировщика:\n\n` +
      `📊 Активных кормлений: ${stats.activeSchedules}\n` +
      `📈 Всего кормлений: ${stats.totalSchedules}\n` +
      `⏱️ Активных таймеров: ${stats.runningTimers}\n\n`;
    
    if (stats.nextSchedule) {
      message += `⏰ Следующее кормление:\n`;
      message += `  📅 ${stats.nextSchedule.scheduledTime.toLocaleString('ru-RU')}\n`;
      message += `  🆔 ID: ${stats.nextSchedule.id}\n`;
      
      const user = await database.getUserById(stats.nextSchedule.createdBy);
      message += `  👤 Создал: ${user?.username || 'Неизвестно'}\n`;
    } else {
      message += `⏰ Нет запланированных кормлений`;
    }
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка получения статистики планировщика:', error);
    await ctx.reply('❌ Ошибка получения статистики планировщика');
  }
});

// Middleware для сессий и сцен
bot.use(session());

// Middleware для установки database в контексте
bot.use((ctx, next) => {
  ctx.database = database;
  return next();
});

bot.use(stage.middleware());

// Команды, которые используют сцены (должны быть ПОСЛЕ middleware)
// Команда /start - переход к главной сцене
bot.start(async (ctx) => {
  try {
    // Создаем или получаем пользователя из базы данных
    let dbUser = await database.getUserByTelegramId(ctx.from.id);
    if (!dbUser) {
      dbUser = await database.createUser(
        ctx.from.id,
        ctx.from.username || ctx.from.first_name
      );
      console.log(`Новый пользователь создан в БД: ${dbUser.username || dbUser.telegramId}`);
    }
    
    console.log(`Пользователь ${dbUser.username || dbUser.telegramId} запустил бота`);
    ctx.scene.enter(SCENES.MAIN);
  } catch (error) {
    console.error('Ошибка при создании пользователя:', error);
    ctx.reply('Произошла ошибка при инициализации. Попробуйте позже.');
  }
});

// Команда для проверки статуса (обновленная для работы с БД)
bot.command('status', async (ctx) => {
  try {
    const nextFeeding = timerService.getNextFeedingInfo();
    const lastFeeding = await database.getLastFeeding();
    const nextScheduled = await schedulerService.getNextScheduledFeeding();
    
    let message = '📊 Статус кормления:\n\n';
    
    if (lastFeeding) {
      const lastUser = await database.getUserByTelegramId(ctx.from?.id || 0);
      message += `🍽️ Последнее кормление:\n`;
      message += `   Время: ${lastFeeding.timestamp.toLocaleString('ru-RU')}\n`;
      message += `   Кто: ${lastUser?.username || 'Неизвестно'}\n\n`;
    } else {
      message += `🍽️ Кормлений еще не было\n\n`;
    }
    
    message += `⏰ Интервал кормления: ${TimeParser.formatInterval(nextFeeding.intervalMinutes)}\n\n`;
    
    if (nextFeeding.isActive && nextFeeding.time) {
      message += `⏰ Следующее кормление: ${nextFeeding.time.toLocaleString('ru-RU')}\n`;
    } else {
      message += '⏹️ Кормления приостановлены\n';
    }

    // Добавляем информацию о запланированных кормлениях
    if (nextScheduled) {
      message += `\n📅 Запланированное кормление:\n`;
      message += `   Время: ${nextScheduled.scheduledTime.toLocaleString('ru-RU')}\n`;
      message += `   ID: ${nextScheduled.id}\n`;
      
      const scheduleUser = await database.getUserById(nextScheduled.createdBy);
      message += `   Создал: ${scheduleUser?.username || 'Неизвестно'}\n`;
    }

    // Добавляем статистику из БД
    const stats = await database.getStats();
    message += `\n📊 Статистика:\n`;
    message += `• Сегодня: ${stats.todayFeedings} кормлений\n`;
    message += `• Всего: ${stats.totalFeedings} кормлений`;
    
    ctx.reply(message);
  } catch (error) {
    console.error('Ошибка в команде /status:', error);
    ctx.reply('Ошибка при получении статуса. Попробуйте позже.');
  }
});

// Команда для возврата на главный экран
bot.command('home', (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('Ошибка бота:', err);
  ctx.reply('Произошла ошибка. Попробуйте еще раз или используйте /start');
});

// Graceful shutdown
process.once('SIGINT', async () => {
  console.log('Получен сигнал SIGINT, остановка бота...');
  timerService.stopAllTimers();
  schedulerService.cleanup();
  await database.close();
  bot.stop('SIGINT');
});

process.once('SIGTERM', async () => {
  console.log('Получен сигнал SIGTERM, остановка бота...');
  timerService.stopAllTimers();
  schedulerService.cleanup();
  await database.close();
  bot.stop('SIGTERM');
});

// Инициализация и запуск бота
async function startBot() {
  try {
    console.log('Инициализация базы данных...');
    await database.initialize();
    
    console.log('Инициализация планировщика...');
    await schedulerService.initialize();
    
    console.log('Запуск бота...');
    
    // Выбор режима запуска в зависимости от окружения
    if (EFFECTIVE_NODE_ENV === 'production') {
      // Режим webhook для продакшена
      if (!WEBHOOK_URL) {
        throw new Error('WEBHOOK_URL обязателен для продакшена');
      }
      
      console.log(`Запуск в режиме webhook:`);
      console.log(`  URL: ${WEBHOOK_URL}${WEBHOOK_PATH}`);
      console.log(`  Port: ${PORT}`);
      
      // Установка webhook
      await bot.telegram.setWebhook(`${WEBHOOK_URL}${WEBHOOK_PATH}`);
      
      // Запуск в режиме webhook
      await bot.launch({
        webhook: {
          domain: WEBHOOK_URL,
          path: WEBHOOK_PATH,
          port: PORT
        }
      });
      
      console.log('Бот запущен в режиме webhook!');
    } else {
      // Режим polling для разработки
      console.log('Запуск в режиме polling (разработка)...');
      
      // Удаляем webhook если он был установлен
      await bot.telegram.deleteWebhook();
      
      // Запуск в режиме polling
      await bot.launch();
      
      console.log('Бот запущен в режиме polling!');
    }
    
  } catch (error) {
    console.error('Ошибка при запуске бота:', error);
    process.exit(1);
  }
}

startBot();
