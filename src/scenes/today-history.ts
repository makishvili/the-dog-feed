import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';
import { DatabaseService, DatabaseFeeding, DatabaseUser } from '../services/database';
import { ScheduledFeeding } from '../services/scheduler';
import { TimerService } from '../services/timer';
import { formatDateTime } from '../utils/time-utils';
import { createUserLink } from '../utils/user-utils';

export const todayHistoryScene = new Scenes.BaseScene<BotContext>(SCENES.TODAY_HISTORY);

// Глобальные переменные для доступа к сервисам
let globalDatabase: DatabaseService | null = null;
let globalSchedulerService: any = null;
let globalTimerService: TimerService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForTodayHistory(database: DatabaseService) {
  globalDatabase = database;
}

// Функция для установки глобального сервиса планировщика
export function setGlobalSchedulerForTodayHistory(schedulerService: any) {
  globalSchedulerService = schedulerService;
}

// Функция для установки глобального сервиса таймера
export function setGlobalTimerForTodayHistory(timerService: TimerService) {
  globalTimerService = timerService;
}

// Вход в сцену истории за сегодня
todayHistoryScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    // Получаем кормления за сегодня
    const todayFeedings = await globalDatabase.getTodayFeedings();
    const allUsers = await globalDatabase.getAllUsers();
    
    // Создаем карту пользователей для быстрого поиска
    const usersMap = new Map<number, DatabaseUser>();
    allUsers.forEach(user => usersMap.set(user.id, user));

    let message = '📅 *История кормлений за сегодня*\n\n';

    // Получаем запланированные кормления
    if (globalSchedulerService) {
      try {
        const scheduledFeedings: ScheduledFeeding[] = await globalSchedulerService.getActiveScheduledFeedings();
        const now = new Date();
        
        // Фильтруем только будущие кормления
        const futureFeedings: ScheduledFeeding[] = scheduledFeedings.filter((schedule: ScheduledFeeding) =>
          schedule.scheduledTime > now
        );
        
        if (futureFeedings.length > 0) {
          message += `📅 Следующие запланированные кормления:\n`;
          
          // Сортируем по времени
          futureFeedings.sort((a: ScheduledFeeding, b: ScheduledFeeding) =>
            a.scheduledTime.getTime() - b.scheduledTime.getTime()
          );
          
          // Показываем максимум 3 ближайших кормления
          const displayFeedings = futureFeedings.slice(0, 3);
          
          for (const schedule of displayFeedings) {
            const user = usersMap.get(schedule.createdBy) || null;
            const username = createUserLink(user);
            
            const scheduledTime = formatDateTime(schedule.scheduledTime, user?.timezone);
            
            // Рассчитываем время до кормления
            const timeUntil = schedule.scheduledTime.getTime() - now.getTime();
            const hours = Math.floor(timeUntil / (1000 * 60 * 60));
            const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
            
            let timeUntilText = '';
            if (hours > 0) {
              timeUntilText = `через ${hours} ч ${minutes} мин`;
            } else {
              timeUntilText = `через ${minutes} мин`;
            }
            
            message += `⏰ ${scheduledTime} (${timeUntilText}) - ${username}\n`;
          }
          
          if (futureFeedings.length > 3) {
            message += `... и еще ${futureFeedings.length - 3} кормлений\n`;
          }
          
          message += '\n';
        }
      } catch (error) {
        console.error('Ошибка при получении запланированных кормлений:', error);
      }
    }
    

    if (todayFeedings.length === 0) {
      message += '🍽️ Сегодня кормлений еще не было\n\n';
      message += 'Нажмите "🍽️ Собачка поел" на главном экране, чтобы записать кормление.';
    } else {
      message += `📊 Всего кормлений: ${todayFeedings.length}\n\n`;
      
      // Группируем кормления по времени
      todayFeedings.forEach((feeding, index) => {
        const user = usersMap.get(feeding.userId) || null;
        const username = createUserLink(user);
        const timeStr = formatDateTime(feeding.timestamp, user?.timezone);
        
        // Форматируем запись в соответствии с запросом пользователя
        const foodTypeText = feeding.foodType === 'dry' ? 'сухого' : 'мокрого';
        message += `${todayFeedings.length - index}. 🕐 ${timeStr}\n`;
        message += `   ${username} дал ${feeding.amount} грамм ${foodTypeText}\n`;
        
        // Добавляем детали кормления, если они есть
        if (feeding.details) {
          message += `   📝 ${feeding.details}\n`;
        }
        
        if (index < todayFeedings.length - 1) {
          message += '\n';
        }
      });

      // Добавляем статистику
      const totalAmount = todayFeedings.reduce((sum, feeding) => sum + feeding.amount, 0);
      message += `\n📈 *Общий объем:* ${totalAmount}г`;
      
      // Показываем интервалы между кормлениями
      if (todayFeedings.length > 1) {
        const intervals: string[] = [];
        for (let i = 1; i < todayFeedings.length; i++) {
          const prevTime = todayFeedings[i].timestamp.getTime();
          const currentTime = todayFeedings[i - 1].timestamp.getTime();
          const diffMinutes = Math.round((currentTime - prevTime) / (1000 * 60));
          
          if (diffMinutes < 60) {
            intervals.push(`${diffMinutes} мин`);
          } else {
            const hours = Math.floor(diffMinutes / 60);
            const minutes = diffMinutes % 60;
            if (minutes === 0) {
              intervals.push(`${hours} ч`);
            } else {
              intervals.push(`${hours} ч ${minutes} мин`);
            }
          }
        }
        
        if (intervals.length > 0) {
          message += `\n⏱️ Интервалы: ${intervals.join(', ')}`;
        }
      }
    }
    
    // Получаем статистику
    const stats = await globalDatabase.getStats();
    message += `\n\n📊 *Общая статистика:*\n`;
    message += `• Всего кормлений: ${stats.totalFeedings}\n`;
    message += `• Пользователей: ${stats.totalUsers}`;

    ctx.reply(message, Markup.keyboard([
      ['🔄 Обновить'],
      ['⬅️ Назад', '🏠 Главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка при получении истории за сегодня:', error);
    ctx.reply(
      'Произошла ошибка при загрузке истории кормлений. Попробуйте позже.',
      Markup.keyboard([
        ['🏠 Главный экран']
      ]).resize()
    );
  }
});

// Обработка кнопки "Обновить"
todayHistoryScene.hears(/🔄 Обновить/, async (ctx) => {
  // Просто перезаходим в сцену для обновления данных
  await ctx.scene.reenter();
});

// Обработка кнопки "Вся история"
todayHistoryScene.hears(/📋 Вся история/, (ctx) => {
  ctx.scene.enter(SCENES.HISTORY);
});

// Обработка кнопки "Назад"
todayHistoryScene.hears(/⬅️ Назад/, (ctx) => {
  ctx.scene.enter(SCENES.HISTORY);
});

// Обработка кнопки "Главный экран"
todayHistoryScene.hears(/🏠 Главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка команды /home
todayHistoryScene.command('home', (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка команды /status
todayHistoryScene.command('status', async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована.');
      return;
    }

    const lastFeeding = await globalDatabase.getLastFeeding();
    const stats = await globalDatabase.getStats();
    
    let message = '📊 Статус кормления:\n\n';
    
    if (lastFeeding) {
      const lastUser = await globalDatabase.getUserByTelegramId(ctx.from?.id || 0);
      const username = createUserLink(lastUser);
      message += `🍽️ Последнее кормление:\n`;
      const formattedTime = formatDateTime(lastFeeding.timestamp, lastUser?.timezone);
      
      message += `   Время: ${formattedTime}\n`;
      message += `   Кто: ${username}\n\n`;
    } else {
      message += `🍽️ Кормлений еще не было\n\n`;
    }
    
    message += `📊 Статистика:\n`;
    message += `• Сегодня: ${stats.todayFeedings} кормлений\n`;
    message += `• Всего: ${stats.totalFeedings} кормлений\n`;
    message += `• Пользователей: ${stats.totalUsers}`;
    
    ctx.reply(message);
  } catch (error) {
    console.error('Ошибка в команде /status:', error);
    ctx.reply('Ошибка при получении статуса. Попробуйте позже.');
  }
});

// Обработка неизвестных команд (но не команд, начинающихся с /)
todayHistoryScene.on('text', (ctx) => {
  const text = ctx.message.text;
  // Пропускаем команды, начинающиеся с /
  if (text.startsWith('/')) {
    return;
  }
  
  ctx.reply(
    'Я не понимаю эту команду. Используйте кнопки меню.',
    Markup.keyboard([
      ['🔄 Обновить'],
      ['⬅️ Назад', '🏠 Главный экран']
    ]).resize()
  );
});
