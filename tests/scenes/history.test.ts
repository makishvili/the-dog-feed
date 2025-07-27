import { Scenes } from 'telegraf';
import { historyScene } from '../../src/scenes/history';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

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
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('enter', () => {
        it('should show history menu', async () => {
            await (historyScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '📋 История кормлений\n\nВыберите период для просмотра:',
                expect.any(Object)
            );
        });
    });

    describe('hears "📅 сегодня"', () => {
        it('should enter today history scene', async () => {
            // Получаем обработчики для hears
            const hearsHandlers = (historyScene as any).hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('📅 сегодня')
            );
            await handler.handler(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('TODAY_HISTORY');
        });
    });

    describe('hears "📋 всё время"', () => {
        it('should enter full history scene', async () => {
            // Получаем обработчики для hears
            const hearsHandlers = (historyScene as any).hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('📋 всё время')
            );
            await handler.handler(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('FULL_HISTORY');
        });
    });

    describe('hears "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            // Получаем обработчики для hears
            const hearsHandlers = (historyScene as any).hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🏠 На главную')
            );
            await handler.handler(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
        });
    });

    describe('command "home"', () => {
        it('should enter main scene', async () => {
            ctx.message = { text: '/home' };

            await (historyScene as any).commandMiddleware('home')[0](ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
        });
    });

    describe('on text (unknown command)', () => {
        it('should show menu and prompt to use buttons', async () => {
            ctx.message = { text: 'Unknown command' };

            await (historyScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });

        it('should ignore commands starting with /', async () => {
            ctx.message = { text: '/unknown' };

            await (historyScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.reply).not.toHaveBeenCalled();
        });
    });
});
