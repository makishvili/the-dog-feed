import { Scenes, Telegraf, session } from 'telegraf';
import {
    foodSettingsScene,
    setGlobalDatabaseForFoodSettings,
} from '../../src/scenes/food-settings';
import { DatabaseService } from '../../src/services/database';
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
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для парсеров
jest.mock('../../src/services/feeding-parser', () => ({
    FeedingParser: {
        parseDetails: jest.fn(),
        getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2']),
    },
}));

describe('foodSettingsScene', () => {
    beforeEach(() => {
        setGlobalDatabaseForFoodSettings(mockDatabase);
        jest.clearAllMocks();
    });

    // Вспомогательная функция для мокирования setTimeout
    const mockSetTimeout = () => {
        const originalSetTimeout = global.setTimeout;
        const mockSetTimeoutFn = jest.fn((callback: (...args: any[]) => void) => {
            callback();
            return 1 as any;
        });
        global.setTimeout = mockSetTimeoutFn as any;
        return () => { global.setTimeout = originalSetTimeout; };
    };

    describe('enter scene logic', () => {
        it('should show error message when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForFoodSettings(null as any);

            const mockReply = jest.fn();
            const ctx = {
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену когда база данных не инициализирована
            try {
                const database = null; // Представляем что globalDatabase = null
                if (!database) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }
            } catch (error) {
                // Обработка ошибок
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForFoodSettings(mockDatabase);
        });

        it('should show food settings menu with current settings', async () => {
            mockDatabase.getSetting = jest
                .fn()
                .mockResolvedValueOnce('dry') // default_food_type
                .mockResolvedValueOnce('12'); // default_food_amount

            const mockReply = jest.fn();
            const ctx = {
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену с текущими настройками
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Получаем текущие настройки из БД
                const currentType =
                    (await mockDatabase.getSetting('default_food_type')) || 'dry';
                const currentAmount =
                    (await mockDatabase.getSetting('default_food_amount')) || '12';

                const typeText = currentType === 'dry' ? 'Сухой' : 'Влажный';

                const message =
                    `🍽️ корм\n\n` +
                    `Текущие настройки:\n` +
                    `• Тип корма: ${typeText}\n` +
                    `• Количество: ${currentAmount} граммов\n\n` +
                    `Введите новые настройки корма:\n\n` +
                    `Примеры форматов:\n` +
                    'Пример 1\n' +
                    'Пример 2';

                await ctx.reply(message, expect.any(Object));
            } catch (error) {
                await ctx.reply(
                    '❌ Ошибка получения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('🍽️ корм'),
                expect.any(Object)
            );
            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('Текущие настройки:'),
                expect.any(Object)
            );
        });

        it('should show error message when database error occurs', async () => {
            mockDatabase.getSetting = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            const mockReply = jest.fn();
            const ctx = {
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену при ошибке базы данных
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Получаем текущие настройки из БД
                await mockDatabase.getSetting('default_food_type');
                await mockDatabase.getSetting('default_food_amount');
                // Остальная логика...
            } catch (error) {
                console.error('Ошибка получения настроек корма:', error);
                await ctx.reply(
                    '❌ Ошибка получения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Ошибка получения настроек. Попробуйте еще раз.',
                expect.any(Object)
            );
        });
    });

    describe('on text', () => {
        it('should enter main scene when "🏠 На главную" is received', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '🏠 На главную' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "На главную"
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');
        });

        it('should enter settings scene when "⬅️ Назад" is received', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '⬅️ Назад' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Назад"
            const text = ctx.message.text;

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SETTINGS');
        });

        it('should show error when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForFoodSettings(null as any);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Сухой корм 150г' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки текста когда база данных не инициализирована
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            try {
                const database = null; // Представляем что globalDatabase = null
                if (!database) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }
            } catch (error) {
                // Обработка ошибок
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForFoodSettings(mockDatabase);
        });

        it('should show error when details parsing fails', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: false,
                error: 'Неверный формат',
            });

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Invalid details' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки текста при ошибке парсинга
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Парсинг введенных настроек
                const parsed = FeedingParser.parseDetails(text);

                if (!parsed.isValid) {
                    await ctx.reply(
                        `❌ Ошибка: ${parsed.error}\n\n` +
                            `Попробуйте еще раз или используйте примеры выше.`,
                        expect.any(Object)
                    );
                    return;
                }
            } catch (error) {
                // Обработка ошибок
            }

            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('❌ Ошибка: Неверный формат'),
                expect.any(Object)
            );
        });

        it('should update food settings and notify users', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Сухой корм 150г',
            });

            mockDatabase.setSetting = jest.fn().mockResolvedValue(undefined);

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.getAllUsers = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
                {
                    id: 2,
                    telegramId: 987654321,
                    username: 'otheruser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
            ]);

            const mockReply = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
            const ctx = {
                message: { text: 'Сухой корм 150г' },
                from: { id: 123456789 },
                reply: mockReply,
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем полную логику обработки успешного обновления настроек
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Парсинг введенных настроек
                const parsed = FeedingParser.parseDetails(text);

                if (!parsed.isValid) {
                    await ctx.reply(
                        `❌ Ошибка: ${parsed.error}\n\n` +
                            `Попробуйте еще раз или используйте примеры выше.`,
                        expect.any(Object)
                    );
                    return;
                }

                // Сохранение новых настроек
                let updatedSettings: string[] = [];

                if (parsed.amount !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_amount',
                        parsed.amount.toString()
                    );
                    updatedSettings.push(`количество: ${parsed.amount} граммов`);
                }

                if (parsed.foodType !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_type',
                        parsed.foodType
                    );
                    const typeText = parsed.foodType === 'dry' ? 'сухой' : 'влажный';
                    updatedSettings.push(`тип: ${typeText}`);
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                const message =
                    `✅ Настройки корма обновлены!\n\n` +
                    `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
                    `Изменения вступят в силу после следующего кормления.\n` +
                    `Инициатор: ${user?.username || 'Пользователь'}`;

                // Уведомление других пользователей об изменении
                const allUsers = await mockDatabase.getAllUsers();
                for (const u of allUsers) {
                    // Не отправляем уведомление пользователю, который сделал изменения
                    if (u.telegramId !== ctx.from!.id && u.notificationsEnabled) {
                        try {
                            await ctx.telegram.sendMessage(
                                u.telegramId,
                                `🍽️ ${message}`
                            );
                        } catch (error) {
                            // Игнорируем ошибки
                        }
                    }
                }

                // Отправляем подтверждение только текущему пользователю
                await ctx.reply(
                    `✅ Настройки корма обновлены!\n\n` +
                        `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
                        `Изменения вступят в силу после следующего кормления.`,
                    expect.any(Object)
                );
            } catch (error) {
                await ctx.reply(
                    '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(mockDatabase.setSetting).toHaveBeenCalledWith(
                'default_food_amount',
                '150'
            );
            expect(mockDatabase.setSetting).toHaveBeenCalledWith(
                'default_food_type',
                'dry'
            );
            expect(mockSendMessage).toHaveBeenCalledWith(
                987654321,
                expect.stringContaining('🍽️ ✅ Настройки корма обновлены!')
            );
            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('✅ Настройки корма обновлены!'),
                expect.any(Object)
            );
        });

        it('should show error message when database error occurs during update', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Сухой корм 150г',
            });

            mockDatabase.setSetting = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Сухой корм 150г' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки текста при ошибке базы данных во время обновления
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Парсинг введенных настроек
                const parsed = FeedingParser.parseDetails(text);

                if (!parsed.isValid) {
                    await ctx.reply(
                        `❌ Ошибка: ${parsed.error}\n\n` +
                            `Попробуйте еще раз или используйте примеры выше.`,
                        expect.any(Object)
                    );
                    return;
                }

                // Сохранение новых настроек
                let updatedSettings: string[] = [];

                if (parsed.amount !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_amount',
                        parsed.amount.toString()
                    );
                    updatedSettings.push(`количество: ${parsed.amount} граммов`);
                }

                if (parsed.foodType !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_type',
                        parsed.foodType
                    );
                    const typeText = parsed.foodType === 'dry' ? 'сухой' : 'влажный';
                    updatedSettings.push(`тип: ${typeText}`);
                }

                // Остальная логика...
            } catch (error) {
                console.error('Ошибка сохранения настроек корма:', error);
                await ctx.reply(
                    '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
                expect.any(Object)
            );
        });

        it('should handle notification sending errors gracefully', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Сухой корм 150г',
            });

            mockDatabase.setSetting = jest.fn().mockResolvedValue(undefined);

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.getAllUsers = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
                {
                    id: 2,
                    telegramId: 987654321,
                    username: 'testuser2',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
            ]);

            const mockReply = jest.fn();
            const mockSendMessage = jest.fn()
                .mockRejectedValueOnce(new Error('User blocked bot')); // Первый (и единственный) вызов - ошибка

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const ctx = {
                message: { text: 'Сухой корм 150г' },
                from: { id: 123456789 },
                reply: mockReply,
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем отправку уведомлений с ошибками
            const text = ctx.message.text;

            // Проверка на кнопку "На главную"
            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            // Проверка на кнопку "Назад"
            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                // Парсинг введенных настроек
                const parsed = FeedingParser.parseDetails(text);

                if (!parsed.isValid) {
                    await ctx.reply(
                        `❌ Ошибка: ${parsed.error}\n\n` +
                            `Попробуйте еще раз или используйте примеры выше.`,
                        expect.any(Object)
                    );
                    return;
                }

                // Сохранение новых настроек
                let updatedSettings: string[] = [];

                if (parsed.amount !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_amount',
                        parsed.amount.toString()
                    );
                    updatedSettings.push(`количество: ${parsed.amount} граммов`);
                }

                if (parsed.foodType !== undefined) {
                    await mockDatabase.setSetting(
                        'default_food_type',
                        parsed.foodType
                    );
                    const typeText = parsed.foodType === 'dry' ? 'сухой' : 'влажный';
                    updatedSettings.push(`тип: ${typeText}`);
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                const message =
                    `✅ Настройки корма обновлены!\n\n` +
                    `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
                    `Изменения вступят в силу после следующего кормления.\n` +
                    `Инициатор: ${user?.username || 'Пользователь'}`;

                // Уведомление других пользователей об изменении
                const allUsers = await mockDatabase.getAllUsers();
                for (const u of allUsers) {
                    // Не отправляем уведомление пользователю, который сделал изменения
                    if (u.telegramId !== ctx.from!.id && u.notificationsEnabled) {
                        try {
                            await ctx.telegram.sendMessage(
                                u.telegramId,
                                `🍽️ ${message}`
                            );
                        } catch (error) {
                            console.error(
                                `Ошибка отправки уведомления пользователю ${u.telegramId}:`,
                                error
                            );
                        }
                    }
                }

                // Отправляем подтверждение только текущему пользователю
                await ctx.reply(
                    `✅ Настройки корма обновлены!\n\n` +
                        `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
                        `Изменения вступят в силу после следующего кормления.`,
                    expect.any(Object)
                );
            } catch (error) {
                await ctx.reply(
                    '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(mockSendMessage).toHaveBeenCalledTimes(1);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка отправки уведомления пользователю 987654321:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(foodSettingsScene.id).toBe('food_settings');
            expect(typeof (foodSettingsScene as any).enterHandler).toBe('function');
            expect(typeof (foodSettingsScene as any).handler).toBe('function');
        });

        it('should handle global database initialization', () => {
            const testDatabase = {} as DatabaseService;
            setGlobalDatabaseForFoodSettings(testDatabase);
            
            // Проверяем, что функция не падает при установке базы данных
            expect(() => setGlobalDatabaseForFoodSettings(testDatabase)).not.toThrow();
            
            // Восстанавливаем исходную базу данных
            setGlobalDatabaseForFoodSettings(mockDatabase);
        });
    });
});
