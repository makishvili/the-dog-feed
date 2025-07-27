import { Scenes } from 'telegraf';
import {
    feedingDetailsScene,
    setGlobalDatabaseForFeedingDetails,
} from '../../src/scenes/feeding-details';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
    getUserByTelegramId: jest.fn(),
    createUser: jest.fn(),
    getSetting: jest.fn(),
    createFeeding: jest.fn(),
    getAllUsers: jest.fn(),
    getLastFeeding: jest.fn(),
    getStats: jest.fn(),
    updateFeedingDetails: jest.fn(),
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

describe('feedingDetailsScene', () => {
    let ctx: any;

    beforeEach(() => {
        // Установка глобальной базы данных для feedingDetailsScene
        setGlobalDatabaseForFeedingDetails(mockDatabase);

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
        it('should show error message when no lastFeedingId in session', async () => {
            ctx.session.lastFeedingId = null;

            await (feedingDetailsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Не найдено кормление для уточнения деталей.',
                expect.any(Object)
            );
        });

        it('should show details input message when lastFeedingId exists', async () => {
            ctx.session.lastFeedingId = 1;

            await (feedingDetailsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('📝 Уточнение деталей кормления'),
                expect.any(Object)
            );
        });
    });

    describe('on text', () => {
        it('should enter main scene when "🏠 На главную" is received', async () => {
            ctx.message = { text: '🏠 На главную' };
            ctx.session.lastFeedingId = 1;

            await (feedingDetailsScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
        });

        it('should show error when no lastFeedingId in session', async () => {
            ctx.message = { text: 'Some details' };
            ctx.session.lastFeedingId = null;

            await (feedingDetailsScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: не найдено кормление для обновления'
            );
        });

        it('should show error when database is not initialized', async () => {
            ctx.message = { text: 'Some details' };
            ctx.session.lastFeedingId = 1;

            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForFeedingDetails(null as any);

            await (feedingDetailsScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: база данных не инициализирована'
            );
        });

        it('should show error when details parsing fails', async () => {
            ctx.message = { text: 'Invalid details' };
            ctx.session.lastFeedingId = 1;

            // Мокаем FeedingParser для возврата ошибки
            jest.mock('../../src/services/feeding-parser', () => {
                return {
                    FeedingParser: {
                        parseDetails: jest.fn().mockReturnValue({
                            isValid: false,
                            error: 'Неверный формат',
                        }),
                        getExamples: jest
                            .fn()
                            .mockReturnValue(['Пример 1', 'Пример 2']),
                    },
                };
            });

            await (feedingDetailsScene as any).onMiddleware('text')[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('❌ Ошибка: Неверный формат'),
                expect.any(Object)
            );
        });

        it('should update feeding details and notify users', async () => {
            ctx.message = { text: 'Сухой корм 150г' };
            ctx.session.lastFeedingId = 1;

            // Мокаем FeedingParser для успешного парсинга
            jest.mock('../../src/services/feeding-parser', () => {
                return {
                    FeedingParser: {
                        parseDetails: jest.fn().mockReturnValue({
                            isValid: true,
                            amount: 150,
                            foodType: 'dry',
                            details: 'Сухой корм 150г',
                        }),
                        getExamples: jest
                            .fn()
                            .mockReturnValue(['Пример 1', 'Пример 2']),
                    },
                };
            });

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.updateFeedingDetails = jest
                .fn()
                .mockResolvedValueOnce(undefined);

            mockDatabase.getAllUsers = jest.fn().mockResolvedValueOnce([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
            ]);

            await (feedingDetailsScene as any).onMiddleware('text')[0](ctx);

            expect(mockDatabase.updateFeedingDetails).toHaveBeenCalledWith(
                1,
                150,
                'dry',
                'Сухой корм 150г'
            );
            expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
                123456789,
                expect.stringContaining('✅ Детали кормления обновлены!')
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('✅ Детали кормления обновлены!'),
                expect.any(Object)
            );
        });
    });
});
