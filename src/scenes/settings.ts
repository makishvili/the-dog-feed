import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getSettingsKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';
import { TimeParser } from '../services/parser';

export const settingsScene = new Scenes.BaseScene<BotContext>(SCENES.SETTINGS);

// Вход в сцену настроек
settingsScene.enter((ctx) => {
  ctx.reply(MESSAGES.SETTINGS_PLACEHOLDER, getSettingsKeyboard());
});

// Обработка кнопки "Настройки корма"
settingsScene.hears(/🍽️ Настройки корма/, (ctx) => {
  ctx.scene.enter(SCENES.FOOD_SETTINGS);
});

// Обработка кнопки "Настройки интервала кормления"
settingsScene.hears(/⏰ Настройки интервала кормления/, (ctx) => {
  ctx.scene.enter(SCENES.INTERVAL_SETTINGS);
});

settingsScene.hears(/🔔 Настройки уведомлений/, (ctx) => {
  ctx.scene.enter(SCENES.NOTIFICATION_SETTINGS);
});

// Обработка кнопки "Выйти на главный экран"
settingsScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
settingsScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    getSettingsKeyboard()
  );
});
