# Этап 3: Главный экран

## Цель этапа
Реализовать полноценный главный экран с 4 кнопками и системой навигации между экранами с использованием Telegraf Scenes.

## Результат этапа
Бот с функциональностью:
- Главный экран с 4 кнопками: "Я покормил", "Завершить кормления", "Настройки", "История"
- Система сцен для навигации
- Заглушки для настроек и истории с возможностью вернуться на главный экран
- Улучшенная обработка кнопки "Я покормил" с переходом на экран успешного кормления

## Новые/измененные файлы

### 1. Обновить `package.json` (добавить зависимости)
```json
{
  "dependencies": {
    "telegraf": "^4.15.0",
    "dotenv": "^16.3.1"
  }
}
```

### 2. `src/utils/keyboards.ts` (новый)
```typescript
import { Markup } from 'telegraf';
import { EMOJIS } from './constants';

// Главная клавиатура
export function getMainKeyboard() {
  return Markup.keyboard([
    [`${EMOJIS.FEED} Я покормил`],
    [`${EMOJIS.STOP} Завершить кормления на сегодня`],
    [`${EMOJIS.SETTINGS} Настройки`, `${EMOJIS.HISTORY} История кормлений`]
  ]).resize();
}

// Клавиатура после успешного кормления
export function getFeedingSuccessKeyboard() {
  return Markup.keyboard([
    ['📝 Уточнить детали кормления'],
    ['🏠 Выйти на главный экран']
  ]).resize();
}

// Клавиатура настроек (заглушка)
export function getSettingsKeyboard() {
  return Markup.keyboard([
    ['🍽️ корм'],
    ['⏰ Настройки интервала кормления'],
    ['🔔 Настройки уведомлений'],
    ['🏠 Выйти на главный экран']
  ]).resize();
}

// Клавиатура истории (заглушка)
export function getHistoryKeyboard() {
  return Markup.keyboard([
    ['📅 Сегодня'],
    ['📋 Все кормления'],
    ['🏠 Выйти на главный экран']
  ]).resize();
}

// Универсальная кнопка "Назад"
export function getBackKeyboard() {
  return Markup.keyboard([
    ['🏠 Выйти на главный экран']
  ]).resize();
}
```

### 3. Обновить `src/utils/constants.ts`
```typescript
// Временные интервалы
export const FEEDING_INTERVAL_HOURS = 3.5;
export const REMINDER_INTERVAL_MINUTES = 10;

// Сообщения
export const MESSAGES = {
  FEEDING_REMINDER: '🔔 Пора покормить собаку!',
  REPEATED_REMINDER: '🔔 Напоминание: собаку все еще нужно покормить!',
  FEEDING_COMPLETED: '🍽️ Собаку покормили!',
  FEEDINGS_STOPPED: '⏹️ Кормления на сегодня завершены',
  FEEDINGS_RESUMED: '▶️ Кормления возобновлены',
  WELCOME: 'Привет! 🐕\n\nЭтот бот поможет координировать кормление собаки.\nВыберите действие:',
  FEEDING_SUCCESS: '✅ Кормление записано успешно!\n\nЧто дальше?',
  SETTINGS_PLACEHOLDER: '⚙️ Настройки\n\n(Функция будет добавлена в следующих этапах)',
  HISTORY_PLACEHOLDER: '📋 История кормлений\n\n(Функция будет добавлена в следующих этапах)',
  UNKNOWN_COMMAND: 'Я не понимаю эту команду. Используйте кнопки меню.'
};

// Эмодзи для кнопок
export const EMOJIS = {
  FEED: '🍽️',
  STOP: '⏹️',
  SETTINGS: '⚙️',
  HISTORY: '📋',
  HOME: '🏠',
  DETAILS: '📝'
};

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  SETTINGS: 'settings',
  HISTORY: 'history'
};
```

### 4. `src/scenes/main.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { getMainKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const mainScene = new Scenes.BaseScene<BotContext>(SCENES.MAIN);

// Вход в главную сцену
mainScene.enter((ctx) => {
  ctx.reply(MESSAGES.WELCOME, getMainKeyboard());
});

// Обработка кнопки "Настройки"
mainScene.hears(/⚙️ Настройки/, (ctx) => {
  ctx.scene.enter(SCENES.SETTINGS);
});

// Обработка кнопки "История кормлений"
mainScene.hears(/📋 История кормлений/, (ctx) => {
  ctx.scene.enter(SCENES.HISTORY);
});

// Обработка неизвестных команд
mainScene.on('text', (ctx) => {
  ctx.reply(MESSAGES.UNKNOWN_COMMAND, getMainKeyboard());
});
```

### 5. `src/scenes/feeding-success.ts` (новый)
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getFeedingSuccessKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const feedingSuccessScene = new Scenes.BaseScene<BotContext>(SCENES.FEEDING_SUCCESS);

// Вход в сцену успешного кормления
feedingSuccessScene.enter((ctx) => {
  ctx.reply(MESSAGES.FEEDING_SUCCESS, getFeedingSuccessKeyboard());
});

// Обработка кнопки "Уточнить детали кормления"
feedingSuccessScene.hears(/📝 Уточнить детали кормления/, (ctx) => {
  ctx.reply(
    '📝 Функция уточнения деталей будет добавлена в Этапе 7.\n\n' +
    'Пока что возвращаемся на главный экран.',
    getFeedingSuccessKeyboard()
  );
});

// Обработка кнопки "Выйти на главный экран"
feedingSuccessScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
feedingSuccessScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки ниже для навигации.',
    getFeedingSuccessKeyboard()
  );
});
```

### 6. `src/scenes/settings.ts` (новый)
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

// Заглушки для кнопок настроек
settingsScene.hears(/🍽️ корм/, (ctx) => {
  ctx.reply(
    '🍽️ корм будут добавлены в Этапе 6.\n\n' +
    'Пока что доступны только базовые функции.',
    getSettingsKeyboard()
  );
});

settingsScene.hears(/⏰ Настройки интервала кормления/, (ctx) => {
  ctx.reply(
    '⏰ Настройки интервала будут добавлены в Этапе 4.\n\n' +
    'Текущий интервал: 3.5 часа',
    getSettingsKeyboard()
  );
});

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

### 7. `src/scenes/history.ts` (новый)
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getHistoryKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const historyScene = new Scenes.BaseScene<BotContext>(SCENES.HISTORY);

// Вход в сцену истории
historyScene.enter((ctx) => {
  ctx.reply(MESSAGES.HISTORY_PLACEHOLDER, getHistoryKeyboard());
});

// Заглушки для кнопок истории
historyScene.hears(/📅 Сегодня/, (ctx) => {
  ctx.reply(
    '📅 Просмотр кормлений за сегодня будет добавлен в Этапе 5.\n\n' +
    'Пока что история хранится только в памяти.',
    getHistoryKeyboard()
  );
});

historyScene.hears(/📋 Все кормления/, (ctx) => {
  ctx.reply(
    '📋 Просмотр всех кормлений будет добавлен в Этапе 9.\n\n' +
    'Включая экспорт в CSV и HTML форматы.',
    getHistoryKeyboard()
  );
});

// Обработка кнопки "Выйти на главный экран"
historyScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
historyScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    getHistoryKeyboard()
  );
});
```

### 8. `src/handlers/main.ts` (новый)
```typescript
import { Context } from 'telegraf';
import { BotContext, User, Feeding } from '../types';
import { TimerService } from '../services/timer';
import { MESSAGES, SCENES } from '../utils/constants';

export class MainHandler {
  private timerService: TimerService;
  private botContext: BotContext;

  constructor(timerService: TimerService, botContext: BotContext) {
    this.timerService = timerService;
    this.botContext = botContext;
  }

  // Обработка кнопки "Я покормил"
  async handleFeeding(ctx: Context): Promise<void> {
    const user = this.getOrCreateUser(
      ctx.from!.id,
      ctx.from!.username || ctx.from!.first_name
    );

    // Создание записи о кормлении
    const feeding: Feeding = {
      id: this.botContext.nextFeedingId++,
      userId: user.id,
      timestamp: new Date(),
      foodType: 'dry',
      amount: 12
    };

    this.botContext.feedings.push(feeding);

    // Запуск таймера на следующее кормление
    this.timerService.startFeedingTimer();

    // Уведомление всех пользователей
    const message = `${MESSAGES.FEEDING_COMPLETED}\n` +
      `Время: ${feeding.timestamp.toLocaleString('ru-RU')}\n` +
      `Кто: ${user.username || 'Пользователь'}\n\n` +
      `⏰ Следующее кормление через 3.5 часа`;

    // Отправка уведомления всем пользователям
    for (const u of this.botContext.users.values()) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, message);
        } catch (error) {
          console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Кормление записано: ${user.username} в ${feeding.timestamp}`);

    // Переход к сцене успешного кормления
    await ctx.scene.enter(SCENES.FEEDING_SUCCESS);
  }

  // Обработка кнопки "Завершить кормления на сегодня"
  async handleStopFeedings(ctx: Context): Promise<void> {
    const user = this.getOrCreateUser(
      ctx.from!.id,
      ctx.from!.username || ctx.from!.first_name
    );

    this.timerService.stopAllTimers();

    const message = `${MESSAGES.FEEDINGS_STOPPED}\n` +
      `Инициатор: ${user.username || 'Пользователь'}\n\n` +
      `Чтобы возобновить кормления, нажмите "🍽️ Собачка поел"`;

    // Уведомление всех пользователей
    for (const u of this.botContext.users.values()) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, message);
        } catch (error) {
          console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Кормления остановлены пользователем: ${user.username}`);
  }

  // Получение или создание пользователя
  private getOrCreateUser(telegramId: number, username?: string): User {
    let user = Array.from(this.botContext.users.values())
      .find(u => u.telegramId === telegramId);

    if (!user) {
      user = {
        id: this.botContext.nextUserId++,
        telegramId,
        username,
        notificationsEnabled: true
      };
      this.botContext.users.set(user.id, user);
      console.log(`Новый пользователь: ${username || telegramId}`);
    }

    return user;
  }
}
```

### 9. `src/bot.ts` (обновленный)
```typescript
import { Telegraf, Scenes, session } from 'telegraf';
import * as dotenv from 'dotenv';
import { BotContext } from './types';
import { TimerService } from './services/timer';
import { MainHandler } from './handlers/main';
import { mainScene } from './scenes/main';
import { feedingSuccessScene } from './scenes/feeding-success';
import { settingsScene } from './scenes/settings';
import { historyScene } from './scenes/history';
import { SCENES } from './utils/constants';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

// Создание бота
const bot = new Telegraf<BotContext>(BOT_TOKEN);

// Глобальное состояние (в памяти)
const botContext: BotContext = {
  users: new Map(),
  feedings: [],
  nextFeedingId: 1,
  nextUserId: 1
};

// Инициализация сервисов
const timerService = new TimerService(bot, botContext);
const mainHandler = new MainHandler(timerService, botContext);

// Настройка сцен
const stage = new Scenes.Stage<BotContext>([
  mainScene,
  feedingSuccessScene,
  settingsScene,
  historyScene
]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Команда /start - переход к главной сцене
bot.start((ctx) => {
  const user = mainHandler['getOrCreateUser'](
    ctx.from.id,
    ctx.from.username || ctx.from.first_name
  );
  
  console.log(`Пользователь ${user.username || user.telegramId} запустил бота`);
  ctx.scene.enter(SCENES.MAIN);
});

// Глобальные обработчики кнопок (работают во всех сценах)
bot.hears(/🍽️ Собачка поел/, async (ctx) => {
  await mainHandler.handleFeeding(ctx);
});

bot.hears(/⏹️ Завершить кормления на сегодня/, async (ctx) => {
  await mainHandler.handleStopFeedings(ctx);
  // Возврат на главный экран после остановки кормлений
  ctx.scene.enter(SCENES.MAIN);
});

// Команда для проверки статуса
bot.command('status', (ctx) => {
  const nextFeeding = timerService.getNextFeedingInfo();
  const lastFeeding = botContext.feedings[botContext.feedings.length - 1];
  
  let message = '📊 Статус кормления:\n\n';
  
  if (lastFeeding) {
    const lastUser = botContext.users.get(lastFeeding.userId);
    message += `🍽️ Последнее кормление:\n`;
    message += `   Время: ${lastFeeding.timestamp.toLocaleString('ru-RU')}\n`;
    message += `   Кто: ${lastUser?.username || 'Неизвестно'}\n\n`;
  }
  
  if (nextFeeding.isActive && nextFeeding.time) {
    message += `⏰ Следующее кормление: ${nextFeeding.time.toLocaleString('ru-RU')}`;
  } else {
    message += '⏹️ Кормления приостановлены';
  }
  
  ctx.reply(message);
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
process.once('SIGINT', () => {
  console.log('Получен сигнал SIGINT, остановка бота...');
  timerService.stopAllTimers();
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, остановка бота...');
  timerService.stopAllTimers();
  bot.stop('SIGTERM');
});

// Запуск бота
console.log('Запуск бота...');
bot.launch();
console.log('Бот запущен успешно!');
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Навигация по главному экрану**:
   - Команда `/start` → должен показать главный экран с 4 кнопками
   - Проверить все кнопки главного экрана

2. **Кнопка "Я покормил"**:
   - Нажать → должен перейти к экрану успешного кормления
   - Проверить уведомление всем пользователям
   - Проверить запуск таймера

3. **Экран успешного кормления**:
   - Кнопка "Уточнить детали" → заглушка с информацией
   - Кнопка "Выйти на главный экран" → возврат к главному экрану

4. **Настройки**:
   - Кнопка "Настройки" → переход к экрану настроек
   - Проверить все подкнопки (заглушки)
   - Кнопка "Выйти на главный экран" → возврат

5. **История**:
   - Кнопка "История кормлений" → переход к экрану истории
   - Проверить все подкнопки (заглушки)
   - Кнопка "Выйти на главный экран" → возврат

6. **Команды**:
   - `/status` → показ текущего статуса
   - `/home` → возврат на главный экран

### Дополнительные проверки:
- Неизвестные команды должны показывать подсказку
- Навигация должна работать из любой сцены
- Таймеры должны продолжать работать при переходах между сценами

## Ограничения этапа
- Настройки и история - только заглушки
- Нет уточнения деталей кормления
- Данные все еще в памяти
- Простая обработка ошибок

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 4: добавление настроек интервала кормления с парсингом различных форматов времени.
