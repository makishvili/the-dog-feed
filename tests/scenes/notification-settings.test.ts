import { Scenes } from 'telegraf';
import {
    notificationSettingsScene,
    setGlobalDatabaseForNotificationSettings,
} from '../../src/scenes/notification-settings';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
    getUserByTelegramId: jest.fn(),
    createUser: jest.fn(),
    getSetting: jest.fn(),
    setSetting: jest.fn(),
    createFeeding: jest.fn(),
    getAllUsers: jest.fn(),
    getLastFeeding: jest.fn(),
    getStats: jest.fn(),
    updateFeedingDetails: jest.fn(),
    updateUserNotifications: jest.fn(),
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

describe('notificationSettingsScene', () => {
    let ctx: any;

    beforeEach(() => {
        // Установка глобальной базы данных для notificationSettingsScene
        setGlobalDatabaseForNotificationSettings(mockDatabase);

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
        it('should show error message when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            await (notificationSettingsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );
        });

        it('should show notification settings menu with enabled notifications', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            await (notificationSettingsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('🔔 уведомления'),
                expect.any(Object)
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Текущий статус: Включены'),
                expect.any(Object)
            );
        });

        it('should show notification settings menu with disabled notifications', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: false,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            await (notificationSettingsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('🔕 уведомления'),
                expect.any(Object)
            );
            expect(ctx.reply).toHaveBeenCalledWith(
                expect.stringContaining('Текущий статус: Выключены'),
                expect.any(Object)
            );
        });

        it('should show error message when user is not found', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            await (notificationSettingsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });

        it('should show error message when database error occurs', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            await (notificationSettingsScene as any).enterMiddleware()[0](ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка получения настроек. Попробуйте еще раз.',
                expect.any(Object)
            );
        });
    });

    describe('hears "🔔 Включить уведомления"', () => {
        it('should show error when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔔 Включить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована'
            );
        });

        it('should show error when user is not found', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔔 Включить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });

        it('should enable notifications and reenter scene', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: false,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.updateUserNotifications = jest
                .fn()
                .mockResolvedValue(undefined);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔔 Включить уведомления')
            );
            await handler.handler(ctx);

            expect(mockDatabase.updateUserNotifications).toHaveBeenCalledWith(
                1,
                true
            );
            expect(ctx.scene.reenter).toHaveBeenCalled();
        });

        it('should show error message when database error occurs during update', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: false,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.updateUserNotifications = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔔 Включить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка сохранения настроек'
            );
        });
    });

    describe('hears "🔕 Выключить уведомления"', () => {
        it('should show error when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔕 Выключить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована'
            );
        });

        it('should show error when user is not found', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔕 Выключить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });

        it('should disable notifications and reenter scene', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.updateUserNotifications = jest
                .fn()
                .mockResolvedValue(undefined);

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔕 Выключить уведомления')
            );
            await handler.handler(ctx);

            expect(mockDatabase.updateUserNotifications).toHaveBeenCalledWith(
                1,
                false
            );
            expect(ctx.scene.reenter).toHaveBeenCalled();
        });

        it('should show error message when database error occurs during update', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.updateUserNotifications = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🔕 Выключить уведомления')
            );
            await handler.handler(ctx);

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка сохранения настроек'
            );
        });
    });

    describe('hears "⬅️ Назад"', () => {
        it('should enter settings scene', async () => {
            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('⬅️ Назад')
            );
            await handler.handler(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
        });
    });

    describe('hears "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            // Получаем обработчики для hears
            const hearsHandlers = (notificationSettingsScene as any)
                .hearsHandlers;
            // Находим нужный обработчик по паттерну
            const handler = hearsHandlers.find((h: any) =>
                h.triggers.includes('🏠 На главную')
            );
            await handler.handler(ctx);

            expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
        });
    });

    describe('on text (unknown command)', () => {
        it('should show menu and prompt to use buttons when database is not initialized', async () => {
            ctx.message = { text: 'Unknown command' };

            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            await (notificationSettingsScene as any).onMiddleware('text')[0](
                ctx
            );

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.'
            );
        });

        it('should show menu with enabled notifications keyboard', async () => {
            ctx.message = { text: 'Unknown command' };

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            await (notificationSettingsScene as any).onMiddleware('text')[0](
                ctx
            );

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });

        it('should show menu with disabled notifications keyboard', async () => {
            ctx.message = { text: 'Unknown command' };

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: false,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            await (notificationSettingsScene as any).onMiddleware('text')[0](
                ctx
            );

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });

        it('should show menu when database error occurs', async () => {
            ctx.message = { text: 'Unknown command' };

            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            await (notificationSettingsScene as any).onMiddleware('text')[0](
                ctx
            );

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.'
            );
        });
    });
});
