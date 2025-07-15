import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { SCENES } from '../utils/constants';

export const foodSettingsScene = new Scenes.BaseScene<BotContext>(SCENES.FOOD_SETTINGS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFoodSettings(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену настроек корма
foodSettingsScene.enter(async (ctx) => {
  try {
    if (!globalDatabase) {
      ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
      return;
    }

    // Получаем текущие настройки из БД
    const currentType = await globalDatabase.getSetting('default_food_type') || 'dry';
    const currentAmount = await globalDatabase.getSetting('default_food_amount') || '12';
    
    const typeText = currentType === 'dry' ? 'Сухой' : 'Влажный';
    
    const message = `🍽️ Настройки корма\n\n` +
      `Текущие настройки:\n` +
      `• Тип корма: ${typeText}\n` +
      `• Количество: ${currentAmount} граммов\n\n` +
      `Выберите что изменить:`;

    ctx.reply(message, Markup.keyboard([
      ['🥘 Тип корма', '⚖️ Количество корма'],
      ['🏠 Выйти на главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения настроек корма:', error);
    ctx.reply(
      '❌ Ошибка получения настроек. Попробуйте еще раз.',
      Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
    );
  }
});

// Обработка кнопки "Тип корма"
foodSettingsScene.hears(/🥘 Тип корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_TYPE_SETTINGS);
});

// Обработка кнопки "Количество корма"
foodSettingsScene.hears(/⚖️ Количество корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_AMOUNT_SETTINGS);
});

// Обработка кнопки "Выйти на главный экран"
foodSettingsScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
foodSettingsScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    Markup.keyboard([
      ['🥘 Тип корма', '⚖️ Количество корма'],
      ['🏠 Выйти на главный экран']
    ]).resize()
  );
}); 