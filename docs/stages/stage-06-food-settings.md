# Этап 6: корм

## Цель этапа
Реализовать настройки типа и количества корма с сохранением в базе данных. Настройки применяются глобально для всех пользователей.

## Результат этапа
Бот с функциональностью:
- Экран "корм" с возможностью ввода типа и количества корма
- Поддержка различных форматов ввода типа и количества корма
- Сохранение настроек в БД (глобально для всех пользователей)
- Применение настроек к новым кормлениям
- Отображение текущих настроек
- Поясняющий текст с примерами форматов

## Новые/измененные файлы

### 1. `src/scenes/food-settings.ts` (обновленный)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { FeedingParser } from '../services/feeding-parser';
import { SCENES } from '../utils/constants';

export const foodSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_SETTINGS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFoodSettings(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену настроек корма
foodSettingsScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    // Получаем текущие настройки из БД
    const currentType = await globalDatabase.getSetting('default_food_type') || 'dry';
    const currentAmount = await globalDatabase.getSetting('default_food_amount') || '12';
    
    const typeText = currentType === 'dry' ? 'Сухой' : 'Влажный';
    
    const message = `🍽️ корм\n\n` +
      `Текущие настройки:\n` +
      `• Тип корма: ${typeText}\n` +
      `• Количество: ${currentAmount} граммов\n\n` +
      `Введите новые настройки корма:\n\n` +
      `Примеры форматов:\n` +
      FeedingParser.getExamples().map(example => `• ${example}`).join('\n');

    ctx.reply(message, Markup.keyboard([
      ['🏠 На главную']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения настроек корма:', error);
    ctx.reply(
      '❌ Ошибка получения настроек. Попробуйте еще раз.',
      Markup.keyboard([['🏠 На главную']]).resize()
    );
  }
});

// Обработка ввода настроек корма
foodSettingsScene.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Проверка на кнопку "На главную"
  if (text.includes('🏠 На главную')) {
    ctx.scene.enter(SCENES.MAIN);
    return;
  }

  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    // Парсинг введенных настроек
    const parsed = FeedingParser.parseDetails(text);

    if (!parsed.isValid) {
      ctx.reply(
        `❌ Ошибка: ${parsed.error}\n\n` +
        `Попробуйте еще раз или используйте примеры выше.`,
        Markup.keyboard([
          ['🏠 На главную']
        ]).resize()
      );
      return;
    }

    // Сохранение новых настроек
    let updatedSettings = [];
    
    if (parsed.amount !== undefined) {
      await globalDatabase.setSetting('default_food_amount', parsed.amount.toString());
      updatedSettings.push(`количество: ${parsed.amount} граммов`);
    }
    
    if (parsed.foodType !== undefined) {
      await globalDatabase.setSetting('default_food_type', parsed.foodType);
      const typeText = parsed.foodType === 'dry' ? 'сухой' : 'влажный';
      updatedSettings.push(`тип: ${typeText}`);
    }

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Настройки корма обновлены!\n\n` +
      `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
      `Изменения вступят в силу после следующего кормления.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await globalDatabase.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `🍽️ ${message}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Настройки корма изменены: ${updatedSettings.join(', ')} пользователем ${user?.username}`);
    
    ctx.reply(
      message,
      Markup.keyboard([
        ['⚙️ Настройки'],
        ['🏠 На главную']
      ]).resize()
    );

  } catch (error) {
    console.error('Ошибка сохранения настроек корма:', error);
    ctx.reply(
      '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
      Markup.keyboard([
        ['🏠 На главную']
      ]).resize()
    );
  }
});
```

### 2. Обновить `src/utils/constants.ts`
```typescript
// ... предыдущий код ...

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_DETAILS: 'feeding_details',
  SETTINGS: 'settings',
  HISTORY: 'history',
  INTERVAL_SETTINGS: 'interval_settings',
  TODAY_HISTORY: 'today_history',
  FOOD_SETTINGS: 'food_settings',
  NOTIFICATION_SETTINGS: 'notification_settings',
  FULL_HISTORY: 'full_history',
  EXPORT: 'export',
  SCHEDULE_FEEDING: 'schedule_feeding',
  SCHEDULED_LIST: 'scheduled_list',
  OTHER_ACTIONS: 'other_actions'
};
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

### 4. Обновить `src/handlers/main.ts`
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

      // Запуск таймера на следующее кормление
      this.timerService.startFeedingTimer();

      // Форматирование информации о корме
      const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

      // Уведомление всех пользователей
      const message = `${MESSAGES.FEEDING_COMPLETED}\n` +
        `Время: ${feeding.timestamp.toLocaleString('ru-RU')}\n` +
        `Кто: ${user.username || 'Пользователь'}\n` +
        `Корм: ${foodInfo}\n\n` +
        `⏰ Следующее кормление через ${Math.round(this.timerService.getCurrentInterval() / 60)} часов`;

      // Отправка уведомления всем пользователям
      const allUsers = await this.database.getAllUsers();
      for (const u of allUsers) {
        if (u.notificationsEnabled) {
          try {
            await ctx.telegram.sendMessage(u.telegramId, message);
          } catch (error) {
            console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
          }
        }
      }

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

      // Уведомление всех пользователей
      const allUsers = await this.database.getAllUsers();
      for (const u of allUsers) {
        if (u.notificationsEnabled) {
          try {
            await ctx.telegram.sendMessage(u.telegramId, message);
          } catch (error) {
            console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
          }
        }
      }

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

### 5. Обновить `src/bot.ts` (удалить ссылки на удаленные сцены)
```typescript
// ... импорты ...
import { foodSettingsScene, setGlobalDatabaseForFoodSettings } from './scenes/food-settings';

// ... остальной код ...

// Настройка сцен
const stage = new Scenes.Stage([
  mainScene,
  feedingSuccessScene,
  settingsScene,
  historyScene,
  todayHistoryScene,
  intervalSettingsScene,
  foodSettingsScene,
  notificationSettingsScene,
  fullHistoryScene,
  exportScene,
  scheduleFeedingScene,
  scheduledListScene,
  otherActionsScene
]);

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Доступ к настройкам корма**:
   - Главный экран → Настройки → корм
   - Проверить отображение текущих настроек
   - Проверить наличие поясняющего текста с примерами

2. **Изменение типа корма**:
   - Ввести "сухого 25" в экране настроек корма
   - Проверить уведомление всем пользователям
   - Проверить сохранение в БД

3. **Изменение количества корма**:
   - Ввести "30 грамм влажного" в экране настроек корма
   - Проверить уведомление и сохранение

4. **Валидация ввода**:
   - Ввести "0" → должна быть ошибка
   - Ввести "501" → должна быть ошибка
   - Ввести "abc" → должна быть ошибка

5. **Применение настроек**:
   - Изменить тип на "влажный" и количество на 30г
   - Нажать "Я покормил"
   - Проверить, что в уведомлении указан влажный корм 30г

6. **Проверка БД**:
   - Проверить таблицу `settings` на наличие записей
   - Проверить таблицу `feedings` с новыми настройками

### Проверка настроек в БД:
```sql
SELECT * FROM settings WHERE key IN ('default_food_type', 'default_food_amount');
SELECT * FROM feedings ORDER BY timestamp DESC LIMIT 5;
```

## Ограничения этапа
- Нет уточнения деталей кормления
- Нет персональных настроек уведомлений
- Нет экспорта истории
- Простая обработка ошибок

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 7: добавление возможности уточнения деталей кормления после нажатия "Я покормил".
