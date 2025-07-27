import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { SCENES } from '../utils/constants';

export const notificationSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.NOTIFICATION_SETTINGS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForNotificationSettings(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену настроек уведомлений
notificationSettingsScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    const statusText = user.notificationsEnabled ? 'Включены' : 'Выключены';
    const statusEmoji = user.notificationsEnabled ? '🔔' : '🔕';
    
    const message = `${statusEmoji} уведомления\n\n` +
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
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована');
      return;
    }

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    await globalDatabase.updateUserNotifications(user.id, true);

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
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована');
      return;
    }

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    if (!user) {
      ctx.reply('❌ Ошибка: пользователь не найден');
      return;
    }

    await globalDatabase.updateUserNotifications(user.id, false);

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
    if (!globalDatabase) {
      ctx.reply('Используйте кнопки меню для навигации.');
      return;
    }

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
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
