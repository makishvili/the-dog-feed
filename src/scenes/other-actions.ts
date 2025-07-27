import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getOtherActionsKeyboard, getScheduleManagementKeyboard, getMainKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';
import { createUserLink } from '../utils/user-utils';

// Глобальные переменные из main.ts
let globalTimerService: any = null;
let globalDatabase: any = null;
let getOrCreateUser: any = null;

// Функция для установки глобальных сервисов
export function setGlobalServicesForOtherActions(timerService: any, database: any, getUserFunc: any) {
  globalTimerService = timerService;
  globalDatabase = database;
  getOrCreateUser = getUserFunc;
}

export const otherActionsScene = new Scenes.BaseScene<BotContext>(SCENES.OTHER_ACTIONS);

// Вход в сцену других действий
otherActionsScene.enter((ctx) => {
  ctx.reply('Выберите действие:', getOtherActionsKeyboard());
});

// Обработка кнопки "Завершить кормления на сегодня"
otherActionsScene.hears(/⏹️ Завершить кормления на сегодня/, async (ctx) => {
  try {
    if (!globalTimerService || !globalDatabase) {
      ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
      return;
    }

    const user = await getOrCreateUser(
      ctx.from!.id,
      ctx.from!.username || ctx.from!.first_name
    );

    globalTimerService.stopAllTimers();

    // Создаем объект, соответствующий интерфейсу DatabaseUser
    const dbUser = {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      notificationsEnabled: user.notificationsEnabled,
      feedingInterval: user.feedingInterval || 210, // Значение по умолчанию
      createdAt: new Date()
    };

    const message = `${MESSAGES.FEEDINGS_STOPPED}\n` +
      `Инициатор: ${createUserLink(dbUser)}\n\n` +
      `Чтобы возобновить кормления, нажмите "🍽️ Собачка поел"`;

    // Уведомление всех пользователей через базу данных
    const allUsers = await globalDatabase.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, message);
        } catch (error) {
          console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Кормления остановлены пользователем: ${user.username}`);
    
    // Остаемся на главном экране
    ctx.reply('Возвращаемся на главный экран', getMainKeyboard());
  } catch (error) {
    console.error('Ошибка при остановке кормлений:', error);
    ctx.reply('Произошла ошибка при остановке кормлений. Попробуйте еще раз.');
  }
});

// Обработка кнопки "Внеочередные кормления"
otherActionsScene.hears(/📅 Внеочередные кормления/, (ctx) => {
  // Переходим в сцену управления расписанием
  // Но сначала нужно показать клавиатуру управления расписанием
  ctx.reply(
    '📅 Внеочередные кормления\n\n' +
    'Выберите действие:',
    getScheduleManagementKeyboard()
  );
});

// Обработка подкнопок управления расписанием
otherActionsScene.hears(/📅 Запланировать кормление/, (ctx) => {
  ctx.scene.enter(SCENES.SCHEDULE_FEEDING);
});

otherActionsScene.hears(/📋 Просмотреть запланированные/, (ctx) => {
  ctx.scene.enter(SCENES.SCHEDULED_LIST);
});

otherActionsScene.hears(/❌ Отменить запланированные/, (ctx) => {
  ctx.scene.enter(SCENES.SCHEDULED_LIST);
});

// Обработка кнопки "История кормлений"
otherActionsScene.hears(/📋 История кормлений/, (ctx) => {
  ctx.scene.enter(SCENES.HISTORY);
});

// Обработка кнопки "Настройки"
otherActionsScene.hears(/⚙️ Настройки/, (ctx) => {
  ctx.scene.enter(SCENES.SETTINGS);
});

// Обработка кнопки "На главную"
otherActionsScene.hears(/🏠 На главную/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка кнопки "🏠 На главную" для управления расписанием
otherActionsScene.hears(/📋 На главную к списку/, (ctx) => {
  ctx.scene.enter(SCENES.SCHEDULED_LIST);
});

// Обработка неизвестных команд
otherActionsScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    getOtherActionsKeyboard()
  );
});
