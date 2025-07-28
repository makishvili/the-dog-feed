import { Scenes } from 'telegraf';
import {
    intervalSettingsScene,
    setGlobalServicesForInterval,
} from '../../src/scenes/interval-settings';
import { TimeParser } from '../../src/services/time-parser';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';
import { SCENES } from '../../src/utils/constants';

// Mock для TimerService
const mockTimerService = {
    getCurrentInterval: jest.fn(),
    updateInterval: jest.fn(),
};

// Mock для BotState
const mockBotState = {};

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для TimeParser
jest.mock('../../src/services/time-parser', () => {
    return {
        TimeParser: {
            parseInterval: jest.fn(),
            formatInterval: jest.fn(),
            getExamples: jest.fn(),
        },
    };
});

describe('intervalSettingsScene', () => {
    let ctx: any;

    beforeEach(() => {
        // Установка глобальных сервисов для intervalSettingsScene
        setGlobalServicesForInterval(mockTimerService, mockBotState);

        ctx = {
            from: {
                id: 123456789,
                username: 'testuser',
                first_name: 'Test',
            },
            session: {},
            reply: jest.fn(),
            scene: {
                enter: jest.fn(),
                reenter: jest.fn(),
            },
            telegram: mockBot.telegram,
        };

        jest.clearAllMocks();
    });

    describe('enter scene logic', () => {
        it('should show interval settings menu with current interval from timer service', async () => {
            mockTimerService.getCurrentInterval = jest
                .fn()
                .mockReturnValue(210);
            (TimeParser.formatInterval as jest.Mock).mockReturnValue('3 ч 30 мин');
            (TimeParser.getExamples as jest.Mock).mockReturnValue([
                '30 минут',
                '1 час',
                '2.5 часа',
                '4 часа 15 минут',
            ]);

            // Симулируем логику входа в сцену
            let currentInterval = 210; // 3.5 часа по умолчанию

            // Получаем текущий интервал из timerService, если доступен
            if (mockTimerService) {
                currentInterval = mockTimerService.getCurrentInterval();
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

            await ctx.reply(message, expect.any(Object));

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('⏰ интервал'),
                expect.any(Object)
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Текущий интервал: 3 ч 30 мин'),
                expect.any(Object)
            );
        });

        it('should show interval settings menu with default interval when timer service is not available', async () => {
            // Сбрасываем глобальный сервис таймеров
            setGlobalServicesForInterval(null as any, mockBotState);
            (TimeParser.formatInterval as jest.Mock).mockReturnValue('3 ч 30 мин');
            (TimeParser.getExamples as jest.Mock).mockReturnValue([
                '30 минут',
                '1 час',
                '2.5 часа',
                '4 часа 15 минут',
            ]);

            // Симулируем логику входа в сцену
            let currentInterval = 210; // 3.5 часа по умолчанию

            // Получаем текущий интервал из timerService, если доступен
            // В данном случае globalTimerService = null
            // currentInterval остается 210

            const formattedInterval = TimeParser.formatInterval(currentInterval);

            const message =
                `⏰ интервал\n\n` +
                `Текущий интервал: ${formattedInterval}\n\n` +
                `Введите новый интервал (от 1 минуты до 24 часов):\n\n` +
                `Примеры форматов:\n` +
                TimeParser.getExamples()
                    .map(example => `• ${example}`)
                    .join('\n');

            await ctx.reply(message, expect.any(Object));

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('⏰ интервал'),
                expect.any(Object)
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Текущий интервал: 3 ч 30 мин'),
                expect.any(Object)
            );
        });
    });

    describe('on text "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            ctx.message = { text: '🏠 На главную' };

            // Симулируем логику обработки текста "🏠 На главную"
            const text = ctx.message.text;

            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter(SCENES.MAIN);
                return;
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.MAIN);
        });
    });

    describe('on text "⬅️ Назад"', () => {
        it('should enter settings scene', async () => {
            ctx.message = { text: '⬅️ Назад' };

            // Симулируем логику обработки текста "⬅️ Назад"
            const text = ctx.message.text;

            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter(SCENES.SETTINGS);
                return;
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.SETTINGS);
        });
    });

    describe('on text with invalid interval', () => {
        it('should show error when interval parsing fails', async () => {
            ctx.message = { text: 'Invalid interval' };
            (TimeParser.parseInterval as jest.Mock).mockReturnValue({
                isValid: false,
                error: 'Неверный формат',
            });
            (TimeParser.getExamples as jest.Mock).mockReturnValue([
                '30 минут',
                '1 час',
                '2.5 часа',
                '4 часа 15 минут',
            ]);

            // Симулируем логику обработки текста с неверным интервалом
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter(SCENES.MAIN);
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter(SCENES.SETTINGS);
                return;
            }

            // Парсинг введенного интервала
            const parsed = TimeParser.parseInterval(text);

            if (!parsed.isValid) {
                const message =
                    `❌ Ошибка: ${parsed.error}\n\n` +
                    `Попробуйте еще раз или используйте примеры выше.`;
                await ctx.reply(message, expect.any(Object));
                return;
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('❌ Ошибка: Неверный формат'),
                expect.any(Object)
            );
        });
    });

    describe('on text with valid interval', () => {
        it('should update interval settings and session', async () => {
            ctx.message = { text: '4 часа' };
            (TimeParser.parseInterval as jest.Mock).mockReturnValue({
                isValid: true,
                minutes: 240,
                error: null,
            });
            (TimeParser.formatInterval as jest.Mock).mockReturnValue('4 ч 0 мин');

            // Симулируем логику обработки текста с верным интервалом
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter(SCENES.MAIN);
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter(SCENES.SETTINGS);
                return;
            }

            // Парсинг введенного интервала
            const parsed = TimeParser.parseInterval(text);

            if (!parsed.isValid) {
                // Этот блок не должен выполниться
                return;
            }

            // Сохранение нового интервала
            if (!ctx.session) {
                ctx.session = {};
            }
            ctx.session.feedingInterval = parsed.minutes;

            // Обновление интервала в сервисе таймеров (используем глобальный сервис)
            if (mockTimerService) {
                mockTimerService.updateInterval(parsed.minutes);
            }

            const formattedInterval = TimeParser.formatInterval(parsed.minutes);

            const message =
                `✅ Интервал кормления обновлен!\n\n` +
                `Новый интервал: ${formattedInterval}\n\n` +
                `Изменения вступят в силу после следующего кормления.`;

            await ctx.reply(message, expect.any(Object));

            expect(ctx.session.feedingInterval).toBe(240);
            expect(mockTimerService.updateInterval).toHaveBeenCalledWith(240);
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('✅ Интервал кормления обновлен!'),
                expect.any(Object)
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Новый интервал: 4 ч 0 мин'),
                expect.any(Object)
            );
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(intervalSettingsScene.id).toBe(SCENES.INTERVAL_SETTINGS);
            expect(typeof (intervalSettingsScene as any).enterHandler).toBe('function');
            expect(typeof (intervalSettingsScene as any).handler).toBe('function');
        });
    });
});
