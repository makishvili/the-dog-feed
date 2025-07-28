import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { TimeParser } from '../services/time-parser';
import { SCENES } from '../utils/constants';

export const intervalSettingsScene = new Scenes.BaseScene<BotContext>(
    SCENES.INTERVAL_SETTINGS
);

// Глобальные переменные для доступа к сервисам (будут установлены из bot.ts)
let globalTimerService: any = null;
let globalBotState: any = null;

// Функция для установки глобальных сервисов
export function setGlobalServicesForInterval(timerService: any, botState: any) {
    globalTimerService = timerService;
    globalBotState = botState;
}

// Вход в сцену настройки интервала
intervalSettingsScene.enter(ctx => {
    let currentInterval = 210; // 3.5 часа по умолчанию

    // Получаем текущий интервал из timerService, если доступен
    if (globalTimerService) {
        currentInterval = globalTimerService.getCurrentInterval();
    }

    const formattedInterval = TimeParser.formatInterval(currentInterval);

    const message =
        `⏰ интервал\n\n` +
        `Текущий интервал: ${formattedInterval}\n\n` +
        `Введите новый интервал (от 1 минуты до 24 часов):\n\n` +
        `Примеры форматов:\n` +
        TimeParser.getExamples()
            .map(example => `• ${example}`)
            .join('\n');

    ctx.reply(message, Markup.keyboard([['🏠 На главную']]).resize());
});

// Обработка ввода интервала
intervalSettingsScene.on('text', ctx => {
    const text = ctx.message.text;

    // Проверка на кнопку "На главную"
    if (text.includes('🏠 На главную')) {
        ctx.scene.enter(SCENES.MAIN);
        return;
    }

    // Проверка на кнопку "Назад"
    if (text.includes('⬅️ Назад')) {
        ctx.scene.enter(SCENES.SETTINGS);
        return;
    }

    // Парсинг введенного интервала
    const parsed = TimeParser.parseInterval(text);

    if (!parsed.isValid) {
        ctx.reply(
            `❌ Ошибка: ${parsed.error}\n\n` +
                `Попробуйте еще раз или используйте примеры выше.`,
            Markup.keyboard([['🏠 На главную']]).resize()
        );
        return;
    }

    // Сохранение нового интервала
    if (!ctx.session) {
        ctx.session = {};
    }
    ctx.session.feedingInterval = parsed.minutes;

    // Обновление интервала в сервисе таймеров (используем глобальный сервис)
    if (globalTimerService) {
        globalTimerService.updateInterval(parsed.minutes);
        console.log(
            `Интервал обновлен в timerService: ${parsed.minutes} минут`
        );
    } else {
        console.error(
            'globalTimerService не доступен для обновления интервала'
        );
    }

    const formattedInterval = TimeParser.formatInterval(parsed.minutes);

    ctx.reply(
        `✅ Интервал кормления обновлен!\n\n` +
            `Новый интервал: ${formattedInterval}\n\n` +
            `Изменения вступят в силу после следующего кормления.`,
        Markup.keyboard([['⬅️ Назад', '🏠 На главную']]).resize()
    );

    console.log(
        `Интервал кормления изменен на ${parsed.minutes} минут пользователем ${ctx.from?.username || ctx.from?.id}`
    );
});
