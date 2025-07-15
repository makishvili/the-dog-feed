# Этап 6: Настройки корма

## Цель этапа
Реализовать настройки типа и количества корма с сохранением в базе данных. Настройки применяются глобально для всех пользователей.

## Результат этапа
Бот с функциональностью:
- Экран "Настройки корма" с выбором типа и количества
- Выбор типа корма: "Сухой" или "Влажный"
- Настройка количества корма от 1 до 200 граммов
- Сохранение настроек в БД (глобально для всех пользователей)
- Применение настроек к новым кормлениям
- Отображение текущих настроек

## Новые/измененные файлы

### 1. `src/scenes/food-settings.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';

export const foodSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_SETTINGS);

// Вход в сцену настроек корма
foodSettingsScene.enter(async (ctx) => {
  try {
    // Получаем текущие настройки из БД
    const currentType = await ctx.database.getSetting('default_food_type') || 'dry';
    const currentAmount = await ctx.database.getSetting('default_food_amount') || '12';
    
    const typeText = currentType === 'dry' ? 'Сухой' : 'Влажный';
    
    const message = `🍽️ Настройки корма\n\n` +
      `Текущие настройки:\n` +
      `• Тип корма: ${typeText}\n` +
      `• Количество: ${currentAmount} граммов\n\n` +
      `Выберите что изменить:`;

    ctx.reply(message, Markup.keyboard([
      ['🥘 Тип корма', '⚖️ Количество корма'],
      ['🏠 Выйти на главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения настроек корма:', error);
    ctx.reply(
      '❌ Ошибка получения настроек. Попробуйте еще раз.',
      Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
    );
  }
});

// Обработка кнопки "Тип корма"
foodSettingsScene.hears(/🥘 Тип корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_TYPE_SETTINGS);
});

// Обработка кнопки "Количество корма"
foodSettingsScene.hears(/⚖️ Количество корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_AMOUNT_SETTINGS);
});

// Обработка кнопки "Выйти на главный экран"
foodSettingsScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
foodSettingsScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    Markup.keyboard([
      ['🥘 Тип корма', '⚖️ Количество корма'],
      ['🏠 Выйти на главный экран']
    ]).resize()
  );
});
```

### 2. `src/scenes/food-type-settings.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';

export const foodTypeSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_TYPE_SETTINGS);

// Вход в сцену выбора типа корма
foodTypeSettingsScene.enter(async (ctx) => {
  try {
    const currentType = await ctx.database.getSetting('default_food_type') || 'dry';
    const currentTypeText = currentType === 'dry' ? 'Сухой' : 'Влажный';
    
    const message = `🥘 Выбор типа корма\n\n` +
      `Текущий тип: ${currentTypeText}\n\n` +
      `Выберите новый тип корма:`;

    ctx.reply(message, Markup.keyboard([
      ['🌾 Сухой', '🥫 Влажный'],
      ['🍽️ Настройки корма', '🏠 Главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения типа корма:', error);
    ctx.reply('❌ Ошибка получения данных');
  }
});

// Обработка выбора "Сухой"
foodTypeSettingsScene.hears(/🌾 Сухой/, async (ctx) => {
  try {
    await ctx.database.setSetting('default_food_type', 'dry');
    
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Тип корма изменен на "Сухой"\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await ctx.database.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `🌾 ${message}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Тип корма изменен на "dry" пользователем ${user?.username}`);
    
    // Возврат к настройкам корма
    setTimeout(() => {
      ctx.scene.enter(SCENES.FOOD_SETTINGS);
    }, 1500);

  } catch (error) {
    console.error('Ошибка сохранения типа корма:', error);
    ctx.reply('❌ Ошибка сохранения настроек');
  }
});

// Обработка выбора "Влажный"
foodTypeSettingsScene.hears(/🥫 Влажный/, async (ctx) => {
  try {
    await ctx.database.setSetting('default_food_type', 'wet');
    
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Тип корма изменен на "Влажный"\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await ctx.database.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `🥫 ${message}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Тип корма изменен на "wet" пользователем ${user?.username}`);
    
    // Возврат к настройкам корма
    setTimeout(() => {
      ctx.scene.enter(SCENES.FOOD_SETTINGS);
    }, 1500);

  } catch (error) {
    console.error('Ошибка сохранения типа корма:', error);
    ctx.reply('❌ Ошибка сохранения настроек');
  }
});

// Обработка кнопки "Настройки корма"
foodTypeSettingsScene.hears(/🍽️ Настройки корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_SETTINGS);
});

// Обработка кнопки "Главный экран"
foodTypeSettingsScene.hears(/🏠 Главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
foodTypeSettingsScene.on('text', (ctx) => {
  ctx.reply(
    'Выберите тип корма из предложенных вариантов.',
    Markup.keyboard([
      ['🌾 Сухой', '🥫 Влажный'],
      ['🍽️ Настройки корма', '🏠 Главный экран']
    ]).resize()
  );
});
```

### 3. `src/scenes/food-amount-settings.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';

export const foodAmountSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_AMOUNT_SETTINGS);

// Вход в сцену настройки количества корма
foodAmountSettingsScene.enter(async (ctx) => {
  try {
    const currentAmount = await ctx.database.getSetting('default_food_amount') || '12';
    
    const message = `⚖️ Настройка количества корма\n\n` +
      `Текущее количество: ${currentAmount} граммов\n\n` +
      `Введите новое количество корма (от 1 до 200 граммов):\n\n` +
      `Примеры:\n` +
      `• 12\n` +
      `• 25\n` +
      `• 50\n` +
      `• 100`;

    ctx.reply(message, Markup.keyboard([
      ['🍽️ Настройки корма', '🏠 Главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения количества корма:', error);
    ctx.reply('❌ Ошибка получения данных');
  }
});

// Обработка ввода количества
foodAmountSettingsScene.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Проверка на кнопки навигации
  if (text.includes('🍽️ Настройки корма')) {
    ctx.scene.enter(SCENES.FOOD_SETTINGS);
    return;
  }

  if (text.includes('🏠 Главный экран')) {
    ctx.scene.enter(SCENES.MAIN);
    return;
  }

  // Парсинг количества
  const amount = parseInt(text.trim());

  if (isNaN(amount)) {
    ctx.reply(
      '❌ Введите число от 1 до 200',
      Markup.keyboard([
        ['🍽️ Настройки корма', '🏠 Главный экран']
      ]).resize()
    );
    return;
  }

  if (amount < 1 || amount > 200) {
    ctx.reply(
      '❌ Количество должно быть от 1 до 200 граммов',
      Markup.keyboard([
        ['🍽️ Настройки корма', '🏠 Главный экран']
      ]).resize()
    );
    return;
  }

  try {
    await ctx.database.setSetting('default_food_amount', amount.toString());
    
    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Количество корма изменено на ${amount} граммов\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await ctx.database.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `⚖️ ${message}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Количество корма изменено на ${amount}г пользователем ${user?.username}`);
    
    // Возврат к настройкам корма
    setTimeout(() => {
      ctx.scene.enter(SCENES.FOOD_SETTINGS);
    }, 1500);

  } catch (error) {
    console.error('Ошибка сохранения количества корма:', error);
    ctx.reply('❌ Ошибка сохранения настроек');
  }
});
```

### 4. Обновить `src/utils/constants.ts`
```typescript
// ... предыдущий код ...

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  SETTINGS: 'settings',
  HISTORY: 'history',
  TODAY_HISTORY: 'today_history',
  INTERVAL_SETTINGS: 'interval_settings',
  FOOD_SETTINGS: 'food_settings',
  FOOD_TYPE_SETTINGS: 'food_type_settings',
  FOOD_AMOUNT_SETTINGS: 'food_amount_settings'
};
```

### 5. Обновить `src/scenes/settings.ts`
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

// Обработка кнопки "Настройки корма"
settingsScene.hears(/🍽️ Настройки корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_SETTINGS);
});

// Обработка кнопки "Настройки интервала кормления"
settingsScene.hears(/⏰ Настройки интервала кормления/, (ctx) => {
  ctx.scene.enter(SCENES.INTERVAL_SETTINGS);
});

// Заглушка для настроек уведомлений
settingsScene.hears(/🔔 Настройки уведомлений/, (ctx) => {
  ctx.reply(
    '🔔 Настройки уведомлений будут добавлены в Этапе 8.\n\n' +
    'Сейчас уведомления включены для всех.',
    getSettingsKeyboard()
  );
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

### 6. Обновить `src/handlers/main.ts`
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
        `Чтобы возобновить кормления, нажмите "🍽️ Я покормил"`;

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

### 7. Обновить `src/bot.ts` (добавить новые сцены)
```typescript
// ... импорты ...
import { foodSettingsScene } from './scenes/food-settings';
import { foodTypeSettingsScene } from './scenes/food-type-settings';
import { foodAmountSettingsScene } from './scenes/food-amount-settings';

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
  foodTypeSettingsScene,
  foodAmountSettingsScene
]);

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Доступ к настройкам корма**:
   - Главный экран → Настройки → Настройки корма
   - Проверить отображение текущих настроек

2. **Изменение типа корма**:
   - Настройки корма → Тип корма → Сухой/Влажный
   - Проверить уведомление всем пользователям
   - Проверить сохранение в БД

3. **Изменение количества корма**:
   - Настройки корма → Количество корма
   - Ввести валидное значение (например, 25)
   - Проверить уведомление и сохранение

4. **Валидация количества**:
   - Ввести 0 → должна быть ошибка
   - Ввести 250 → должна быть ошибка
   - Ввести "abc" → должна быть ошибка

5. **Применение настроек**:
   - Изменить тип на "Влажный" и количество на 30г
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
