import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { SCENES } from '../utils/constants';

export const foodTypeSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_TYPE_SETTINGS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFoodTypeSettings(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену выбора типа корма
foodTypeSettingsScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    const currentType = await globalDatabase.getSetting('default_food_type') || 'dry';
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
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована');
      return;
    }

    await globalDatabase.setSetting('default_food_type', 'dry');
    
    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Тип корма изменен на "Сухой"\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await globalDatabase.getAllUsers();
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
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована');
      return;
    }

    await globalDatabase.setSetting('default_food_type', 'wet');
    
    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
    
    const message = `✅ Тип корма изменен на "Влажный"\n\n` +
      `Изменения применятся к следующим кормлениям.\n` +
      `Инициатор: ${user?.username || 'Пользователь'}`;

    // Уведомление всех пользователей об изменении
    const allUsers = await globalDatabase.getAllUsers();
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