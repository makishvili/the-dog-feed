import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getScheduleFeedingKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';
import { SchedulerService } from '../services/scheduler';
import { DatabaseService } from '../services/database';
import { User } from '../types';
import { formatDateTime } from '../utils/time-utils';
import { createUserLink } from '../utils/user-utils';
import { getOrCreateUser } from './main';

let globalSchedulerService: SchedulerService | null = null;
let globalDatabase: DatabaseService | null = null;

export function setGlobalSchedulerForScheduleFeeding(schedulerService: SchedulerService) {
  globalSchedulerService = schedulerService;
}

export function setGlobalDatabaseForScheduleFeeding(database: DatabaseService) {
  globalDatabase = database;
}

export const scheduleFeedingScene = new Scenes.BaseScene<BotContext>(SCENES.SCHEDULE_FEEDING);

// Вход в сцену планирования кормления
scheduleFeedingScene.enter((ctx) => {
  ctx.reply(
    `${MESSAGES.SCHEDULE_FEEDING_HEADER}\n\n${MESSAGES.SCHEDULE_FEEDING_PROMPT}`,
    getScheduleFeedingKeyboard()
  );
});

// Парсинг времени из строки
function parseScheduleTime(timeString: string): Date {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDate = now.getDate();
  
  // Убираем лишние пробелы и приводим к нижнему регистру
  const cleanTime = timeString.trim().toLowerCase();
  
  // Регулярные выражения для различных форматов
  const patterns = {
    // HH:MM (сегодня)
    timeOnly: /^(\d{1,2}):(\d{2})$/,
    // DD.MM HH:MM
    dateTimeShort: /^(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
    // DD.MM.YYYY HH:MM
    dateTimeFull: /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/
  };
  
  let parsedDate: Date;
  
  if (patterns.timeOnly.test(cleanTime)) {
    // Формат: HH:MM (сегодня)
    const match = cleanTime.match(patterns.timeOnly)!;
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    parsedDate = new Date(currentYear, currentMonth, currentDate, hours, minutes, 0, 0);
    
    // Если время уже прошло сегодня, планируем на завтра
    if (parsedDate <= now) {
      parsedDate.setDate(parsedDate.getDate() + 1);
    }
    
  } else if (patterns.dateTimeShort.test(cleanTime)) {
    // Формат: DD.MM HH:MM
    const match = cleanTime.match(patterns.dateTimeShort)!;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Месяцы с 0
    const hours = parseInt(match[3], 10);
    const minutes = parseInt(match[4], 10);
    
    parsedDate = new Date(currentYear, month, day, hours, minutes, 0, 0);
    
    // Если дата в прошлом, добавляем год
    if (parsedDate <= now) {
      parsedDate.setFullYear(currentYear + 1);
    }
    
  } else if (patterns.dateTimeFull.test(cleanTime)) {
    // Формат: DD.MM.YYYY HH:MM
    const match = cleanTime.match(patterns.dateTimeFull)!;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // Месяцы с 0
    const year = parseInt(match[3], 10);
    const hours = parseInt(match[4], 10);
    const minutes = parseInt(match[5], 10);
    
    parsedDate = new Date(year, month, day, hours, minutes, 0, 0);
    
  } else {
    throw new Error('Неправильный формат времени');
  }
  
  // Валидация значений
  if (parsedDate.getHours() < 0 || parsedDate.getHours() > 23) {
    throw new Error('Часы должны быть от 0 до 23');
  }
  
  if (parsedDate.getMinutes() < 0 || parsedDate.getMinutes() > 59) {
    throw new Error('Минуты должны быть от 0 до 59');
  }
  
  if (parsedDate.getDate() !== parsedDate.getDate()) {
    throw new Error('Неправильная дата');
  }
  
  return parsedDate;
}

// Обработка текстовых сообщений (время)
scheduleFeedingScene.on('text', async (ctx) => {
  const timeString = ctx.message.text.trim();
  
  // Если это кнопка, игнорируем
  if (timeString.includes('❌') || timeString.includes('🏠')) {
    return;
  }
  
  if (!globalSchedulerService) {
    ctx.reply(
      '❌ Сервис планировщика не инициализирован',
      getScheduleFeedingKeyboard()
    );
    return;
  }
  
  try {
    // Парсим время
    const scheduledTime = parseScheduleTime(timeString);
    
    // Получаем пользователя
    const user = await getOrCreateUser(
      ctx.from!.id,
      ctx.from!.username || ctx.from!.first_name
    );
    
    // Получаем пользователя из базы данных для получения часового пояса
    let dbUser = null;
    if (globalDatabase) {
      dbUser = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    }
    
    // Планируем кормление с правильным ID пользователя
    const schedule = await globalSchedulerService.scheduleFeeding(
      scheduledTime,
      user.id  // Используем внутренний ID пользователя, а не Telegram ID
    );
    
    // Создаем объект, соответствующий интерфейсу DatabaseUser
    const dbUserForLink = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      notificationsEnabled: user.notificationsEnabled,
      feedingInterval: user.feedingInterval || 210, // Значение по умолчанию
      createdAt: new Date()
    };
    
    const username = createUserLink(dbUserForLink);
    
    // Отправляем подтверждение
    ctx.reply(
      `${MESSAGES.SCHEDULE_FEEDING_SUCCESS}\n\n` +
      `📅 Время: ${formatDateTime(scheduledTime, dbUser?.timezone)}\n` +
      `👤 Создал: ${username}\n` +
      `🆔 ID: ${schedule.id}\n\n` +
      `Уведомление будет отправлено в назначенное время.`,
      getScheduleFeedingKeyboard()
    );
    
    // Переходим к главной сцене
    ctx.scene.enter(SCENES.MAIN);
    
  } catch (error) {
    console.error('Ошибка создания запланированного кормления:', error);
    
    let errorMessage = '❌ Произошла ошибка при создании расписания';
    
    if (error instanceof Error) {
      if (error.message.includes('будущем')) {
        errorMessage = '❌ Время кормления должно быть в будущем';
      } else if (error.message.includes('интервал')) {
        errorMessage = '❌ Минимальный интервал планирования: 5 минут';
      } else if (error.message.includes('дней')) {
        errorMessage = '❌ Максимальный период планирования: 7 дней';
      } else if (error.message.includes('максимум')) {
        errorMessage = '❌ Максимум 10 запланированных кормлений одновременно';
      } else if (error.message.includes('формат')) {
        errorMessage = '❌ Неверный формат времени';
      }
    }
    
    ctx.reply(errorMessage, getScheduleFeedingKeyboard());
  }
});

// Обработка кнопки "Отменить ввод"
scheduleFeedingScene.hears(/❌ Отменить ввод/, (ctx) => {
  ctx.reply(
    '❌ Создание кормления отменено.',
    getScheduleFeedingKeyboard()
  );
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка кнопки "На главную"
scheduleFeedingScene.hears(/🏠 На главную/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка команды /home
scheduleFeedingScene.command('home', (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
}); 
