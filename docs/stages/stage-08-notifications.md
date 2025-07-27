# Этап 8: Управление уведомлениями

## Цель этапа
Реализовать персональные настройки уведомлений для каждого пользователя с возможностью включения/выключения.

## Результат этапа
Бот с функциональностью:
- Экран "Настройки уведомлений" с кнопками "Включить"/"Выключить"
- Персональные настройки для каждого пользователя
- Фильтрация получателей уведомлений на основе настроек
- Отображение текущего статуса уведомлений
- Сохранение настроек в БД

## Новые/измененные файлы

### 1. `src/scenes/notification-settings.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';

export const notificationSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.NOTIFICATION_SETTINGS);

// Вход в сцену настроек уведомлений
notificationSettingsScene.enter(async (ctx) => {
  try {
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    const statusText = user.notificationsEnabled ? 'Включены' : 'Выключены';
    const statusEmoji = user.notificationsEnabled ? '🔔' : '🔕';
    
    const message = `${statusEmoji} Настройки уведомлений\n\n` +
      `Текущий статус: ${statusText}\n\n` +
      `Уведомления включают:\n` +
      `• Сообщения о кормлении собаки\n` +
      `• Напоминания "Пора покормить!"\n` +
      `• Изменения настроек корма\n` +
      `• Остановку/возобновление кормлений\n\n` +
      `Выберите действие:`;

    const keyboard = user.notificationsEnabled 
      ? Markup.keyboard([
          ['🔕 Выключить уведомления'],
          ['⚙️ Настройки', '🏠 Главный экран']
        ]).resize()
      : Markup.keyboard([
          ['🔔 Включить уведомления'],
          ['⚙️ Настройки', '🏠 Главный экран']
        ]).resize();

    ctx.reply(message, keyboard);

  } catch (error) {
    console.error('Ошибка получения настроек уведомлений:', error);
    ctx.reply(
      '❌ Ошибка получения настроек. Попробуйте еще раз.',
      Markup.keyboard([['🏠 Главный экран']]).resize()
    );
  }
});

// Обработка кнопки "Включить уведомления"
notificationSettingsScene.hears(/🔔 Включить уведомления/, async (ctx) => {
  try {
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    await ctx.database.updateUserNotifications(user.id, true);

    const message = `🔔 Уведомления включены!\n\n` +
      `Теперь вы будете получать:\n` +
      `• Уведомления о кормлении\n` +
      `• Напоминания о времени кормления\n` +
      `• Изменения настроек\n\n` +
      `Настройки сохранены.`;

    ctx.reply(message);

    console.log(`Уведомления включены для пользователя: ${user.username || user.telegramId}`);
    
    // Обновляем экран через 2 секунды
    setTimeout(() => {
      ctx.scene.reenter();
    }, 2000);

  } catch (error) {
    console.error('Ошибка включения уведомлений:', error);
    ctx.reply('❌ Ошибка сохранения настроек');
  }
});

// Обработка кнопки "Выключить уведомления"
notificationSettingsScene.hears(/🔕 Выключить уведомления/, async (ctx) => {
  try {
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    await ctx.database.updateUserNotifications(user.id, false);

    const message = `🔕 Уведомления выключены!\n\n` +
      `Вы больше не будете получать:\n` +
      `• Уведомления о кормлении\n` +
      `• Напоминания о времени кормления\n` +
      `• Изменения настроек\n\n` +
      `Вы можете включить их обратно в любое время.\n` +
      `Настройки сохранены.`;

    ctx.reply(message);

    console.log(`Уведомления выключены для пользователя: ${user.username || user.telegramId}`);
    
    // Обновляем экран через 2 секунды
    setTimeout(() => {
      ctx.scene.reenter();
    }, 2000);

  } catch (error) {
    console.error('Ошибка выключения уведомлений:', error);
    ctx.reply('❌ Ошибка сохранения настроек');
  }
});

// Обработка кнопки "Настройки"
notificationSettingsScene.hears(/⚙️ Настройки/, (ctx) => {
  ctx.scene.enter(SCENES.SETTINGS);
});

// Обработка кнопки "Главный экран"
notificationSettingsScene.hears(/🏠 Главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
notificationSettingsScene.on('text', async (ctx) => {
  try {
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    const keyboard = user?.notificationsEnabled 
      ? Markup.keyboard([
          ['🔕 Выключить уведомления'],
          ['⚙️ Настройки', '🏠 Главный экран']
        ]).resize()
      : Markup.keyboard([
          ['🔔 Включить уведомления'],
          ['⚙️ Настройки', '🏠 Главный экран']
        ]).resize();

    ctx.reply('Используйте кнопки меню для навигации.', keyboard);
  } catch (error) {
    ctx.reply('Используйте кнопки меню для навигации.');
  }
});
```

### 2. `src/services/notifications.ts` (новый)
```typescript
import { Telegraf } from 'telegraf';
import { Database } from '../database/db';
import { User } from '../types';

export interface NotificationOptions {
  excludeUser?: number; // ID пользователя, которого нужно исключить
  onlyUser?: number;    // Отправить только конкретному пользователю
}

export class NotificationService {
  private bot: Telegraf;
  private database: Database;

  constructor(bot: Telegraf, database: Database) {
    this.bot = bot;
    this.database = database;
  }

  // Отправка уведомления всем пользователям с включенными уведомлениями
  async sendToAll(message: string, options: NotificationOptions = {}): Promise<void> {
    try {
      const users = await this.database.getAllUsers();
      const filteredUsers = this.filterUsers(users, options);

      const promises = filteredUsers.map(user => this.sendToUser(user, message));
      const results = await Promise.allSettled(promises);

      // Логирование результатов
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Уведомление отправлено: ${successful} успешно, ${failed} ошибок`);

      if (failed > 0) {
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => (r as PromiseRejectedResult).reason);
        console.error('Ошибки отправки уведомлений:', errors);
      }

    } catch (error) {
      console.error('Ошибка получения пользователей для уведомлений:', error);
    }
  }

  // Отправка уведомления конкретному пользователю
  async sendToUser(user: User, message: string): Promise<void> {
    if (!user.notificationsEnabled) {
      return; // Пользователь отключил уведомления
    }

    try {
      await this.bot.telegram.sendMessage(user.telegramId, message);
      console.log(`Уведомление отправлено пользователю: ${user.username || user.telegramId}`);
    } catch (error) {
      console.error(`Ошибка отправки уведомления пользователю ${user.telegramId}:`, error);
      throw error; // Пробрасываем ошибку для обработки в sendToAll
    }
  }

  // Фильтрация пользователей по опциям
  private filterUsers(users: User[], options: NotificationOptions): User[] {
    let filtered = users.filter(user => user.notificationsEnabled);

    if (options.onlyUser) {
      filtered = filtered.filter(user => user.id === options.onlyUser);
    }

    if (options.excludeUser) {
      filtered = filtered.filter(user => user.id !== options.excludeUser);
    }

    return filtered;
  }

  // Получение статистики уведомлений
  async getNotificationStats(): Promise<{
    totalUsers: number;
    enabledUsers: number;
    disabledUsers: number;
  }> {
    try {
      const users = await this.database.getAllUsers();
      const enabled = users.filter(u => u.notificationsEnabled).length;
      const disabled = users.filter(u => !u.notificationsEnabled).length;

      return {
        totalUsers: users.length,
        enabledUsers: enabled,
        disabledUsers: disabled
      };
    } catch (error) {
      console.error('Ошибка получения статистики уведомлений:', error);
      return { totalUsers: 0, enabledUsers: 0, disabledUsers: 0 };
    }
  }

  // Проверка, включены ли уведомления у пользователя
  async isUserNotificationsEnabled(telegramId: number): Promise<boolean> {
    try {
      const user = await this.database.getUserByTelegramId(telegramId);
      return user?.notificationsEnabled || false;
    } catch (error) {
      console.error('Ошибка проверки настроек уведомлений:', error);
      return false;
    }
  }
}
```

### 3. Обновить `src/scenes/settings.ts`
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getSettingsKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const settingsScene = new Scenes.BaseScene<BotContext>(SCENES.SETTINGS);

// Вход в сцену настроек
settingsScene.enter((ctx) => {
  ctx.reply(MESSAGES.SETTINGS_PLACEHOLDER, getSettingsKeyboard());
});

// Обработка кнопки "корм"
settingsScene.hears(/🍽️ корм/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_SETTINGS);
});

// Обработка кнопки "Настройки интервала кормления"
settingsScene.hears(/⏰ Настройки интервала кормления/, (ctx) => {
  ctx.scene.enter(SCENES.INTERVAL_SETTINGS);
});

// Обработка кнопки "Настройки уведомлений"
settingsScene.hears(/🔔 Настройки уведомлений/, (ctx) => {
  ctx.scene.enter(SCENES.NOTIFICATION_SETTINGS);
});

// Обработка кнопки "Выйти на главный экран"
settingsScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
settingsScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    getSettingsKeyboard()
  );
});
```

### 4. Обновить `src/services/timer.ts` (использовать NotificationService)
```typescript
import { Telegraf } from 'telegraf';
import { Database } from '../database/db';
import { NotificationService } from './notifications';
import { DEFAULT_FEEDING_INTERVAL_MINUTES } from '../utils/constants';

export interface TimerState {
  nextFeedingTime: Date | null;
  isActive: boolean;
  reminderInterval: NodeJS.Timeout | null;
  feedingTimeout: NodeJS.Timeout | null;
  currentIntervalMinutes: number;
}

export class TimerService {
  private bot: Telegraf;
  private database: Database;
  private notificationService: NotificationService;
  private timerState: TimerState;
  
  // Интервалы в миллисекундах
  private readonly REMINDER_INTERVAL = 10 * 60 * 1000; // 10 минут
  
  constructor(bot: Telegraf, database: Database) {
    this.bot = bot;
    this.database = database;
    this.notificationService = new NotificationService(bot, database);
    this.timerState = {
      nextFeedingTime: null,
      isActive: false,
      reminderInterval: null,
      feedingTimeout: null,
      currentIntervalMinutes: DEFAULT_FEEDING_INTERVAL_MINUTES
    };
  }
  
  // ... остальные методы остаются теми же, но используем notificationService ...

  // Отправка напоминания о кормлении
  private async sendFeedingReminder(): Promise<void> {
    if (!this.timerState.isActive) return;
    
    const message = '🔔 Пора покормить собаку!';
    await this.notificationService.sendToAll(message);
    
    console.log('Отправлено напоминание о кормлении');
    
    // Запуск повторных напоминаний
    this.startReminderInterval();
  }
  
  // Запуск повторных напоминаний каждые 10 минут
  private startReminderInterval(): void {
    this.timerState.reminderInterval = setInterval(async () => {
      if (!this.timerState.isActive) {
        this.clearReminderInterval();
        return;
      }
      
      const message = '🔔 Напоминание: собаку все еще нужно покормить!';
      await this.notificationService.sendToAll(message);
      
      console.log('Отправлено повторное напоминание');
    }, this.REMINDER_INTERVAL);
  }

  // Получить сервис уведомлений (для использования в других местах)
  getNotificationService(): NotificationService {
    return this.notificationService;
  }

  // ... остальные методы остаются теми же ...
}
```

### 5. Обновить `src/handlers/main.ts` (использовать NotificationService)
```typescript
import { Context } from 'telegraf';
import { User, Feeding } from '../types';
import { TimerService } from '../services/timer';
import { Database } from '../database/db';
import { MESSAGES, SCENES } from '../utils/constants';

export class MainHandler {
  private timerService: TimerService;
  private database: Database;

  constructor(timerService: TimerService, database: Database) {
    this.timerService = timerService;
    this.database = database;
  }

  // Обработка кнопки "Я покормил"
  async handleFeeding(ctx: Context): Promise<void> {
    try {
      const user = await this.getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username || ctx.from!.first_name
      );

      // Получаем текущие настройки корма из БД
      const foodType = await this.database.getSetting('default_food_type') || 'dry';
      const foodAmount = parseInt(await this.database.getSetting('default_food_amount') || '12');

      // Создание записи о кормлении в БД с текущими настройками
      const feeding = await this.database.createFeeding(user.id, foodType, foodAmount);

      // Сохраняем ID кормления в сессии для возможности уточнения деталей
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.lastFeedingId = feeding.id;

      // Запуск таймера на следующее кормление
      this.timerService.startFeedingTimer();

      // Форматирование информации о корме
      const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

      // Уведомление всех пользователей через NotificationService
      const message = `${MESSAGES.FEEDING_COMPLETED}\n` +
        `Время: ${feeding.timestamp.toLocaleString('ru-RU')}\n` +
        `Кто: ${user.username || 'Пользователь'}\n` +
        `Корм: ${foodInfo}\n\n` +
        `⏰ Следующее кормление через ${Math.round(this.timerService.getCurrentInterval() / 60)} часов`;

      const notificationService = this.timerService.getNotificationService();
      await notificationService.sendToAll(message);

      console.log(`Кормление записано: ${user.username} в ${feeding.timestamp}, ${foodInfo}`);

      // Переход к сцене успешного кормления
      await ctx.scene.enter(SCENES.FEEDING_SUCCESS);

    } catch (error) {
      console.error('Ошибка обработки кормления:', error);
      ctx.reply('❌ Произошла ошибка при записи кормления. Попробуйте еще раз.');
    }
  }

  // Обработка кнопки "Завершить кормления на сегодня"
  async handleStopFeedings(ctx: Context): Promise<void> {
    try {
      const user = await this.getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username || ctx.from!.first_name
      );

      this.timerService.stopAllTimers();

      const message = `${MESSAGES.FEEDINGS_STOPPED}\n` +
        `Инициатор: ${user.username || 'Пользователь'}\n\n` +
        `Чтобы возобновить кормления, нажмите "🍽️ Собачка поел"`;

      // Уведомление всех пользователей через NotificationService
      const notificationService = this.timerService.getNotificationService();
      await notificationService.sendToAll(message);

      console.log(`Кормления остановлены пользователем: ${user.username}`);

    } catch (error) {
      console.error('Ошибка остановки кормлений:', error);
      ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
    }
  }

  // Получение или создание пользователя
  private async getOrCreateUser(telegramId: number, username?: string): Promise<User> {
    let user = await this.database.getUserByTelegramId(telegramId);

    if (!user) {
      user = await this.database.createUser(telegramId, username);
      console.log(`Новый пользователь создан: ${username || telegramId}`);
    }

    return user;
  }
}
```

### 6. Обновить `src/utils/constants.ts`
```typescript
// ... предыдущий код ...

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  FEEDING_DETAILS: 'feeding_details',
  SETTINGS: 'settings',
  HISTORY: 'history',
  TODAY_HISTORY: 'today_history',
  INTERVAL_SETTINGS: 'interval_settings',
  FOOD_SETTINGS: 'food_settings',
  NOTIFICATION_SETTINGS: 'notification_settings'
};
```

### 7. Обновить `src/bot.ts` (добавить новую сцену)
```typescript
// ... импорты ...
import { notificationSettingsScene } from './scenes/notification-settings';

// ... остальной код ...

// Настройка сцен
const stage = new Scenes.Stage([
  mainScene,
  feedingSuccessScene,
  feedingDetailsScene,
  settingsScene,
  historyScene,
  todayHistoryScene,
  intervalSettingsScene,
  foodSettingsScene,
  foodTypeSettingsScene,
  foodAmountSettingsScene,
  notificationSettingsScene
]);

// ... остальной код ...

// Команда для проверки статистики уведомлений (для администрирования)
bot.command('notifications', async (ctx) => {
  try {
    const timerService = ctx.timerService;
    if (!timerService) return;

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

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Доступ к настройкам уведомлений**:
   - Главный экран → Настройки → Настройки уведомлений
   - Проверить отображение текущего статуса

2. **Выключение уведомлений**:
   - Нажать "Выключить уведомления"
   - Проверить сохранение в БД
   - Проверить изменение интерфейса

3. **Включение уведомлений**:
   - Нажать "Включить уведомления"
   - Проверить сохранение в БД
   - Проверить изменение интерфейса

4. **Фильтрация уведомлений**:
   - Выключить уведомления у одного пользователя
   - Покормить собаку другим пользователем
   - Проверить, что первый пользователь не получил уведомление

5. **Различные типы уведомлений**:
   - Кормление собаки
   - Напоминания о кормлении
   - Изменения настроек корма
   - Остановка кормлений

6. **Команда /notifications**:
   - Проверить статистику включенных/выключенных уведомлений

### Проверка БД:
```sql
SELECT telegram_id, username, notifications_enabled 
FROM users 
ORDER BY notifications_enabled DESC;
```

## Ограничения этапа
- Нет экспорта истории
- Нет создания кормлений на точное время
- Нет групповых настроек уведомлений
- Простая обработка ошибок отправки

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 9: добавление просмотра всей истории кормлений и экспорта данных в CSV и HTML форматы.
