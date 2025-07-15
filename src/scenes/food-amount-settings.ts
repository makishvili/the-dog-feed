import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { SCENES } from '../utils/constants';

export const foodAmountSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_AMOUNT_SETTINGS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFoodAmountSettings(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену настройки количества корма
foodAmountSettingsScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    const currentAmount = await globalDatabase.getSetting('default_food_amount') || '12';
    
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
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована');
      return;
    }

    await globalDatabase.setSetting('default_food_amount', amount.toString());
    
    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Количество корма изменено на ${amount} граммов\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await globalDatabase.getAllUsers();
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