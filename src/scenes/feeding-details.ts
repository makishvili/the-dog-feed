import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { FeedingParser } from '../services/feeding-parser';
import { SCENES } from '../utils/constants';

export const feedingDetailsScene = new Scenes.BaseScene<BotContext>(SCENES.FEEDING_DETAILS);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFeedingDetails(database: DatabaseService) {
  globalDatabase = database;
}

// Вход в сцену уточнения деталей
feedingDetailsScene.enter(async (ctx) => {
  // Получаем ID последнего кормления из сессии
  const lastFeedingId = ctx.session?.lastFeedingId;
  
  if (!lastFeedingId) {
    ctx.reply(
      '❌ Не найдено кормление для уточнения деталей.',
      Markup.keyboard([['🏠 Главный экран']]).resize()
    );
    return;
  }

  const message = `📝 Уточнение деталей кормления\n\n` +
    `Введите детали кормления в любом удобном формате:\n\n` +
    `Примеры:\n` +
    FeedingParser.getExamples().map(example => `• ${example}`).join('\n') + '\n\n' +
    `Или опишите причину, если не кормили.`;

  ctx.reply(message, Markup.keyboard([
    ['🏠 Выйти на главный экран']
  ]).resize());
});

// Обработка ввода деталей
feedingDetailsScene.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Проверка на кнопку "Выйти на главный экран"
  if (text.includes('🏠 Выйти на главный экран')) {
    ctx.scene.enter(SCENES.MAIN);
    return;
  }

  const lastFeedingId = ctx.session?.lastFeedingId;
  if (!lastFeedingId) {
    ctx.reply('❌ Ошибка: не найдено кормление для обновления');
    return;
  }

  if (!globalDatabase) {
    ctx.reply('❌ Ошибка: база данных не инициализирована');
    return;
  }

  try {
    // Парсинг введенных деталей
    const parsed = FeedingParser.parseDetails(text);

    if (!parsed.isValid && parsed.error) {
      ctx.reply(
        `❌ Ошибка: ${parsed.error}\n\nПопробуйте еще раз или используйте примеры выше.`,
        Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
      );
      return;
    }

    // Обновляем запись о кормлении в БД
    await globalDatabase.updateFeedingDetails(
      lastFeedingId,
      parsed.amount,
      parsed.foodType,
      parsed.details
    );

    const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);

    // Формируем сообщение об обновлении
    let updateMessage = `✅ Детали кормления обновлены!\n\n`;
    updateMessage += `📝 Детали: ${parsed.details}\n`;
    updateMessage += `👤 Кто: ${user?.username || 'Пользователь'}`;

    // Уведомляем всех пользователей об обновлении
    const allUsers = await globalDatabase.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `📝 ${updateMessage}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Детали кормления обновлены: ${parsed.details} пользователем ${user?.username}`);

    // Очищаем ID кормления из сессии
    if (ctx.session) {
      delete ctx.session.lastFeedingId;
    }

    // Возврат на главный экран
    setTimeout(() => {
      ctx.scene.enter(SCENES.MAIN);
    }, 2000);

  } catch (error) {
    console.error('Ошибка обновления деталей кормления:', error);
    ctx.reply(
      '❌ Произошла ошибка при сохранении деталей. Попробуйте еще раз.',
      Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
    );
  }
}); 