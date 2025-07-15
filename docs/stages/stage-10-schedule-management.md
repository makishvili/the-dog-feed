# Этап 10: Управление кормлениями

## Цель этапа
Реализовать полное управление расписанием кормлений: отмену следующего кормления и создание кормлений на точное время с восстановлением таймеров после перезапуска.

## Результат этапа
Бот с функциональностью:
- Создание кормления на точное время
- Отмена следующего запланированного кормления
- Сохранение запланированных кормлений в БД
- Восстановление таймеров после перезапуска бота
- Управление множественными запланированными кормлениями
- Отображение всех запланированных кормлений

## Новые/измененные файлы

### 1. `src/services/scheduler.ts` (новый)
```typescript
import { Database } from '../database/db';
import { TimerService } from './timer';

export interface ScheduledFeeding {
  id: number;
  scheduledTime: Date;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export class SchedulerService {
  private database: Database;
  private timerService: TimerService;
  private scheduledTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(database: Database, timerService: TimerService) {
    this.database = database;
    this.timerService = timerService;
  }

  // Инициализация планировщика (восстановление таймеров после перезапуска)
  async initialize(): Promise<void> {
    try {
      const activeSchedules = await this.database.getActiveScheduledFeedings();
      
      for (const schedule of activeSchedules) {
        await this.restoreTimer(schedule);
      }

      console.log(`Восстановлено ${activeSchedules.length} запланированных кормлений`);
    } catch (error) {
      console.error('Ошибка инициализации планировщика:', error);
    }
  }

  // Создание запланированного кормления
  async scheduleFeeding(scheduledTime: Date, createdBy: number): Promise<ScheduledFeeding> {
    // Проверяем, что время в будущем
    if (scheduledTime <= new Date()) {
      throw new Error('Время кормления должно быть в будущем');
    }

    // Проверяем, что время не слишком далеко (максимум 7 дней)
    const maxTime = new Date();
    maxTime.setDate(maxTime.getDate() + 7);
    if (scheduledTime > maxTime) {
      throw new Error('Максимальный период планирования: 7 дней');
    }

    try {
      // Сохраняем в БД
      const schedule = await this.database.createScheduledFeeding(scheduledTime, createdBy);
      
      // Создаем таймер
      await this.createTimer(schedule);
      
      console.log(`Запланировано кормление на ${scheduledTime.toLocaleString('ru-RU')} пользователем ${createdBy}`);
      
      return schedule;
    } catch (error) {
      console.error('Ошибка создания запланированного кормления:', error);
      throw error;
    }
  }

  // Отмена запланированного кормления
  async cancelScheduledFeeding(scheduleId: number): Promise<void> {
    try {
      // Отменяем таймер
      const timer = this.scheduledTimers.get(scheduleId);
      if (timer) {
        clearTimeout(timer);
        this.scheduledTimers.delete(scheduleId);
      }

      // Деактивируем в БД
      await this.database.deactivateScheduledFeeding(scheduleId);
      
      console.log(`Отменено запланированное кормление ID: ${scheduleId}`);
    } catch (error) {
      console.error('Ошибка отмены запланированного кормления:', error);
      throw error;
    }
  }

  // Отмена всех активных запланированных кормлений
  async cancelAllScheduledFeedings(): Promise<number> {
    try {
      const activeSchedules = await this.database.getActiveScheduledFeedings();
      
      for (const schedule of activeSchedules) {
        await this.cancelScheduledFeeding(schedule.id);
      }

      console.log(`Отменено ${activeSchedules.length} запланированных кормлений`);
      return activeSchedules.length;
    } catch (error) {
      console.error('Ошибка отмены всех запланированных кормлений:', error);
      throw error;
    }
  }

  // Получение активных запланированных кормлений
  async getActiveScheduledFeedings(): Promise<ScheduledFeeding[]> {
    return await this.database.getActiveScheduledFeedings();
  }

  // Создание таймера для запланированного кормления
  private async createTimer(schedule: ScheduledFeeding): Promise<void> {
    const now = new Date();
    const delay = schedule.scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      // Время уже прошло, деактивируем
      await this.database.deactivateScheduledFeeding(schedule.id);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Отправляем напоминание о кормлении
        const notificationService = this.timerService.getNotificationService();
        const message = `🔔 Запланированное кормление!\n\nВремя: ${schedule.scheduledTime.toLocaleString('ru-RU')}\n\nПора покормить собаку!`;
        
        await notificationService.sendToAll(message);

        // Деактивируем выполненное кормление
        await this.database.deactivateScheduledFeeding(schedule.id);
        this.scheduledTimers.delete(schedule.id);

        console.log(`Выполнено запланированное кормление ID: ${schedule.id}`);
      } catch (error) {
        console.error('Ошибка выполнения запланированного кормления:', error);
      }
    }, delay);

    this.scheduledTimers.set(schedule.id, timer);
  }

  // Восстановление таймера после перезапуска
  private async restoreTimer(schedule: ScheduledFeeding): Promise<void> {
    const now = new Date();
    
    if (schedule.scheduledTime <= now) {
      // Время уже прошло, деактивируем
      await this.database.deactivateScheduledFeeding(schedule.id);
      return;
    }

    await this.createTimer(schedule);
  }

  // Очистка всех таймеров (при остановке бота)
  cleanup(): void {
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    console.log('Очищены все таймеры планировщика');
  }

  // Получение следующего запланированного кормления
  async getNextScheduledFeeding(): Promise<ScheduledFeeding | null> {
    const activeSchedules = await this.database.getActiveScheduledFeedings();
    
    if (activeSchedules.length === 0) {
      return null;
    }

    // Сортируем по времени и возвращаем ближайшее
    activeSchedules.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    return activeSchedules[0];
  }
}
```

### 2. Обновить `src/bot.ts` (финальная версия)
```typescript
import { Telegraf, Scenes, session } from 'telegraf';
import * as dotenv from 'dotenv';
import { Database } from './database/db';
import { TimerService } from './services/timer';
import { SchedulerService } from './services/scheduler';
import { MainHandler } from './handlers/main';
import { ExportService } from './services/export';

// Импорт всех сцен
import { mainScene } from './scenes/main';
import { feedingSuccessScene } from './scenes/feeding-success';
import { feedingDetailsScene } from './scenes/feeding-details';
import { settingsScene } from './scenes/settings';
import { historyScene } from './scenes/history';
import { todayHistoryScene } from './scenes/today-history';
import { allHistoryScene } from './scenes/all-history';
import { intervalSettingsScene } from './scenes/interval-settings';
import { foodSettingsScene } from './scenes/food-settings';
import { foodTypeSettingsScene } from './scenes/food-type-settings';
import { foodAmountSettingsScene } from './scenes/food-amount-settings';
import { notificationSettingsScene } from './scenes/notification-settings';
import { scheduleFeedingScene } from './scenes/schedule-feeding';
import { scheduledListScene } from './scenes/scheduled-list';

import { SCENES } from './utils/constants';
import { TimeParser } from './services/parser';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

async function startBot() {
  try {
    // Создание бота
    const bot = new Telegraf(BOT_TOKEN);

    // Инициализация БД
    const database = new Database();
    await database.initialize();

    // Инициализация сервисов
    const timerService = new TimerService(bot, database);
    const schedulerService = new SchedulerService(database, timerService);
    const mainHandler = new MainHandler(timerService, database);

    // Инициализация планировщика (восстановление таймеров)
    await schedulerService.initialize();

    // Настройка сцен
    const stage = new Scenes.Stage([
      mainScene,
      feedingSuccessScene,
      feedingDetailsScene,
      settingsScene,
      historyScene,
      todayHistoryScene,
      allHistoryScene,
      intervalSettingsScene,
      foodSettingsScene,
      foodTypeSettingsScene,
      foodAmountSettingsScene,
      notificationSettingsScene,
      scheduleFeedingScene,
      scheduledListScene
    ]);

    // Middleware
    bot.use(session());
    bot.use(stage.middleware());

    // Добавляем сервисы в контекст для доступа из сцен
    bot.use((ctx, next) => {
      ctx.timerService = timerService;
      ctx.database = database;
      ctx.schedulerService = schedulerService;
      return next();
    });

    // Команда /start - переход к главной сцене
    bot.start(async (ctx) => {
      try {
        const user = await database.getUserByTelegramId(ctx.from.id);
        if (!user) {
          await database.createUser(ctx.from.id, ctx.from.username || ctx.from.first_name);
        }
        
        console.log(`Пользователь ${ctx.from.username || ctx.from.id} запустил бота`);
        ctx.scene.enter(SCENES.MAIN);
      } catch (error) {
        console.error('Ошибка при запуске бота:', error);
        ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      }
    });

    // Глобальные обработчики кнопок
    bot.hears(/🍽️ Я покормил/, async (ctx) => {
      await mainHandler.handleFeeding(ctx);
    });

    bot.hears(/⏹️ Завершить кормления на сегодня/, async (ctx) => {
      await mainHandler.handleStopFeedings(ctx);
      ctx.scene.enter(SCENES.MAIN);
    });

    // Команда для проверки статуса
    bot.command('status', async (ctx) => {
      try {
        const nextFeeding = timerService.getNextFeedingInfo();
        const todayFeedings = await database.getTodayFeedings();
        const nextScheduled = await schedulerService.getNextScheduledFeeding();
        
        let message = '📊 Статус кормления:\n\n';
        
        message += `📅 Кормлений сегодня: ${todayFeedings.length}\n`;
        
        if (todayFeedings.length > 0) {
          const lastFeeding = todayFeedings[0];
          message += `🍽️ Последнее кормление:\n`;
          message += `   Время: ${lastFeeding.timestamp.toLocaleString('ru-RU')}\n`;
          message += `   Кто: ${lastFeeding.username || 'Неизвестно'}\n\n`;
        }
        
        message += `⏰ Интервал кормления: ${TimeParser.formatInterval(nextFeeding.intervalMinutes)}\n\n`;
        
        if (nextFeeding.isActive && nextFeeding.time) {
          message += `⏰ Следующее автоматическое: ${nextFeeding.time.toLocaleString('ru-RU')}\n`;
        } else {
          message += '⏹️ Автоматические кормления приостановлены\n';
        }

        if (nextScheduled) {
          message += `📅 Следующее запланированное: ${nextScheduled.scheduledTime.toLocaleString('ru-RU')}`;
        }
        
        ctx.reply(message);
      } catch (error) {
        console.error('Ошибка получения статуса:', error);
        ctx.reply('❌ Ошибка получения статуса');
      }
    });

    // Команда для возврата на главный экран
    bot.command('home', (ctx) => {
      ctx.scene.enter(SCENES.MAIN);
    });

    // Команда для проверки статистики уведомлений
    bot.command('notifications', async (ctx) => {
      try {
        const notificationService = timerService.getNotificationService();
        const stats = await notificationService.getNotificationStats();
        
        const message = `📊 Статистика уведомлений:\n\n` +
          `👥 Всего пользователей: ${stats.totalUsers}\n` +
          `🔔 Уведомления включены: ${stats.enabledUsers}\n` +
          `🔕 Уведомления выключены: ${stats.disabledUsers}`;
        
        ctx.reply(message);
      } catch (error) {
        console.error('Ошибка получения статистики уведомлений:', error);
        ctx.reply('❌ Ошибка получения статистики');
      }
    });

    // Периодическая очистка старых файлов экспорта (каждые 6 часов)
    setInterval(async () => {
      try {
        const exportService = new ExportService(database);
        const deletedCount = await exportService.cleanupOldExports(24);
        if (deletedCount > 0) {
          console.log(`Очищено ${deletedCount} старых файлов экспорта`);
        }
      } catch (error) {
        console.error('Ошибка очистки файлов экспорта:', error);
      }
    }, 6 * 60 * 60 * 1000); // 6 часов

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

    // Запуск бота
    console.log('Запуск бота...');
    await bot.launch();
    console.log('Бот запущен успешно!');

  } catch (error) {
    console.error('Ошибка запуска бота:', error);
    process.exit(1);
  }
}

// Запуск бота
startBot();
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Создание запланированного кормления**:
   - История → Сегодня → "Создать следующее кормление"
   - Ввести различные форматы времени:
     - "18:30" (сегодня)
     - "15.07.2024 18:30" (конкретная дата)
     - "через 2 часа" (относительное время)

2. **Просмотр запланированных кормлений**:
   - История → Сегодня → "Запланированные кормления"
   - Проверить отображение списка с временем до кормления

3. **Отмена кормлений**:
   - Отменить конкретное кормление
   - Отменить все кормления
   - Проверить уведомления всем пользователям

4. **Восстановление после перезапуска**:
   - Создать запланированное кормление
   - Перезапустить бота
   - Проверить, что таймер восстановился

5. **Выполнение запланированного кормления**:
   - Создать кормление на ближайшее время (через 1-2 минуты)
   - Дождаться срабатывания
   - Проверить уведомление и деактивацию

6. **Команда /status**:
   - Проверить отображение автоматических и запланированных кормлений

### Проверка БД:
```sql
SELECT * FROM scheduled_feedings ORDER BY scheduled_time;
SELECT * FROM scheduled_feedings WHERE is_active = 1;
```

### Тестирование парсера времени:
- "18:30" → сегодня в 18:30 (или завтра если время прошло)
- "15.07.2024 18:30" → конкретная дата
- "через 2 часа" → текущее время + 2 часа
- "через 30 минут" → текущее время + 30 минут

## Ограничения этапа
- Максимальный период планирования: 7 дней
- Нет повторяющихся кормлений
- Нет групповых операций с кормлениями
- Простая обработка часовых поясов

## Завершение разработки
Этап 10 завершает разработку полнофункционального телеграм-бота для кормления собаки. Все заявленные в техническом задании функции реализованы:

✅ **Основные функции**:
- Кнопка "Я покормил" с записью в БД
- Автоматические напоминания через настраиваемый интервал
- Завершение кормлений на сегодня
- Многопользовательская поддержка

✅ **Настройки**:
- Интервал кормления (1 мин - 24 часа)
- Тип корма (сухой/влажный)
- Количество корма (1-200г)
- Персональные уведомления

✅ **История и экспорт**:
- Просмотр кормлений за сегодня и все время
- Экспорт в CSV и HTML форматы
- Статистика кормлений

✅ **Управление расписанием**:
- Создание кормлений на точное время
- Отмена запланированных кормлений
- Восстановление таймеров после перезапуска

✅ **Дополнительные функции**:
- Уточнение деталей кормления
- Парсинг различных форматов ввода
- Персистентное хранение в SQLite
- Graceful shutdown и обработка ошибок

Бот готов к использованию и может быть развернут на любом сервере с Node.js.
