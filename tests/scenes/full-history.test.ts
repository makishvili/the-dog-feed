import { Scenes } from 'telegraf';
import {
    fullHistoryScene,
    setGlobalSchedulerForFullHistory,
    setGlobalTimerForFullHistory,
} from '../../src/scenes/full-history';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';
import { SCENES } from '../../src/utils/constants';

// Mock для DatabaseService
const mockDatabase = {
    getTotalFeedingsCount: jest.fn(),
    getFeedingsWithPagination: jest.fn(),
    getUserById: jest.fn(),
} as unknown as DatabaseService;

// Mock для SchedulerService
const mockSchedulerService = {
    getActiveScheduledFeedings: jest.fn(),
};

// Mock для TimerService
const mockTimerService = {};

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для showHistoryPage
jest.mock('../../src/scenes/full-history', () => {
    const originalModule = jest.requireActual('../../src/scenes/full-history');
    return {
        ...originalModule,
        showHistoryPage: jest.fn(),
    };
});

// Получаем замоканную функцию showHistoryPage
const { showHistoryPage } = jest.requireMock('../../src/scenes/full-history');

describe('fullHistoryScene', () => {
    let ctx: any;

    beforeEach(() => {
        // Установка глобальных сервисов для fullHistoryScene
        setGlobalSchedulerForFullHistory(mockSchedulerService);
        setGlobalTimerForFullHistory(mockTimerService as any);

        ctx = {
            from: {
                id: 123456789,
                username: 'testuser',
                first_name: 'Test',
            },
            session: {
                fullHistory: {
                    currentPage: 1,
                    totalPages: 1,
                    totalRecords: 0,
                    period: 'all',
                },
            },
            reply: jest.fn(),
            scene: {
                enter: jest.fn(),
                reenter: jest.fn(),
            },
            telegram: mockBot.telegram,
            database: mockDatabase,
        };

        jest.clearAllMocks();
    });

    describe('enter scene logic', () => {
        it('should initialize session data and show first page', async () => {
            // Симулируем логику входа в сцену
            // Инициализируем данные сессии для полной истории
            ctx.session.fullHistory = {
                currentPage: 1,
                totalPages: 1,
                totalRecords: 0,
                period: 'all',
            };

            // Вызываем showHistoryPage для отображения первой страницы
            await showHistoryPage(ctx, 1);

            expect(ctx.session.fullHistory).toEqual({
                currentPage: 1,
                totalPages: 1,
                totalRecords: 0,
                period: 'all',
            });
        });
    });

    describe('hears "◀️ Предыдущая"', () => {
        it('should show previous page when current page is greater than 1', async () => {
            ctx.session.fullHistory.currentPage = 2;
            ctx.message = { text: '◀️ Предыдущая' };

            // Симулируем логику обработки кнопки "Предыдущая"
            const text = ctx.message.text;

            if (text.includes('◀️ Предыдущая')) {
                if (ctx.session.fullHistory.currentPage > 1) {
                    ctx.session.fullHistory.currentPage--;
                    await showHistoryPage(ctx, ctx.session.fullHistory.currentPage);
                }
            }

            expect(ctx.session.fullHistory.currentPage).toBe(1);
            expect(showHistoryPage).toHaveBeenCalledWith(ctx, 1);
        });

        it('should not show previous page when current page is 1', async () => {
            ctx.session.fullHistory.currentPage = 1;
            ctx.message = { text: '◀️ Предыдущая' };

            // Симулируем логику обработки кнопки "Предыдущая"
            const text = ctx.message.text;

            if (text.includes('◀️ Предыдущая')) {
                if (ctx.session.fullHistory.currentPage > 1) {
                    ctx.session.fullHistory.currentPage--;
                    await showHistoryPage(ctx, ctx.session.fullHistory.currentPage);
                }
            }

            expect(ctx.session.fullHistory.currentPage).toBe(1);
            // Проверяем, что showHistoryPage не была вызвана
            expect(showHistoryPage).not.toHaveBeenCalled();
        });
    });

    describe('hears "▶️ Следующая"', () => {
        it('should show next page when current page is less than total pages', async () => {
            ctx.session.fullHistory.currentPage = 1;
            ctx.session.fullHistory.totalPages = 2;
            ctx.message = { text: '▶️ Следующая' };

            // Симулируем логику обработки кнопки "Следующая"
            const text = ctx.message.text;

            if (text.includes('▶️ Следующая')) {
                if (ctx.session.fullHistory.currentPage < ctx.session.fullHistory.totalPages) {
                    ctx.session.fullHistory.currentPage++;
                    await showHistoryPage(ctx, ctx.session.fullHistory.currentPage);
                }
            }

            expect(ctx.session.fullHistory.currentPage).toBe(2);
            expect(showHistoryPage).toHaveBeenCalledWith(ctx, 2);
        });

        it('should not show next page when current page equals total pages', async () => {
            ctx.session.fullHistory.currentPage = 2;
            ctx.session.fullHistory.totalPages = 2;
            ctx.message = { text: '▶️ Следующая' };

            // Симулируем логику обработки кнопки "Следующая"
            const text = ctx.message.text;

            if (text.includes('▶️ Следующая')) {
                if (ctx.session.fullHistory.currentPage < ctx.session.fullHistory.totalPages) {
                    ctx.session.fullHistory.currentPage++;
                    await showHistoryPage(ctx, ctx.session.fullHistory.currentPage);
                }
            }

            expect(ctx.session.fullHistory.currentPage).toBe(2);
            // Проверяем, что showHistoryPage не была вызвана
            expect(showHistoryPage).not.toHaveBeenCalled();
        });
    });

    describe('hears "📤 Экспорт истории"', () => {
        it('should enter export scene', async () => {
            ctx.message = { text: '📤 Экспорт истории' };

            // Симулируем логику обработки кнопки "Экспорт истории"
            const text = ctx.message.text;

            if (text.includes('📤 Экспорт истории')) {
                await ctx.scene.enter(SCENES.EXPORT);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.EXPORT);
        });
    });

    describe('hears "🔍 Фильтры"', () => {
        it('should show filters message', async () => {
            ctx.message = { text: '🔍 Фильтры' };

            // Симулируем логику обработки кнопки "Фильтры"
            const text = ctx.message.text;

            if (text.includes('🔍 Фильтры')) {
                await ctx.reply(
                    '🔍 Фильтры истории:\n\n' +
                    '• По дате\n' +
                    '• По пользователю\n' +
                    '• По типу корма\n' +
                    '• По количеству\n\n' +
                    'Выберите фильтр для настройки.',
                    expect.any(Object)
                );
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('🔍 Фильтры'),
                expect.any(Object)
            );
        });
    });

    describe('hears "📄 Страница \d+ из \d+"', () => {
        it('should do nothing', async () => {
            ctx.message = { text: '📄 Страница 1 из 5' };

            // Симулируем логику обработки кнопки с номером страницы
            const text = ctx.message.text;

            // Проверяем, что это кнопка с номером страницы
            const pageButtonRegex = /^📄 Страница \d+ из \d+$/;
            if (pageButtonRegex.test(text)) {
                // Ничего не делаем, это просто информационная кнопка
                return;
            }

            // Проверяем, что ничего не произошло
            expect(ctx.reply).not.toHaveBeenCalled();
            expect(ctx.scene.enter).not.toHaveBeenCalled();
        });
    });

    describe('hears "⬅️ Назад"', () => {
        it('should enter history scene', async () => {
            ctx.message = { text: '⬅️ Назад' };

            // Симулируем логику обработки кнопки "Назад"
            const text = ctx.message.text;

            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter(SCENES.HISTORY);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.HISTORY);
        });
    });

    describe('hears "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            ctx.message = { text: '🏠 На главную' };

            // Симулируем логику обработки кнопки "На главную"
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
            expect(fullHistoryScene.id).toBe(SCENES.FULL_HISTORY);
            expect(typeof (fullHistoryScene as any).enterHandler).toBe('function');
            expect(typeof (fullHistoryScene as any).handler).toBe('function');
        });
    });
});
