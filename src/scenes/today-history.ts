import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { SCENES } from '../utils/constants';
import { DatabaseService, DatabaseFeeding, DatabaseUser } from '../services/database';

export const todayHistoryScene = new Scenes.BaseScene<BotContext>(SCENES.TODAY_HISTORY);

// Глобальные переменные для доступа к сервисам
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForTodayHistory(database: DatabaseService) {
  globalDatabase = database;
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

    let message = '📅 История кормлений за сегодня\n\n';

    if (todayFeedings.length === 0) {
      message += '🍽️ Сегодня кормлений еще не было\n\n';
      message += 'Нажмите "🍽️ Я покормил" на главном экране, чтобы записать кормление.';
    } else {
      message += `📊 Всего кормлений: ${todayFeedings.length}\n\n`;
      
      // Группируем кормления по времени
      todayFeedings.forEach((feeding, index) => {
        const user = usersMap.get(feeding.userId);
        const timeStr = feeding.timestamp.toLocaleString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        
        message += `${index + 1}. 🕐 ${timeStr}\n`;
        message += `   👤 ${user?.username || 'Неизвестный пользователь'}\n`;
        message += `   🍽️ ${feeding.foodType} корм, ${feeding.amount}г\n`;
        
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
      message += `\n📈 Общий объем: ${totalAmount}г`;
      
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
    message += `\n\n📊 Общая статистика:\n`;
    message += `• Всего кормлений: ${stats.totalFeedings}\n`;
    message += `• Пользователей: ${stats.totalUsers}`;

    ctx.reply(message, Markup.keyboard([
      ['🔄 Обновить', '📋 Вся история'],
      ['🏠 Главный экран']
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
      message += `🍽️ Последнее кормление:\n`;
      message += `   Время: ${lastFeeding.timestamp.toLocaleString('ru-RU')}\n`;
      message += `   Кто: ${lastUser?.username || 'Неизвестно'}\n\n`;
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
      ['🔄 Обновить', '📋 Вся история'],
      ['🏠 Главный экран']
    ]).resize()
  );
});
