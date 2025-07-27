# Этап 2: Простые таймеры

## Цель этапа
Добавить автоматические напоминания о кормлении через заданный интервал (3.5 часа) и повторные уведомления каждые 10 минут.

## Результат этапа
Бот с функциональностью:
- После кнопки "Я покормил" запускается таймер на 3.5 часа
- По истечении времени отправляется уведомление "Пора покормить собаку!"
- Если никто не покормил в течение 10 минут, отправляются повторные напоминания
- Кнопка "Завершить кормления на сегодня" останавливает таймеры

## Новые/измененные файлы

### 1. `src/services/timer.ts` (новый)
```typescript
import { Telegraf } from 'telegraf';
import { BotContext } from '../types';

export interface TimerState {
  nextFeedingTime: Date | null;
  isActive: boolean;
  reminderInterval: NodeJS.Timeout | null;
  feedingTimeout: NodeJS.Timeout | null;
}

export class TimerService {
  private bot: Telegraf;
  private context: BotContext;
  private timerState: TimerState;
  
  // Интервалы в миллисекундах
  private readonly FEEDING_INTERVAL = 3.5 * 60 * 60 * 1000; // 3.5 часа
  private readonly REMINDER_INTERVAL = 10 * 60 * 1000; // 10 минут
  
  constructor(bot: Telegraf, context: BotContext) {
    this.bot = bot;
    this.context = context;
    this.timerState = {
      nextFeedingTime: null,
      isActive: false,
      reminderInterval: null,
      feedingTimeout: null
    };
  }
  
  // Запуск таймера после кормления
  startFeedingTimer(): void {
    this.clearAllTimers();
    
    const nextTime = new Date(Date.now() + this.FEEDING_INTERVAL);
    this.timerState.nextFeedingTime = nextTime;
    this.timerState.isActive = true;
    
    console.log(`Таймер запущен. Следующее кормление: ${nextTime.toLocaleString('ru-RU')}`);
    
    this.timerState.feedingTimeout = setTimeout(() => {
      this.sendFeedingReminder();
    }, this.FEEDING_INTERVAL);
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
  getNextFeedingInfo(): { time: Date | null; isActive: boolean } {
    return {
      time: this.timerState.nextFeedingTime,
      isActive: this.timerState.isActive
    };
  }
  
  // Проверка активности таймеров
  isTimerActive(): boolean {
    return this.timerState.isActive;
  }
}
```

### 2. `src/utils/constants.ts` (новый)
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
  FEEDINGS_RESUMED: '▶️ Кормления возобновлены'
};

// Эмодзи для кнопок
export const EMOJIS = {
  FEED: '🍽️',
  STOP: '⏹️',
  SETTINGS: '⚙️',
  HISTORY: '📋'
};
```

### 3. `src/bot.ts` (обновленный)
```typescript
import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import { User, Feeding, BotContext } from './types';
import { TimerService } from './services/timer';
import { MESSAGES, EMOJIS } from './utils/constants';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

// Создание бота
const bot = new Telegraf(BOT_TOKEN);

// Глобальное состояние (в памяти)
const botContext: BotContext = {
  users: new Map(),
  feedings: [],
  nextFeedingId: 1,
  nextUserId: 1
};

// Инициализация сервиса таймеров
const timerService = new TimerService(bot, botContext);

// Функция для получения или создания пользователя
function getOrCreateUser(telegramId: number, username?: string): User {
  let user = Array.from(botContext.users.values())
    .find(u => u.telegramId === telegramId);
  
  if (!user) {
    user = {
      id: botContext.nextUserId++,
      telegramId,
      username,
      notificationsEnabled: true
    };
    botContext.users.set(user.id, user);
    console.log(`Новый пользователь: ${username || telegramId}`);
  }
  
  return user;
}

// Функция для создания главной клавиатуры
function getMainKeyboard() {
  return Markup.keyboard([
    [`${EMOJIS.FEED} Я покормил`],
    [`${EMOJIS.STOP} Завершить кормления на сегодня`]
  ]).resize();
}

// Команда /start
bot.start((ctx) => {
  const user = getOrCreateUser(
    ctx.from.id, 
    ctx.from.username || ctx.from.first_name
  );
  
  const nextFeeding = timerService.getNextFeedingInfo();
  let statusMessage = '';
  
  if (nextFeeding.isActive && nextFeeding.time) {
    statusMessage = `\n\n⏰ Следующее кормление: ${nextFeeding.time.toLocaleString('ru-RU')}`;
  } else {
    statusMessage = '\n\n⏹️ Кормления приостановлены';
  }
  
  ctx.reply(
    `Привет, ${user.username || 'друг'}! 🐕\n\n` +
    'Этот бот поможет координировать кормление собаки.\n' +
    'Нажми кнопку ниже, когда покормишь собаку.' +
    statusMessage,
    getMainKeyboard()
  );
});

// Обработка кнопки "Собачка поел"
bot.hears(/🍽️ Собачка поел/, (ctx) => {
  const user = getOrCreateUser(
    ctx.from.id,
    ctx.from.username || ctx.from.first_name
  );
  
  // Создание записи о кормлении
  const feeding: Feeding = {
    id: botContext.nextFeedingId++,
    userId: user.id,
    timestamp: new Date(),
    foodType: 'dry',
    amount: 12
  };
  
  botContext.feedings.push(feeding);
  
  // Запуск таймера на следующее кормление
  timerService.startFeedingTimer();
  
  // Уведомление всех пользователей
  const message = `${MESSAGES.FEEDING_COMPLETED}\n` +
    `Время: ${feeding.timestamp.toLocaleString('ru-RU')}\n` +
    `Кто: ${user.username || 'Пользователь'}\n\n` +
    `⏰ Следующее кормление через 3.5 часа`;
  
  // Отправка уведомления всем пользователям
  botContext.users.forEach(async (u) => {
    if (u.notificationsEnabled) {
      try {
        await ctx.telegram.sendMessage(u.telegramId, message);
      } catch (error) {
        console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
      }
    }
  });
  
  console.log(`Кормление записано: ${user.username} в ${feeding.timestamp}`);
});

// Обработка кнопки "Завершить кормления на сегодня"
bot.hears(/⏹️ Завершить кормления на сегодня/, (ctx) => {
  const user = getOrCreateUser(
    ctx.from.id,
    ctx.from.username || ctx.from.first_name
  );
  
  timerService.stopAllTimers();
  
  const message = `${MESSAGES.FEEDINGS_STOPPED}\n` +
    `Инициатор: ${user.username || 'Пользователь'}\n\n` +
    `Чтобы возобновить кормления, нажмите "${EMOJIS.FEED} Я покормил"`;
  
  // Уведомление всех пользователей
  botContext.users.forEach(async (u) => {
    if (u.notificationsEnabled) {
      try {
        await ctx.telegram.sendMessage(u.telegramId, message);
      } catch (error) {
        console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
      }
    }
  });
  
  console.log(`Кормления остановлены пользователем: ${user.username}`);
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

// Обработка неизвестных команд
bot.on('text', (ctx) => {
  ctx.reply(
    'Я не понимаю эту команду. Используй кнопки ниже.',
    getMainKeyboard()
  );
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('Ошибка бота:', err);
  ctx.reply('Произошла ошибка. Попробуй еще раз.');
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

1. **Базовое кормление**:
   - Нажать "Я покормил"
   - Проверить уведомление о кормлении
   - Подождать 3.5 часа (или изменить константу для тестирования)
   - Проверить напоминание "Пора покормить собаку!"

2. **Повторные напоминания**:
   - Дождаться первого напоминания
   - Не кормить собаку 10 минут
   - Проверить повторное напоминание

3. **Завершение кормлений**:
   - Нажать "Завершить кормления на сегодня"
   - Проверить, что таймеры остановлены
   - Проверить уведомление о завершении

4. **Возобновление кормлений**:
   - После завершения нажать "Я покормил"
   - Проверить, что таймеры снова запустились

5. **Команда /status**:
   - Проверить отображение последнего кормления
   - Проверить отображение следующего кормления

### Для быстрого тестирования:
Измените константы в `src/utils/constants.ts`:
```typescript
export const FEEDING_INTERVAL_HOURS = 0.1; // 6 минут
export const REMINDER_INTERVAL_MINUTES = 1; // 1 минута
```

## Ограничения этапа
- Таймеры не восстанавливаются после перезапуска
- Нет настроек интервала
- Простая обработка ошибок
- Данные все еще в памяти

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 3: создание полноценного главного экрана с навигацией.
