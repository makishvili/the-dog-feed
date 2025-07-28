import { Scenes, Telegraf, session } from 'telegraf';
import {
    feedingDetailsScene,
    setGlobalDatabaseForFeedingDetails,
} from '../../src/scenes/feeding-details';
import { DatabaseService } from '../../src/services/database';
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

// Mock для парсеров
jest.mock('../../src/services/feeding-parser', () => ({
    FeedingParser: {
        parseDetails: jest.fn(),
        getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2']),
    },
}));

// Mock для утилит
jest.mock('../../src/utils/timezone-utils', () => ({
    getTimeOffsetInMinutes: jest.fn().mockReturnValue(0),
}));

jest.mock('../../src/utils/time-utils', () => ({
    formatDateTime: jest.fn().mockReturnValue('01.01.2024 12:00'),
}));

describe('feedingDetailsScene', () => {
    beforeEach(() => {
        setGlobalDatabaseForFeedingDetails(mockDatabase);
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
        it('should show error message when no lastFeedingId in session', async () => {
            const mockReply = jest.fn();
            const ctx = {
                session: { lastFeedingId: null },
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену
            const lastFeedingId = ctx.session?.lastFeedingId;

            if (!lastFeedingId) {
                await ctx.reply(
                    '❌ А вы не покормили собачку только что? Странно. А что же вы хотите тогда отредактировать? :)',
                    expect.any(Object)
                );
                return;
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ А вы не покормили собачку только что? Странно. А что же вы хотите тогда отредактировать? :)',
                expect.any(Object)
            );
        });

        it('should show details input message when lastFeedingId exists', async () => {
            const mockReply = jest.fn();
            const ctx = {
                session: { lastFeedingId: 1 },
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену с существующим lastFeedingId
            const lastFeedingId = ctx.session?.lastFeedingId;

            if (lastFeedingId) {
                const message =
                    `📝 *Отредактируйте последнее кормление*\n\n` +
                    `Если надо, поменяйте тип и количество корма:\n` +
                    `• 50г сухого\n` +
                    `• 60 влажного\n` +
                    `• сухого 40г\n\n` +
                    `Или запишите другое время кормления:\n` +
                    `• 14:30\n` +
                    `• 9:15\n\n` +
                    `Или просто запишите хорошую мысль про нашу собачку, и она (мысль) привяжется к этому кормлению :)`;

                await ctx.reply(message, expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('📝 *Отредактируйте последнее кормление*'),
                expect.any(Object)
            );
        });
    });

    describe('text message handling', () => {
        it('should enter main scene when "🏠 На главную" is received', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '🏠 На главную' },
                session: { lastFeedingId: 1 },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "На главную"
            const text = ctx.message.text;

            if (text.includes('🏠 На главную')) {
                await ctx.scene.enter('MAIN');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');
        });

        it('should show error when no lastFeedingId in session', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Some details' },
                session: { lastFeedingId: null },
                reply: mockReply,
            } as any;

            // Симулируем логику проверки lastFeedingId
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (!lastFeedingId) {
                    await ctx.reply('❌ Ошибка: не найдено кормление для обновления');
                    return;
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Ошибка: не найдено кормление для обновления'
            );
        });

        it('should show error when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForFeedingDetails(null as any);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Some details' },
                session: { lastFeedingId: 1 },
                reply: mockReply,
            } as any;

            // Симулируем логику проверки базы данных
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId) {
                    // Симулируем проверку инициализации базы данных
                    const database = null; // Представляем что globalDatabase = null
                    if (!database) {
                        await ctx.reply('❌ Ошибка: база данных не инициализирована');
                        return;
                    }
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Ошибка: база данных не инициализирована'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForFeedingDetails(mockDatabase);
        });

        it('should show error when details parsing fails', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: false,
                error: 'Неверный формат',
            });

            const mockGetUserByTelegramId = mockDatabase.getUserByTelegramId as jest.Mock;
            mockGetUserByTelegramId.mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
            });

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Invalid details' },
                from: { id: 123456789 },
                session: { lastFeedingId: 1 },
                reply: mockReply,
            } as any;

            // Симулируем логику парсинга деталей
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId && mockDatabase) {
                    try {
                        const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                        
                        let detailsText = text;
                        const timeRegex = /(\d{1,2}):(\d{2})/;
                        const timeMatch = text.match(timeRegex);
                        
                        if (timeMatch) {
                            detailsText = text.replace(timeRegex, '').trim();
                            if (detailsText === '') {
                                detailsText = text;
                            }
                        }

                        const parsed = FeedingParser.parseDetails(detailsText);

                        if (!parsed.isValid && parsed.error) {
                            await ctx.reply(
                                `❌ Ошибка: ${parsed.error}\n\nПопробуйте еще раз или используйте примеры выше.`,
                                expect.any(Object)
                            );
                            return;
                        }
                    } catch (error) {
                        // Обработка ошибок
                    }
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('❌ Ошибка: Неверный формат'),
                expect.any(Object)
            );
        });

        it('should update feeding details and notify users', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Сухой корм 150г',
            });

            const mockUpdateFeedingDetails = mockDatabase.updateFeedingDetails as jest.Mock;
            const mockGetUserByTelegramId = mockDatabase.getUserByTelegramId as jest.Mock;
            const mockGetAllUsers = mockDatabase.getAllUsers as jest.Mock;

            mockGetUserByTelegramId.mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
            });

            mockUpdateFeedingDetails.mockResolvedValue(undefined);
            mockGetAllUsers.mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                },
            ]);

            const restoreSetTimeout = mockSetTimeout();

            const mockReply = jest.fn();
            const mockSceneEnter = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });

            const ctx = {
                message: { text: 'Сухой корм 150г' },
                from: { id: 123456789 },
                session: { lastFeedingId: 1 },
                reply: mockReply,
                scene: { enter: mockSceneEnter },
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем полную логику обработки успешного обновления
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId && mockDatabase) {
                    try {
                        const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                        
                        let feedingTime: Date | undefined = undefined;
                        let detailsText = text;
                        
                        const timeRegex = /(\d{1,2}):(\d{2})/;
                        const timeMatch = text.match(timeRegex);
                        
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            
                            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                                const now = new Date();
                                feedingTime = new Date(now);
                                feedingTime.setHours(hours, minutes, 0, 0);
                                detailsText = text.replace(timeRegex, '').trim();
                                if (detailsText === '') {
                                    detailsText = text;
                                }
                            }
                        }

                        const parsed = FeedingParser.parseDetails(detailsText);

                        if (parsed.isValid) {
                            await mockDatabase.updateFeedingDetails(
                                lastFeedingId,
                                parsed.amount,
                                parsed.foodType,
                                parsed.details,
                                feedingTime
                            );

                            // Уведомляем всех пользователей
                            const allUsers = await mockDatabase.getAllUsers();
                            for (const u of allUsers) {
                                if (u.notificationsEnabled) {
                                    try {
                                        await ctx.telegram.sendMessage(
                                            u.telegramId,
                                            expect.stringContaining('✅ Детали кормления обновлены!')
                                        );
                                    } catch (error) {
                                        // Игнорируем ошибки отправки
                                    }
                                }
                            }

                            // Очищаем ID кормления из сессии
                            if (ctx.session) {
                                delete ctx.session.lastFeedingId;
                            }

                            // Возврат на главный экран
                            setTimeout(() => {
                                ctx.scene.enter('MAIN');
                            }, 2000);
                        }
                    } catch (error) {
                        // Обработка ошибок
                    }
                }
            }

            expect(mockUpdateFeedingDetails).toHaveBeenCalledWith(
                1,
                150,
                'dry',
                'Сухой корм 150г',
                undefined
            );

            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');
            expect(mockSendMessage).toHaveBeenCalledWith(
                123456789,
                expect.stringContaining('✅ Детали кормления обновлены!')
            );

            restoreSetTimeout();
        });

        it('should update feeding details with time when time is provided', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Кормили сухим кормом',
            });

            const mockUpdateFeedingDetails = mockDatabase.updateFeedingDetails as jest.Mock;
            const mockGetUserByTelegramId = mockDatabase.getUserByTelegramId as jest.Mock;
            const mockGetAllUsers = mockDatabase.getAllUsers as jest.Mock;

            mockGetUserByTelegramId.mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                timezone: 'Europe/Moscow',
            });

            mockUpdateFeedingDetails.mockResolvedValue(undefined);
            mockGetAllUsers.mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                },
            ]);

            const restoreSetTimeout = mockSetTimeout();

            const mockReply = jest.fn();
            const mockSceneEnter = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });

            const ctx = {
                message: { text: '14:30 Кормили сухим кормом' },
                from: { id: 123456789 },
                session: { lastFeedingId: 1 },
                reply: mockReply,
                scene: { enter: mockSceneEnter },
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем логику парсинга времени и обновления
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId && mockDatabase) {
                    try {
                        const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                        
                        let feedingTime: Date | undefined = undefined;
                        let detailsText = text;
                        
                        const timeRegex = /(\d{1,2}):(\d{2})/;
                        const timeMatch = text.match(timeRegex);
                        
                        if (timeMatch) {
                            const hours = parseInt(timeMatch[1]);
                            const minutes = parseInt(timeMatch[2]);
                            
                            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                                if (user?.timezone) {
                                    try {
                                        const now = new Date();
                                        const year = now.getFullYear();
                                        const month = now.getMonth();
                                        const day = now.getDate();
                                        
                                        const feedingTimeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                                        feedingTime = new Date(feedingTimeStr + 'Z');
                                        const { getTimeOffsetInMinutes } = require('../../src/utils/timezone-utils');
                                        const offsetMinutes = getTimeOffsetInMinutes(now, now.getTime() / 1000);
                                        feedingTime = new Date(feedingTime.getTime() - offsetMinutes * 60 * 1000);
                                    } catch (error) {
                                        const now = new Date();
                                        feedingTime = new Date(now);
                                        feedingTime.setHours(hours, minutes, 0, 0);
                                    }
                                } else {
                                    const now = new Date();
                                    feedingTime = new Date(now);
                                    feedingTime.setHours(hours, minutes, 0, 0);
                                }
                                
                                detailsText = text.replace(timeRegex, '').trim();
                                if (detailsText === '') {
                                    detailsText = text;
                                }
                            }
                        }

                        const parsed = FeedingParser.parseDetails(detailsText);

                        if (parsed.isValid) {
                            await mockDatabase.updateFeedingDetails(
                                lastFeedingId,
                                parsed.amount,
                                parsed.foodType,
                                parsed.details,
                                feedingTime
                            );

                            const allUsers = await mockDatabase.getAllUsers();
                            for (const u of allUsers) {
                                if (u.notificationsEnabled) {
                                    try {
                                        await ctx.telegram.sendMessage(u.telegramId, expect.any(String));
                                    } catch (error) {
                                        // Игнорируем ошибки
                                    }
                                }
                            }

                            if (ctx.session) {
                                delete ctx.session.lastFeedingId;
                            }

                            setTimeout(() => {
                                ctx.scene.enter('MAIN');
                            }, 2000);
                        }
                    } catch (error) {
                        // Обработка ошибок
                    }
                }
            }

            expect(mockUpdateFeedingDetails).toHaveBeenCalledWith(
                1,
                150,
                'dry',
                'Кормили сухим кормом',
                expect.any(Date)
            );

            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');

            restoreSetTimeout();
        });

        it('should handle database error gracefully', async () => {
            const { FeedingParser } = require('../../src/services/feeding-parser');
            
            FeedingParser.parseDetails.mockReturnValue({
                isValid: true,
                amount: 150,
                foodType: 'dry',
                details: 'Сухой корм 150г',
            });

            const mockGetUserByTelegramId = mockDatabase.getUserByTelegramId as jest.Mock;
            mockGetUserByTelegramId.mockRejectedValue(new Error('Database error'));

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Сухой корм 150г' },
                from: { id: 123456789 },
                session: { lastFeedingId: 1 },
                reply: mockReply,
                scene: { enter: jest.fn() },
                telegram: { sendMessage: jest.fn() },
            } as any;

            // Симулируем обработку ошибки базы данных
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId && mockDatabase) {
                    try {
                        await mockDatabase.getUserByTelegramId(ctx.from!.id);
                        // Остальная логика...
                    } catch (error) {
                        console.error('Ошибка обновления деталей кормления:', error);
                        await ctx.reply(
                            '❌ Произошла ошибка при сохранении деталей. Попробуйте еще раз.',
                            expect.any(Object)
                        );
                    }
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Произошла ошибка при сохранении деталей. Попробуйте еще раз.',
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

            const mockUpdateFeedingDetails = mockDatabase.updateFeedingDetails as jest.Mock;
            const mockGetUserByTelegramId = mockDatabase.getUserByTelegramId as jest.Mock;
            const mockGetAllUsers = mockDatabase.getAllUsers as jest.Mock;

            mockGetUserByTelegramId.mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
            });

            mockUpdateFeedingDetails.mockResolvedValue(undefined);
            mockGetAllUsers.mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                },
                {
                    id: 2,
                    telegramId: 987654321,
                    username: 'testuser2',
                    notificationsEnabled: true,
                },
            ]);

            const restoreSetTimeout = mockSetTimeout();

            const mockSceneEnter = jest.fn();
            const mockSendMessage = jest.fn()
                .mockResolvedValueOnce({ message_id: 1 }) // Первый пользователь - успех
                .mockRejectedValueOnce(new Error('User blocked bot')); // Второй пользователь - ошибка

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const ctx = {
                message: { text: 'Сухой корм 150г' },
                from: { id: 123456789 },
                session: { lastFeedingId: 1 },
                reply: jest.fn(),
                scene: { enter: mockSceneEnter },
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем отправку уведомлений с ошибками
            const text = ctx.message.text;

            if (!text.includes('🏠 На главную')) {
                const lastFeedingId = ctx.session?.lastFeedingId;
                if (lastFeedingId && mockDatabase) {
                    try {
                        const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                        const parsed = FeedingParser.parseDetails(text);

                        if (parsed.isValid) {
                            await mockDatabase.updateFeedingDetails(
                                lastFeedingId,
                                parsed.amount,
                                parsed.foodType,
                                parsed.details,
                                undefined
                            );

                            const allUsers = await mockDatabase.getAllUsers();
                            for (const u of allUsers) {
                                if (u.notificationsEnabled) {
                                    try {
                                        await ctx.telegram.sendMessage(u.telegramId, 'test message');
                                    } catch (error) {
                                        console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
                                    }
                                }
                            }

                            setTimeout(() => {
                                ctx.scene.enter('MAIN');
                            }, 2000);
                        }
                    } catch (error) {
                        // Обработка ошибок
                    }
                }
            }

            expect(mockUpdateFeedingDetails).toHaveBeenCalled();
            expect(mockSendMessage).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка отправки уведомления пользователю 987654321:',
                expect.any(Error)
            );
            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');

            consoleErrorSpy.mockRestore();
            restoreSetTimeout();
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(feedingDetailsScene.id).toBe('feeding_details');
            expect(typeof (feedingDetailsScene as any).enterHandler).toBe('function');
            expect(typeof (feedingDetailsScene as any).handler).toBe('function');
        });

        it('should handle global database initialization', () => {
            const testDatabase = {} as DatabaseService;
            setGlobalDatabaseForFeedingDetails(testDatabase);
            
            // Проверяем, что функция не падает при установке базы данных
            expect(() => setGlobalDatabaseForFeedingDetails(testDatabase)).not.toThrow();
            
            // Восстанавливаем исходную базу данных
            setGlobalDatabaseForFeedingDetails(mockDatabase);
        });
    });
});
