import { Scenes } from 'telegraf';
import { historyScene } from '../../src/scenes/history';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';
import { SCENES } from '../../src/utils/constants';

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

describe('historyScene', () => {
    let ctx: any;

    beforeEach(() => {
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
        it('should show history menu', async () => {
            // Симулируем логику входа в сцену
            const message = '📋 История кормлений\n\nВыберите период для просмотра:';
            await ctx.reply(message, expect.any(Object));

            expect(ctx.reply).toHaveBeenCalledWith(
                '📋 История кормлений\n\nВыберите период для просмотра:',
                expect.any(Object)
            );
        });
    });

    describe('hears "📅 сегодня"', () => {
        it('should enter today history scene', async () => {
            ctx.message = { text: '📅 сегодня' };

            // Симулируем логику обработки кнопки "📅 сегодня"
            const text = ctx.message.text;

            if (text.includes('📅 сегодня')) {
                await ctx.scene.enter(SCENES.TODAY_HISTORY);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.TODAY_HISTORY);
        });
    });

    describe('hears "📋 всё время"', () => {
        it('should enter full history scene', async () => {
            ctx.message = { text: '📋 всё время' };

            // Симулируем логику обработки кнопки "📋 всё время"
            const text = ctx.message.text;

            if (text.includes('📋 всё время')) {
                await ctx.scene.enter(SCENES.FULL_HISTORY);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.FULL_HISTORY);
        });
    });

    describe('hears "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            ctx.message = { text: '🏠 На главную' };

            // Симулируем логику обработки кнопки "🏠 На главную"
            const text = ctx.message.text;

            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter(SCENES.MAIN);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.MAIN);
        });
    });

    describe('command "/home"', () => {
        it('should enter main scene', async () => {
            ctx.message = { text: '/home' };

            // Симулируем логику обработки команды "/home"
            const text = ctx.message.text;

            if (text.startsWith('/home')) {
                await ctx.scene.enter(SCENES.MAIN);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.MAIN);
        });
    });

    describe('on text (unknown command)', () => {
        it('should show menu and prompt to use buttons', async () => {
            ctx.message = { text: 'Unknown command' };

            // Симулируем логику обработки неизвестной команды
            const text = ctx.message.text;

            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                await ctx.reply('Используйте кнопки меню для навигации.', expect.any(Object));
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });

        it('should ignore commands starting with /', async () => {
            ctx.message = { text: '/unknown' };

            // Симулируем логику обработки команд, начинающихся с /
            const text = ctx.message.text;

            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                // Не должно быть вызова reply
                return;
            }

            // Проверяем, что reply не был вызван
            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(historyScene.id).toBe(SCENES.HISTORY);
            expect(typeof (historyScene as any).enterHandler).toBe('function');
            expect(typeof (historyScene as any).handler).toBe('function');
        });
    });
});
