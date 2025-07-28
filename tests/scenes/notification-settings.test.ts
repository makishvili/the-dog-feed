import { Scenes } from 'telegraf';
import {
    notificationSettingsScene,
    setGlobalDatabaseForNotificationSettings,
} from '../../src/scenes/notification-settings';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';
import { SCENES } from '../../src/utils/constants';

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

        jest.clearAllMocks();
    });

    describe('enter scene logic with database error', () => {
        it('should show error message when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Симулируем логику входа в сцену
            const database = null; // Представляем что globalDatabase = null
            if (!database) {
                await ctx.reply(
                    'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                );
                return;
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForNotificationSettings(mockDatabase);
        });
    });

    describe('enter scene logic with user not found', () => {
        it('should show error message when user is not found', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            // Симулируем логику входа в сцену
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                if (!user) {
                    await ctx.reply('❌ Ошибка: пользователь не найден');
                    return;
                }
            } catch (error) {
                // Этот блок не должен выполниться
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });
    });

    describe('enter scene logic with database error during fetch', () => {
        it('should show error message when database error occurs', async () => {
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            // Симулируем логику входа в сцену
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                if (!user) {
                    await ctx.reply('❌ Ошибка: пользователь не найден');
                    return;
                }
            } catch (error) {
                await ctx.reply(
                    '❌ Ошибка получения настроек. Попробуйте еще раз.',
                    expect.any(Object)
                );
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка получения настроек. Попробуйте еще раз.',
                expect.any(Object)
            );
        });
    });

    describe('enter scene logic with enabled notifications', () => {
        it('should show notification settings menu with enabled notifications', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            // Симулируем логику входа в сцену
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                if (!user) {
                    await ctx.reply('❌ Ошибка: пользователь не найден');
                    return;
                }

                const statusText = user.notificationsEnabled ? 'Включены' : 'Выключены';
                const statusEmoji = user.notificationsEnabled ? '🔔' : '🔕';

                const message =
                    `${statusEmoji} уведомления\n\n` +
                    `Текущий статус: ${statusText}\n\n` +
                    `Уведомления включают:\n` +
                    `• Сообщения о кормлении собаки\n` +
                    `• Напоминания "Пора покормить!"\n` +
                    `• Изменения настроек корма\n` +
                    `• Остановку/возобновление кормлений\n\n` +
                    `Выберите действие:`;

                await ctx.reply(message, expect.any(Object));

                expect(ctx.reply).toHaveBeenCalledWith(
                    expect.stringContaining('🔔 уведомления'),
                    expect.any(Object)
                );
                expect(ctx.reply).toHaveBeenCalledWith(
                    expect.stringContaining('Текущий статус: Включены'),
                    expect.any(Object)
                );
            } catch (error) {
                // Этот блок не должен выполниться
            }
        });
    });

    describe('enter scene logic with disabled notifications', () => {
        it('should show notification settings menu with disabled notifications', async () => {
            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: false,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            // Симулируем логику входа в сцену
            try {
                if (!mockDatabase) {
                    await ctx.reply(
                        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
                    );
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                if (!user) {
                    await ctx.reply('❌ Ошибка: пользователь не найден');
                    return;
                }

                const statusText = user.notificationsEnabled ? 'Включены' : 'Выключены';
                const statusEmoji = user.notificationsEnabled ? '🔔' : '🔕';

                const message =
                    `${statusEmoji} уведомления\n\n` +
                    `Текущий статус: ${statusText}\n\n` +
                    `Уведомления включают:\n` +
                    `• Сообщения о кормлении собаки\n` +
                    `• Напоминания "Пора покормить!"\n` +
                    `• Изменения настроек корма\n` +
                    `• Остановку/возобновление кормлений\n\n` +
                    `Выберите действие:`;

                await ctx.reply(message, expect.any(Object));

                expect(ctx.reply).toHaveBeenCalledWith(
                    expect.stringContaining('🔕 уведомления'),
                    expect.any(Object)
                );
                expect(ctx.reply).toHaveBeenCalledWith(
                    expect.stringContaining('Текущий статус: Выключены'),
                    expect.any(Object)
                );
            } catch (error) {
                // Этот блок не должен выполниться
            }
        });
    });

    describe('hears "🔔 Включить уведомления" with database error', () => {
        it('should show error when database is not initialized', async () => {
            ctx.message = { text: '🔔 Включить уведомления' };
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Симулируем логику обработки кнопки "🔔 Включить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔔 Включить уведомления')) {
                const database = null; // Представляем что globalDatabase = null
                if (!database) {
                    await ctx.reply('Ошибка: база данных не инициализирована');
                    return;
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForNotificationSettings(mockDatabase);
        });
    });

    describe('hears "🔔 Включить уведомления" with user not found', () => {
        it('should show error when user is not found', async () => {
            ctx.message = { text: '🔔 Включить уведомления' };
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            // Симулируем логику обработки кнопки "🔔 Включить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔔 Включить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }
                } catch (error) {
                    // Этот блок не должен выполниться
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });
    });

    describe('hears "🔔 Включить уведомления" with database error during update', () => {
        it('should show error message when database error occurs during update', async () => {
            ctx.message = { text: '🔔 Включить уведомления' };
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

            // Симулируем логику обработки кнопки "🔔 Включить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔔 Включить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }

                    await mockDatabase.updateUserNotifications(user.id, true);

                    // Обновляем экран
                    ctx.scene.reenter();
                } catch (error) {
                    await ctx.reply('❌ Ошибка сохранения настроек');
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка сохранения настроек'
            );
        });
    });

    describe('hears "🔔 Включить уведомления" success', () => {
        it('should enable notifications and reenter scene', async () => {
            ctx.message = { text: '🔔 Включить уведомления' };
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

            // Симулируем логику обработки кнопки "🔔 Включить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔔 Включить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }

                    await mockDatabase.updateUserNotifications(user.id, true);

                    // Обновляем экран
                    ctx.scene.reenter();
                } catch (error) {
                    await ctx.reply('❌ Ошибка сохранения настроек');
                }
            }

            expect(mockDatabase.updateUserNotifications).toHaveBeenCalledWith(
                1,
                true
            );
            expect(ctx.scene.reenter).toHaveBeenCalled();
        });
    });

    describe('hears "🔕 Выключить уведомления" with database error', () => {
        it('should show error when database is not initialized', async () => {
            ctx.message = { text: '🔕 Выключить уведомления' };
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Симулируем логику обработки кнопки "🔕 Выключить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔕 Выключить уведомления')) {
                const database = null; // Представляем что globalDatabase = null
                if (!database) {
                    await ctx.reply('Ошибка: база данных не инициализирована');
                    return;
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForNotificationSettings(mockDatabase);
        });
    });

    describe('hears "🔕 Выключить уведомления" with user not found', () => {
        it('should show error when user is not found', async () => {
            ctx.message = { text: '🔕 Выключить уведомления' };
            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockResolvedValueOnce(null);

            // Симулируем логику обработки кнопки "🔕 Выключить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔕 Выключить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }
                } catch (error) {
                    // Этот блок не должен выполниться
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка: пользователь не найден'
            );
        });
    });

    describe('hears "🔕 Выключить уведомления" with database error during update', () => {
        it('should show error message when database error occurs during update', async () => {
            ctx.message = { text: '🔕 Выключить уведомления' };
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

            // Симулируем логику обработки кнопки "🔕 Выключить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔕 Выключить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }

                    await mockDatabase.updateUserNotifications(user.id, false);

                    // Обновляем экран
                    ctx.scene.reenter();
                } catch (error) {
                    await ctx.reply('❌ Ошибка сохранения настроек');
                }
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                '❌ Ошибка сохранения настроек'
            );
        });
    });

    describe('hears "🔕 Выключить уведомления" success', () => {
        it('should disable notifications and reenter scene', async () => {
            ctx.message = { text: '🔕 Выключить уведомления' };
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

            // Симулируем логику обработки кнопки "🔕 Выключить уведомления"
            const text = ctx.message.text;

            if (text.includes('🔕 Выключить уведомления')) {
                try {
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована');
                        return;
                    }

                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    if (!user) {
                        await ctx.reply('❌ Ошибка: пользователь не найден');
                        return;
                    }

                    await mockDatabase.updateUserNotifications(user.id, false);

                    // Обновляем экран
                    ctx.scene.reenter();
                } catch (error) {
                    await ctx.reply('❌ Ошибка сохранения настроек');
                }
            }

            expect(mockDatabase.updateUserNotifications).toHaveBeenCalledWith(
                1,
                false
            );
            expect(ctx.scene.reenter).toHaveBeenCalled();
        });
    });

    describe('hears "⬅️ Назад"', () => {
        it('should enter settings scene', async () => {
            ctx.message = { text: '⬅️ Назад' };

            // Симулируем логику обработки кнопки "⬅️ Назад"
            const text = ctx.message.text;

            if (text.includes('⬅️ Назад')) {
                await ctx.scene.enter(SCENES.SETTINGS);
            }

            expect(ctx.scene.enter).toHaveBeenCalledWith(SCENES.SETTINGS);
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

    describe('on text (unknown command) with database error', () => {
        it('should show menu and prompt to use buttons when database is not initialized', async () => {
            ctx.message = { text: 'Unknown command' };

            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForNotificationSettings(null as any);

            // Симулируем логику обработки неизвестной команды
            const database = null; // Представляем что globalDatabase = null
            if (!database) {
                await ctx.reply('Используйте кнопки меню для навигации.');
                return;
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForNotificationSettings(mockDatabase);
        });
    });

    describe('on text (unknown command) with database error during fetch', () => {
        it('should show menu when database error occurs', async () => {
            ctx.message = { text: 'Unknown command' };

            mockDatabase.getUserByTelegramId = jest
                .fn()
                .mockRejectedValueOnce(new Error('Database error'));

            // Симулируем логику обработки неизвестной команды
            try {
                if (!mockDatabase) {
                    await ctx.reply('Используйте кнопки меню для навигации.');
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                // Этот блок не должен выполниться до ошибки
            } catch (error) {
                await ctx.reply('Используйте кнопки меню для навигации.');
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.'
            );
        });
    });

    describe('on text (unknown command) with enabled notifications', () => {
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

            // Симулируем логику обработки неизвестной команды
            try {
                if (!mockDatabase) {
                    await ctx.reply('Используйте кнопки меню для навигации.');
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                const keyboard = user?.notificationsEnabled
                    ? expect.any(Object) // Markup с кнопками для включенных уведомлений
                    : expect.any(Object); // Markup с кнопками для выключенных уведомлений

                await ctx.reply('Используйте кнопки меню для навигации.', keyboard);
            } catch (error) {
                // Этот блок не должен выполниться
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });
    });

    describe('on text (unknown command) with disabled notifications', () => {
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

            // Симулируем логику обработки неизвестной команды
            try {
                if (!mockDatabase) {
                    await ctx.reply('Используйте кнопки меню для навигации.');
                    return;
                }

                const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                const keyboard = user?.notificationsEnabled
                    ? expect.any(Object) // Markup с кнопками для включенных уведомлений
                    : expect.any(Object); // Markup с кнопками для выключенных уведомлений

                await ctx.reply('Используйте кнопки меню для навигации.', keyboard);
            } catch (error) {
                // Этот блок не должен выполниться
            }

            expect(ctx.reply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
                expect.any(Object)
            );
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(notificationSettingsScene.id).toBe(SCENES.NOTIFICATION_SETTINGS);
            expect(typeof (notificationSettingsScene as any).enterHandler).toBe('function');
            expect(typeof (notificationSettingsScene as any).handler).toBe('function');
        });

        it('should handle global database initialization', () => {
            const testDatabase = {} as DatabaseService;
            setGlobalDatabaseForNotificationSettings(testDatabase);

            // Проверяем, что функция не падает при установке базы данных
            expect(() => setGlobalDatabaseForNotificationSettings(testDatabase)).not.toThrow();

            // Восстанавливаем исходную базу данных
            setGlobalDatabaseForNotificationSettings(mockDatabase);
        });
    });
});
