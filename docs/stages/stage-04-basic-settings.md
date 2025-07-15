# Этап 4: Базовые настройки

## Цель этапа
Реализовать настройки интервала кормления с поддержкой различных форматов ввода времени и валидацией от 1 минуты до 24 часов.

## Результат этапа
Бот с функциональностью:
- Экран "Настройки интервала кормления" с вводом времени
- Парсинг различных форматов: "1", "1мин", "2ч", "2:15", "2 часа 15 мин"
- Валидация интервала (1 минута - 24 часа)
- Применение нового интервала к таймерам
- Отображение текущего интервала

## Новые/измененные файлы

### 1. `src/services/parser.ts` (новый)
```typescript
export interface ParsedInterval {
  minutes: number;
  isValid: boolean;
  error?: string;
}

export class TimeParser {
  // Парсинг интервала времени
  static parseInterval(input: string): ParsedInterval {
    const trimmed = input.trim().toLowerCase();
    
    if (!trimmed) {
      return { minutes: 0, isValid: false, error: 'Пустое значение' };
    }

    // Попытка парсинга различных форматов
    const parsers = [
      this.parseMinutesOnly,
      this.parseHoursMinutesColon,
      this.parseHoursMinutesText,
      this.parseHoursOnly,
      this.parseComplexFormat
    ];

    for (const parser of parsers) {
      const result = parser(trimmed);
      if (result.isValid) {
        return this.validateInterval(result.minutes);
      }
    }

    return { 
      minutes: 0, 
      isValid: false, 
      error: 'Неверный формат. Примеры: "1", "1мин", "2ч", "2:15", "2 часа 15 мин"' 
    };
  }

  // Парсинг только минут: "1", "15", "30"
  private static parseMinutesOnly(input: string): ParsedInterval {
    const match = input.match(/^(\d+)$/);
    if (match) {
      const minutes = parseInt(match[1]);
      return { minutes, isValid: true };
    }
    return { minutes: 0, isValid: false };
  }

  // Парсинг формата "2:15", "1:30"
  private static parseHoursMinutesColon(input: string): ParsedInterval {
    const match = input.match(/^(\d+):(\d+)$/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      if (minutes < 60) {
        return { minutes: hours * 60 + minutes, isValid: true };
      }
    }
    return { minutes: 0, isValid: false };
  }

  // Парсинг "1мин", "15мин", "1 минута", "15 минут"
  private static parseHoursMinutesText(input: string): ParsedInterval {
    // Минуты
    const minMatch = input.match(/^(\d+)\s*(мин|минута|минуты|минут)$/);
    if (minMatch) {
      const minutes = parseInt(minMatch[1]);
      return { minutes, isValid: true };
    }

    // Часы
    const hourMatch = input.match(/^(\d+)\s*(ч|час|часа|часов)$/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1]);
      return { minutes: hours * 60, isValid: true };
    }

    return { minutes: 0, isValid: false };
  }

  // Парсинг только часов: "2ч", "1 час"
  private static parseHoursOnly(input: string): ParsedInterval {
    const match = input.match(/^(\d+)\s*(ч|час|часа|часов)$/);
    if (match) {
      const hours = parseInt(match[1]);
      return { minutes: hours * 60, isValid: true };
    }
    return { minutes: 0, isValid: false };
  }

  // Парсинг сложных форматов: "2 часа 15 мин", "1ч 30м"
  private static parseComplexFormat(input: string): ParsedInterval {
    // "2 часа 15 мин", "2ч 15м", "2 ч 15 мин"
    const match = input.match(/^(\d+)\s*(ч|час|часа|часов)\s*(\d+)\s*(м|мин|минута|минуты|минут)$/);
    if (match) {
      const hours = parseInt(match[1]);
      const minutes = parseInt(match[3]);
      if (minutes < 60) {
        return { minutes: hours * 60 + minutes, isValid: true };
      }
    }

    // "15 мин", "30 минут" (уже обработано выше, но для полноты)
    const minOnlyMatch = input.match(/^(\d+)\s*(мин|минута|минуты|минут)$/);
    if (minOnlyMatch) {
      const minutes = parseInt(minOnlyMatch[1]);
      return { minutes, isValid: true };
    }

    return { minutes: 0, isValid: false };
  }

  // Валидация интервала (1 минута - 24 часа)
  private static validateInterval(minutes: number): ParsedInterval {
    if (minutes < 1) {
      return { 
        minutes: 0, 
        isValid: false, 
        error: 'Минимальный интервал: 1 минута' 
      };
    }

    if (minutes > 24 * 60) {
      return { 
        minutes: 0, 
        isValid: false, 
        error: 'Максимальный интервал: 24 часа' 
      };
    }

    return { minutes, isValid: true };
  }

  // Форматирование интервала для отображения
  static formatInterval(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} мин`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} ч`;
    }

    return `${hours} ч ${remainingMinutes} мин`;
  }

  // Примеры валидных форматов
  static getExamples(): string[] {
    return [
      '1 - 1 минута',
      '15 - 15 минут',
      '1мин - 1 минута',
      '30 минут - 30 минут',
      '2ч - 2 часа',
      '1 час - 1 час',
      '2:15 - 2 часа 15 минут',
      '1ч 30м - 1 час 30 минут',
      '2 часа 15 мин - 2 часа 15 минут'
    ];
  }
}
```

### 2. `src/scenes/interval-settings.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { TimeParser } from '../services/parser';
import { SCENES } from '../utils/constants';

export const intervalSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.INTERVAL_SETTINGS);

// Вход в сцену настройки интервала
intervalSettingsScene.enter((ctx) => {
  const currentInterval = ctx.session?.feedingInterval || 210; // 3.5 часа по умолчанию
  const formattedInterval = TimeParser.formatInterval(currentInterval);
  
  const message = `⏰ Настройки интервала кормления\n\n` +
    `Текущий интервал: ${formattedInterval}\n\n` +
    `Введите новый интервал (от 1 минуты до 24 часов):\n\n` +
    `Примеры форматов:\n` +
    TimeParser.getExamples().map(example => `• ${example}`).join('\n');

  ctx.reply(message, Markup.keyboard([
    ['🏠 Выйти на главный экран']
  ]).resize());
});

// Обработка ввода интервала
intervalSettingsScene.on('text', (ctx) => {
  const text = ctx.message.text;

  // Проверка на кнопку "Выйти на главный экран"
  if (text.includes('🏠 Выйти на главный экран')) {
    ctx.scene.enter(SCENES.MAIN);
    return;
  }

  // Парсинг введенного интервала
  const parsed = TimeParser.parseInterval(text);

  if (!parsed.isValid) {
    ctx.reply(
      `❌ Ошибка: ${parsed.error}\n\n` +
      `Попробуйте еще раз или используйте примеры выше.`,
      Markup.keyboard([
        ['🏠 Выйти на главный экран']
      ]).resize()
    );
    return;
  }

  // Сохранение нового интервала
  if (!ctx.session) {
    ctx.session = {};
  }
  ctx.session.feedingInterval = parsed.minutes;

  // Обновление интервала в сервисе таймеров (если он доступен)
  if (ctx.timerService) {
    ctx.timerService.updateInterval(parsed.minutes);
  }

  const formattedInterval = TimeParser.formatInterval(parsed.minutes);
  
  ctx.reply(
    `✅ Интервал кормления обновлен!\n\n` +
    `Новый интервал: ${formattedInterval}\n\n` +
    `Изменения вступят в силу после следующего кормления.`,
    Markup.keyboard([
      ['⚙️ Настройки'],
      ['🏠 Выйти на главный экран']
    ]).resize()
  );

  console.log(`Интервал кормления изменен на ${parsed.minutes} минут пользователем ${ctx.from?.username || ctx.from?.id}`);
});
```

### 3. Обновить `src/utils/constants.ts`
```typescript
// Временные интервалы
export const FEEDING_INTERVAL_HOURS = 3.5;
export const REMINDER_INTERVAL_MINUTES = 10;
export const DEFAULT_FEEDING_INTERVAL_MINUTES = 210; // 3.5 часа

// Сообщения
export const MESSAGES = {
  FEEDING_REMINDER: '🔔 Пора покормить собаку!',
  REPEATED_REMINDER: '🔔 Напоминание: собаку все еще нужно покормить!',
  FEEDING_COMPLETED: '🍽️ Собаку покормили!',
  FEEDINGS_STOPPED: '⏹️ Кормления на сегодня завершены',
  FEEDINGS_RESUMED: '▶️ Кормления возобновлены',
  WELCOME: 'Привет! 🐕\n\nЭтот бот поможет координировать кормление собаки.\nВыберите действие:',
  FEEDING_SUCCESS: '✅ Кормление записано успешно!\n\nЧто дальше?',
  SETTINGS_PLACEHOLDER: '⚙️ Настройки\n\nВыберите что настроить:',
  HISTORY_PLACEHOLDER: '📋 История кормлений\n\n(Функция будет добавлена в следующих этапах)',
  UNKNOWN_COMMAND: 'Я не понимаю эту команду. Используйте кнопки меню.',
  INTERVAL_UPDATED: '✅ Интервал кормления обновлен!'
};

// Эмодзи для кнопок
export const EMOJIS = {
  FEED: '🍽️',
  STOP: '⏹️',
  SETTINGS: '⚙️',
  HISTORY: '📋',
  HOME: '🏠',
  DETAILS: '📝',
  INTERVAL: '⏰'
};

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  SETTINGS: 'settings',
  HISTORY: 'history',
  INTERVAL_SETTINGS: 'interval_settings'
};
```

### 4. Обновить `src/services/timer.ts`
```typescript
import { Telegraf } from 'telegraf';
import { BotContext } from '../types';
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
  private context: BotContext;
  private timerState: TimerState;
  
  // Интервалы в миллисекундах
  private readonly REMINDER_INTERVAL = 10 * 60 * 1000; // 10 минут
  
  constructor(bot: Telegraf, context: BotContext) {
    this.bot = bot;
    this.context = context;
    this.timerState = {
      nextFeedingTime: null,
      isActive: false,
      reminderInterval: null,
      feedingTimeout: null,
      currentIntervalMinutes: DEFAULT_FEEDING_INTERVAL_MINUTES
    };
  }
  
  // Обновление интервала кормления
  updateInterval(minutes: number): void {
    this.timerState.currentIntervalMinutes = minutes;
    console.log(`Интервал кормления обновлен: ${minutes} минут`);
    
    // Если таймер активен, перезапускаем его с новым интервалом
    if (this.timerState.isActive) {
      console.log('Перезапуск активного таймера с новым интервалом');
      this.restartWithNewInterval();
    }
  }
  
  // Перезапуск таймера с новым интервалом
  private restartWithNewInterval(): void {
    this.clearAllTimers();
    
    const intervalMs = this.timerState.currentIntervalMinutes * 60 * 1000;
    const nextTime = new Date(Date.now() + intervalMs);
    this.timerState.nextFeedingTime = nextTime;
    this.timerState.isActive = true;
    
    console.log(`Таймер перезапущен. Следующее кормление: ${nextTime.toLocaleString('ru-RU')}`);
    
    this.timerState.feedingTimeout = setTimeout(() => {
      this.sendFeedingReminder();
    }, intervalMs);
  }
  
  // Запуск таймера после кормления
  startFeedingTimer(customIntervalMinutes?: number): void {
    this.clearAllTimers();
    
    const intervalMinutes = customIntervalMinutes || this.timerState.currentIntervalMinutes;
    const intervalMs = intervalMinutes * 60 * 1000;
    const nextTime = new Date(Date.now() + intervalMs);
    
    this.timerState.nextFeedingTime = nextTime;
    this.timerState.isActive = true;
    
    console.log(`Таймер запущен. Следующее кормление: ${nextTime.toLocaleString('ru-RU')} (интервал: ${intervalMinutes} мин)`);
    
    this.timerState.feedingTimeout = setTimeout(() => {
      this.sendFeedingReminder();
    }, intervalMs);
  }
  
  // Отправка напоминания о кормлении
  private async sendFeedingReminder(): Promise<void> {
    if (!this.timerState.isActive) return;
    
    const message = '🔔 Пора покормить собаку!';
    
    // Отправка всем пользователям с включенными уведомлениями
    for (const user of this.context.users.values()) {
      if (user.notificationsEnabled) {
        try {
          await this.bot.telegram.sendMessage(user.telegramId, message);
        } catch (error) {
          console.error(`Ошибка отправки напоминания пользователю ${user.telegramId}:`, error);
        }
      }
    }
    
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
      
      for (const user of this.context.users.values()) {
        if (user.notificationsEnabled) {
          try {
            await this.bot.telegram.sendMessage(user.telegramId, message);
          } catch (error) {
            console.error(`Ошибка отправки повторного напоминания пользователю ${user.telegramId}:`, error);
          }
        }
      }
      
      console.log('Отправлено повторное напоминание');
    }, this.REMINDER_INTERVAL);
  }
  
  // Остановка всех таймеров (завершение кормлений на сегодня)
  stopAllTimers(): void {
    this.clearAllTimers();
    this.timerState.isActive = false;
    this.timerState.nextFeedingTime = null;
    console.log('Все таймеры остановлены');
  }
  
  // Очистка всех таймеров
  private clearAllTimers(): void {
    this.clearFeedingTimeout();
    this.clearReminderInterval();
  }
  
  private clearFeedingTimeout(): void {
    if (this.timerState.feedingTimeout) {
      clearTimeout(this.timerState.feedingTimeout);
      this.timerState.feedingTimeout = null;
    }
  }
  
  private clearReminderInterval(): void {
    if (this.timerState.reminderInterval) {
      clearInterval(this.timerState.reminderInterval);
      this.timerState.reminderInterval = null;
    }
  }
  
  // Получение информации о следующем кормлении
  getNextFeedingInfo(): { time: Date | null; isActive: boolean; intervalMinutes: number } {
    return {
      time: this.timerState.nextFeedingTime,
      isActive: this.timerState.isActive,
      intervalMinutes: this.timerState.currentIntervalMinutes
    };
  }
  
  // Проверка активности таймеров
  isTimerActive(): boolean {
    return this.timerState.isActive;
  }
  
  // Получение текущего интервала
  getCurrentInterval(): number {
    return this.timerState.currentIntervalMinutes;
  }
}
```

### 5. Обновить `src/scenes/settings.ts`
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getSettingsKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';
import { TimeParser } from '../services/parser';

export const settingsScene = new Scenes.BaseScene<BotContext>(SCENES.SETTINGS);

// Вход в сцену настроек
settingsScene.enter((ctx) => {
  ctx.reply(MESSAGES.SETTINGS_PLACEHOLDER, getSettingsKeyboard());
});

// Заглушки для кнопок настроек
settingsScene.hears(/🍽️ Настройки корма/, (ctx) => {
  ctx.reply(
    '🍽️ Настройки корма будут добавлены в Этапе 6.\n\n' +
    'Пока что доступны только базовые функции.',
    getSettingsKeyboard()
  );
});

// Обработка кнопки "Настройки интервала кормления"
settingsScene.hears(/⏰ Настройки интервала кормления/, (ctx) => {
  ctx.scene.enter(SCENES.INTERVAL_SETTINGS);
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

### 6. Обновить `src/types.ts`
```typescript
export interface User {
  id: number;
  telegramId: number;
  username?: string;
  notificationsEnabled: boolean;
}

export interface Feeding {
  id: number;
  userId: number;
  timestamp: Date;
  foodType: 'dry' | 'wet';
  amount: number; // граммы
  details?: string;
}

export interface BotContext {
  users: Map<number, User>;
  feedings: Feeding[];
  nextFeedingId: number;
  nextUserId: number;
}

// Расширение контекста Telegraf для сессий
declare module 'telegraf' {
  interface Context {
    session?: {
      feedingInterval?: number; // интервал в минутах
    };
    timerService?: any; // ссылка на TimerService
  }
}
```

### 7. Обновить `src/bot.ts` (добавить новую сцену)
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
import { intervalSettingsScene } from './scenes/interval-settings';
import { SCENES } from './utils/constants';
import { TimeParser } from './services/parser';

// ... остальной код остается тем же ...

// Настройка сцен
const stage = new Scenes.Stage<BotContext>([
  mainScene,
  feedingSuccessScene,
  settingsScene,
  historyScene,
  intervalSettingsScene // добавляем новую сцену
]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Добавляем timerService в контекст для доступа из сцен
bot.use((ctx, next) => {
  ctx.timerService = timerService;
  return next();
});

// ... остальной код остается тем же ...

// Команда для проверки статуса (обновленная)
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
  
  message += `⏰ Интервал кормления: ${TimeParser.formatInterval(nextFeeding.intervalMinutes)}\n\n`;
  
  if (nextFeeding.isActive && nextFeeding.time) {
    message += `⏰ Следующее кормление: ${nextFeeding.time.toLocaleString('ru-RU')}`;
  } else {
    message += '⏹️ Кормления приостановлены';
  }
  
  ctx.reply(message);
});

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Доступ к настройкам интервала**:
   - Главный экран → Настройки → Настройки интервала кормления
   - Проверить отображение текущего интервала

2. **Парсинг различных форматов**:
   - Ввести "1" → должно установить 1 минуту
   - Ввести "15мин" → должно установить 15 минут
   - Ввести "2ч" → должно установить 2 часа
   - Ввести "2:15" → должно установить 2 часа 15 минут
   - Ввести "1 час 30 мин" → должно установить 1 час 30 минут

3. **Валидация**:
   - Ввести "0" → должна быть ошибка (минимум 1 минута)
   - Ввести "25ч" → должна быть ошибка (максимум 24 часа)
   - Ввести "abc" → должна быть ошибка формата

4. **Применение настроек**:
   - Установить интервал 5 минут
   - Покормить собаку
   - Проверить, что следующее напоминание придет через 5 минут

5. **Команда /status**:
   - Проверить отображение текущего интервала
   - Проверить время следующего кормления

### Для быстрого тестирования:
Установите короткие интервалы (1-2 минуты) для проверки работы таймеров.

## Ограничения этапа
- Настройки интервала не сохраняются после перезапуска
- Нет настроек корма и уведомлений
- Данные все еще в памяти
- Простая обработка ошибок

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 5: добавление SQLite базы данных и истории кормлений за сегодня.
