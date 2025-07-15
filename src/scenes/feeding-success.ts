import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getFeedingSuccessKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const feedingSuccessScene = new Scenes.BaseScene<BotContext>(SCENES.FEEDING_SUCCESS);

// Вход в сцену успешного кормления
feedingSuccessScene.enter((ctx) => {
  ctx.reply(MESSAGES.FEEDING_SUCCESS, getFeedingSuccessKeyboard());
});

// Обработка кнопки "Уточнить детали кормления"
feedingSuccessScene.hears(/📝 Уточнить детали кормления/, (ctx) => {
  ctx.scene.enter(SCENES.FEEDING_DETAILS);
});

// Обработка кнопки "Выйти на главный экран"
feedingSuccessScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
feedingSuccessScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки ниже для навигации.',
    getFeedingSuccessKeyboard()
  );
});
