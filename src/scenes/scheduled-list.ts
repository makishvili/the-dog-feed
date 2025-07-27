import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getScheduledListKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';
import { SchedulerService } from '../services/scheduler';
import { formatDateTime } from '../utils/time-utils';
import { createUserLink } from '../utils/user-utils';

let globalSchedulerService: SchedulerService | null = null;

export function setGlobalSchedulerForScheduledList(schedulerService: SchedulerService) {
  globalSchedulerService = schedulerService;
}

export const scheduledListScene = new Scenes.BaseScene<BotContext>(SCENES.SCHEDULED_LIST);

// Вход в сцену списка запланированных кормлений
scheduledListScene.enter(async (ctx) => {
  await showScheduledList(ctx);
});

// Функция для отображения списка запланированных кормлений
async function showScheduledList(ctx: BotContext) {
  if (!globalSchedulerService) {
    ctx.reply(
      '❌ Сервис планировщика не инициализирован. Попробуйте позже.',
      getScheduledListKeyboard()
    );
    return;
  }

  try {
    const scheduledFeedings = await globalSchedulerService.getActiveScheduledFeedings();
    
    if (scheduledFeedings.length === 0) {
      ctx.reply(
        `${MESSAGES.SCHEDULED_LIST_EMPTY}\n\n` +
        'Вы можете создать новое запланированное кормление.',
        getScheduledListKeyboard()
      );
      return;
    }

    let message = `${MESSAGES.SCHEDULED_LIST_HEADER}\n\n`;
    message += `📊 Активных кормлений: ${scheduledFeedings.length}\n\n`;

    // Сортируем по времени
    scheduledFeedings.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    for (const schedule of scheduledFeedings) {
      const user = await ctx.database.getUserById(schedule.createdBy);
      const username = createUserLink(user);
      
      const scheduledTime = formatDateTime(schedule.scheduledTime, user?.timezone);
      const createdTime = formatDateTime(schedule.createdAt, user?.timezone);
      
      // Рассчитываем время до кормления
      const now = new Date();
      const timeUntil = schedule.scheduledTime.getTime() - now.getTime();
      
      let timeUntilText = '';
      if (timeUntil > 0) {
        const hours = Math.floor(timeUntil / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
          timeUntilText = `через ${hours} ч ${minutes} мин`;
        } else {
          timeUntilText = `через ${minutes} мин`;
        }
      } else {
        timeUntilText = 'просрочено';
      }
      
      message += `🆔 ${schedule.id}\n`;
      message += `📅 ${scheduledTime}\n`;
      message += `⏰ ${timeUntilText}\n`;
      message += `👤 ${username}\n`;
      message += `📝 Создано: ${createdTime}\n\n`;
    }

    // Создаем динамические кнопки для отмены кормлений
    const buttons = [];
    
    // Кнопки для отмены отдельных кормлений (максимум 3)
    const visibleSchedules = scheduledFeedings.slice(0, 3);
    for (const schedule of visibleSchedules) {
      buttons.push([`❌ Отменить кормление ${schedule.id}`]);
    }
    
    // Стандартные кнопки
    buttons.push(['📅 Создать новое кормление']);
    buttons.push(['❌ Отменить все']);
    buttons.push(['🏠 На главную']);
    
    const keyboard = {
      keyboard: buttons,
      resize_keyboard: true
    };

    ctx.reply(message, keyboard);
    
  } catch (error) {
    console.error('Ошибка при получении списка кормлений:', error);
    ctx.reply(
      '❌ Ошибка при загрузке списка кормлений. Попробуйте позже.',
      getScheduledListKeyboard()
    );
  }
}

// Обработка отмены конкретного кормления
scheduledListScene.hears(/❌ Отменить кормление (\d+)/, async (ctx) => {
  const match = ctx.message.text.match(/❌ Отменить кормление (\d+)/);
  if (!match) return;
  
  const scheduleId = parseInt(match[1], 10);
  
  if (!globalSchedulerService) {
    ctx.reply(
      '❌ Сервис планировщика не инициализирован. Попробуйте позже.',
      getScheduledListKeyboard()
    );
    return;
  }

  try {
    // Получаем информацию о кормлении перед отменой
    const schedule = await ctx.database.getScheduledFeedingById(scheduleId);
    
    if (!schedule) {
      ctx.reply(
        `❌ Кормление с ID ${scheduleId} не найдено.`,
        getScheduledListKeyboard()
      );
      return;
    }

    if (!schedule.isActive) {
      ctx.reply(
        `❌ Кормление с ID ${scheduleId} уже отменено.`,
        getScheduledListKeyboard()
      );
      return;
    }

    // Отменяем кормление
    await globalSchedulerService.cancelScheduledFeeding(scheduleId);
    
    // Создаем объект, соответствующий интерфейсу DatabaseUser
    const dbUser = {
      id: ctx.from?.id || 0,
      telegramId: ctx.from?.id || 0,
      username: ctx.from?.username || ctx.from?.first_name,
      notificationsEnabled: true, // Предполагаем, что у пользователя включены уведомления
      feedingInterval: 210, // Значение по умолчанию
      createdAt: new Date()
    };
    
    const username = createUserLink(dbUser);
    
    // Получаем пользователя из базы данных для получения часового пояса
    let cancellingUser = null;
    if (ctx.database) {
      cancellingUser = await ctx.database.getUserByTelegramId(ctx.from!.id);
    }
    
    ctx.reply(
      `✅ Кормление отменено!\n\n` +
      `🆔 ID: ${scheduleId}\n` +
      `📅 Было запланировано на: ${formatDateTime(schedule.scheduledTime, cancellingUser?.timezone)}\n` +
      `👤 Отменил: ${username}`
    );
    
    // Уведомляем всех пользователей об отмене
    const notificationService = globalSchedulerService['timerService'].getNotificationService();
    const notificationMessage =
      `❌ Отменено запланированное кормление\n\n` +
      `⏰ Время: ${formatDateTime(schedule.scheduledTime, cancellingUser?.timezone)}\n` +
      `👤 Отменил: ${username}`;
    
    await notificationService.sendToAll(notificationMessage, { excludeUser: ctx.from?.id || 0 });
    
    // Обновляем список
    await showScheduledList(ctx);
    
  } catch (error) {
    console.error('Ошибка при отмене кормления:', error);
    ctx.reply(
      `❌ Ошибка при отмене кормления ${scheduleId}. Попробуйте позже.`,
      getScheduledListKeyboard()
    );
  }
});

// Обработка кнопки "Создать новое кормление"
scheduledListScene.hears(/📅 Создать новое кормление/, (ctx) => {
  ctx.scene.enter(SCENES.SCHEDULE_FEEDING);
});

// Обработка кнопки "Отменить все"
scheduledListScene.hears(/❌ Отменить все/, async (ctx) => {
  if (!globalSchedulerService) {
    ctx.reply(
      '❌ Сервис планировщика не инициализирован. Попробуйте позже.',
      getScheduledListKeyboard()
    );
    return;
  }

  try {
    const cancelledCount = await globalSchedulerService.cancelAllScheduledFeedings();
    
    if (cancelledCount === 0) {
      ctx.reply(
        '📋 Нет активных кормлений для отмены.',
        getScheduledListKeyboard()
      );
      return;
    }
    
    // Создаем объект, соответствующий интерфейсу DatabaseUser
    const dbUser = {
      id: ctx.from?.id || 0,
      telegramId: ctx.from?.id || 0,
      username: ctx.from?.username || ctx.from?.first_name,
      notificationsEnabled: true, // Предполагаем, что у пользователя включены уведомления
      feedingInterval: 210, // Значение по умолчанию
      createdAt: new Date()
    };
    
    const username = createUserLink(dbUser);
    
    ctx.reply(
      `✅ Все кормления отменены!\n\n` +
      `📊 Отменено: ${cancelledCount} кормлений\n` +
      `👤 Отменил: ${username}`
    );
    
    // Уведомляем всех пользователей об отмене всех кормлений
    const notificationService = globalSchedulerService['timerService'].getNotificationService();
    const notificationMessage = 
      `❌ Отменены все запланированные кормления\n\n` +
      `📊 Количество: ${cancelledCount}\n` +
      `👤 Отменил: ${username}`;
    
    await notificationService.sendToAll(notificationMessage, { excludeUser: ctx.from?.id || 0 });
    
    // Обновляем список
    await showScheduledList(ctx);
    
  } catch (error) {
    console.error('Ошибка при отмене всех кормлений:', error);
    ctx.reply(
      '❌ Ошибка при отмене всех кормлений. Попробуйте позже.',
      getScheduledListKeyboard()
    );
  }
});

// Обработка кнопки "На главную"
scheduledListScene.hears(/🏠 На главную/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка команды /home
scheduledListScene.command('home', (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
scheduledListScene.on('text', (ctx) => {
  const text = ctx.message.text;
  
  // Пропускаем команды, начинающиеся с /
  if (text.startsWith('/')) {
    return;
  }
  
  ctx.reply(
    'Используйте кнопки меню для управления запланированными кормлениями.',
    getScheduledListKeyboard()
  );
}); 
