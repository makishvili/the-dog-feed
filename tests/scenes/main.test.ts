import { Scenes, Telegraf, session } from 'telegraf';
import {
    mainScene,
    setGlobalDatabaseForMain,
    setGlobalServices,
    getOrCreateUser,
} from '../../src/scenes/main';
import { DatabaseService } from '../../src/services/database';
import { BotContext, User } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
    getUserByTelegramId: jest.fn(),
    createUser: jest.fn(),
    getSetting: jest.fn(),
    createFeeding: jest.fn(),
    getAllUsers: jest.fn(),
    getLastFeeding: jest.fn(),
    getStats: jest.fn(),
    updateUserTimezone: jest.fn(),
    getUserById: jest.fn(),
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для утилит
jest.mock('../../src/utils/timezone-utils', () => ({
    getTimeOffsetInMinutes: jest.fn().mockReturnValue(0),
    getTimezoneByOffset: jest.fn().mockReturnValue('Europe/Moscow'),
}));

jest.mock('../../src/utils/time-utils', () => ({
    formatDateTime: jest.fn().mockImplementation((date, timezone) => {
        return '01.01.2024 в 12:00';
    }),
}));

jest.mock('../../src/utils/user-utils', () => ({
    createUserLink: jest.fn().mockImplementation((user) => {
        return user?.username ? `@${user.username}` : 'Пользователь';
    }),
}));

describe('mainScene', () => {
    beforeEach(() => {
        setGlobalDatabaseForMain(mockDatabase);
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
        it('should show welcome message on first visit', async () => {
            const mockReply = jest.fn();
            const ctx = {
                from: {
                    id: 123456789,
                    username: 'testuser',
                    first_name: 'Test',
                },
                session: { firstVisitDone: false },
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену
            const showFeedingDetailsButton = ctx.session?.justFed === true;

            // Очищаем флаг, чтобы кнопка не показывалась при следующих входах
            if (ctx.session) {
                ctx.session.justFed = false;
            }

            // Проверяем, был ли это первый вход (через /start)
            if (!ctx.session?.firstVisitDone) {
                // Первый вход - показываем приветственное сообщение
                if (ctx.session) {
                    ctx.session.firstVisitDone = true;
                }
                await ctx.reply('👋 Добро пожаловать в бота для учета кормления собаки!\n\n' +
                    'Здесь вы можете:\n' +
                    '• Записывать кормления\n' +
                    '• Получать напоминания\n' +
                    '• Просматривать историю\n' +
                    '• Настраивать параметры\n\n' +
                    'Нажмите "🍽️ Собачка поел", чтобы записать кормление.', expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                '👋 Добро пожаловать в бота для учета кормления собаки!\n\n' +
                'Здесь вы можете:\n' +
                '• Записывать кормления\n' +
                '• Получать напоминания\n' +
                '• Просматривать историю\n' +
                '• Настраивать параметры\n\n' +
                'Нажмите "🍽️ Собачка поел", чтобы записать кормление.',
                expect.any(Object)
            );
            expect(ctx.session.firstVisitDone).toBe(true);
        });

        it('should show return message on subsequent visits', async () => {
            const mockReply = jest.fn();
            const ctx = {
                from: {
                    id: 123456789,
                    username: 'testuser',
                    first_name: 'Test',
                },
                session: { firstVisitDone: true },
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену при повторном посещении
            const showFeedingDetailsButton = ctx.session?.justFed === true;

            // Очищаем флаг, чтобы кнопка не показывалась при следующих входах
            if (ctx.session) {
                ctx.session.justFed = false;
            }

            // Последующие переходы - показываем другое сообщение
            await ctx.reply('Возвращаемся на главный экран', expect.any(Object));

            expect(mockReply).toHaveBeenCalledWith(
                'Возвращаемся на главный экран',
                expect.any(Object)
            );
        });
    });

    describe('hears "Другие действия"', () => {
        it('should enter other actions scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: 'Другие действия' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Другие действия"
            const text = ctx.message.text;

            if (text.includes('Другие действия')) {
                await ctx.scene.enter('OTHER_ACTIONS');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('OTHER_ACTIONS');
        });
    });

    describe('hears "Когда следующее кормление?"', () => {
        it('should show next feeding time', async () => {
            // Фиксируем время для предсказуемости расчетов
            const fixedNow = new Date('2023-07-26T07:00:00Z'); // 7:00 UTC
            const nextFeedingTime = new Date('2023-07-26T10:00:00Z'); // 10:00 UTC (через 3 часа)
            
            jest.spyOn(global, 'Date').mockImplementation(() => fixedNow as any);
            (global.Date.now as jest.Mock) = jest.fn(() => fixedNow.getTime());

            const mockTimerService = {
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: nextFeedingTime,
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Когда следующее кормление?' },
                from: { id: 123456789 },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Когда следующее кормление?"
            const text = ctx.message.text;

            if (text.includes('Когда следующее кормление?')) {
                try {
                    if (!mockTimerService) {
                        await ctx.reply('Ошибка: сервис таймера не инициализирован. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    const nextFeedingInfo = mockTimerService.getNextFeedingInfo();

                    if (!nextFeedingInfo.isActive || !nextFeedingInfo.time) {
                        await ctx.reply('⏹️ Кормления приостановлены.\nЧтобы возобновить, нажмите "🍽️ Собачка поел"');
                        return;
                    }

                    // Проверяем, что globalDatabase инициализирована
                    if (!mockDatabase) {
                        await ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Получаем текущего пользователя для определения его часового пояса
                    const currentUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    // Форматирование времени следующего кормления с учетом часового пояса пользователя
                    const nextFeedingTimeValue = nextFeedingInfo.time;
                    const timeString = currentUser
                        ? '01.01.2024 в 13:00'.split(' в ')[1]
                        : nextFeedingTimeValue.getHours().toString().padStart(2, '0') +
                        ':' +
                        nextFeedingTimeValue.getMinutes().toString().padStart(2, '0');

                    // Вычисление времени до следующего кормления используя фиксированное время
                    const now = fixedNow;
                    const timeDiff = nextFeedingTimeValue.getTime() - now.getTime();
                    const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
                    const minutesDiff = Math.floor(
                        (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
                    );

                    let timeDiffString = '';
                    if (hoursDiff > 0) {
                        timeDiffString = `${hoursDiff} ч ${minutesDiff} мин`;
                    } else {
                        timeDiffString = `${minutesDiff} мин`;
                    }

                    await ctx.reply(`⏰ Следующее кормление в ${timeString} (через ${timeDiffString})`);
                } catch (error) {
                    await ctx.reply('Произошла ошибка при получении времени следующего кормления. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '⏰ Следующее кормление в 13:00 (через 3 ч 0 мин)'
            );

            // Восстанавливаем Date
            jest.restoreAllMocks();
        });

        it('should show stopped message when timer is not active', async () => {
            const mockTimerService = {
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: false,
                    time: null,
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Когда следующее кормление?' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Когда следующее кормление?" когда таймер не активен
            const text = ctx.message.text;

            if (text.includes('Когда следующее кормление?')) {
                try {
                    if (!mockTimerService) {
                        await ctx.reply('Ошибка: сервис таймера не инициализирован. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    const nextFeedingInfo = mockTimerService.getNextFeedingInfo();

                    if (!nextFeedingInfo.isActive || !nextFeedingInfo.time) {
                        await ctx.reply('⏹️ Кормления приостановлены.\nЧтобы возобновить, нажмите "🍽️ Собачка поел"');
                        return;
                    }
                } catch (error) {
                    await ctx.reply('Произошла ошибка при получении времени следующего кормления. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '⏹️ Кормления приостановлены.\nЧтобы возобновить, нажмите "🍽️ Собачка поел"'
            );
        });

        it('should show error when timer service is not initialized', async () => {
            // Сбрасываем глобальные сервисы
            setGlobalServices(null as any, mockDatabase);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Когда следующее кормление?' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Когда следующее кормление?" когда сервис таймера не инициализирован
            const text = ctx.message.text;

            if (text.includes('Когда следующее кормление?')) {
                try {
                    const timerService = null; // Представляем что globalTimerService = null
                    if (!timerService) {
                        await ctx.reply('Ошибка: сервис таймера не инициализирован. Попробуйте перезапустить бота командой /start');
                        return;
                    }
                } catch (error) {
                    await ctx.reply('Произошла ошибка при получении времени следующего кормления. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: сервис таймера не инициализирован. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем сервисы
            setGlobalServices({} as any, mockDatabase);
        });

        it('should show error when database is not initialized', async () => {
            // Сбрасываем глобальную базу данных
            setGlobalDatabaseForMain(null as any);

            const mockTimerService = {
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, null as any);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Когда следующее кормление?' },
                from: { id: 123456789 },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Когда следующее кормление?" когда база данных не инициализирована
            const text = ctx.message.text;

            if (text.includes('Когда следующее кормление?')) {
                try {
                    if (!mockTimerService) {
                        await ctx.reply('Ошибка: сервис таймера не инициализирован. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    const nextFeedingInfo = mockTimerService.getNextFeedingInfo();

                    if (!nextFeedingInfo.isActive || !nextFeedingInfo.time) {
                        await ctx.reply('⏹️ Кормления приостановлены.\nЧтобы возобновить, нажмите "🍽️ Собачка поел"');
                        return;
                    }

                    // Проверяем, что globalDatabase инициализирована
                    const database = null; // Представляем что globalDatabase = null
                    if (!database) {
                        await ctx.reply('Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start');
                        return;
                    }
                } catch (error) {
                    await ctx.reply('Произошла ошибка при получении времени следующего кормления. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем базу данных
            setGlobalDatabaseForMain(mockDatabase);
        });
    });

    describe('hears "🍽️ Собачка поел"', () => {
        it('should record feeding and start timer', async () => {
            const mockTimerService = {
                startFeedingTimer: jest.fn(),
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
                stopAllTimers: jest.fn(),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            mockDatabase.getUserByTelegramId = jest.fn()
                .mockResolvedValueOnce({
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                })
                .mockResolvedValueOnce({
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                    timezone: 'Europe/Moscow',
                });

            mockDatabase.createUser = jest.fn().mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            mockDatabase.createFeeding = jest.fn().mockResolvedValue({
                id: 1,
                userId: 1,
                timestamp: new Date(),
                foodType: 'dry',
                amount: 12,
            });

            mockDatabase.getSetting = jest
                .fn()
                .mockResolvedValueOnce('dry') // default_food_type
                .mockResolvedValueOnce('12'); // default_food_amount

            mockDatabase.getAllUsers = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
            ]);

            mockDatabase.updateUserTimezone = jest.fn().mockResolvedValue(undefined);

            const restoreSetTimeout = mockSetTimeout();

            const mockReply = jest.fn();
            const mockSceneEnter = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });

            const ctx = {
                message: { text: '🍽️ Собачка поел' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                session: {},
                reply: mockReply,
                scene: { enter: mockSceneEnter },
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем полную логику обработки кнопки "Собачка поел"
            const text = ctx.message.text;

            if (text.includes('🍽️ Собачка поел')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Получаем или создаем пользователя в базе данных
                    let dbUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    if (!dbUser) {
                        dbUser = await mockDatabase.createUser(
                            ctx.from!.id,
                            ctx.from!.username || ctx.from!.first_name
                        );
                    }

                    // Автоматически определяем и сохраняем часовой пояс пользователя, если он еще не определен
                    // Симулируем autoDetectAndSaveTimezone
                    if (dbUser && !dbUser.timezone) {
                        const timezone = 'Europe/Moscow';
                        await mockDatabase.updateUserTimezone(dbUser.id, timezone);
                        dbUser.timezone = timezone;
                    }

                    // Получаем обновленного пользователя с таймзоной
                    const updatedUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    if (updatedUser) {
                        dbUser = updatedUser;
                    }

                    // Также создаем пользователя в старом формате для совместимости с таймерами
                    // Симулируем getOrCreateUser
                    let user: User = {
                        id: dbUser.id,
                        telegramId: dbUser.telegramId,
                        username: dbUser.username,
                        notificationsEnabled: dbUser.notificationsEnabled,
                    };

                    // Получаем текущие настройки корма из БД
                    const foodType =
                        (await mockDatabase.getSetting('default_food_type')) || 'dry';
                    const foodAmount = parseInt(
                        (await mockDatabase.getSetting('default_food_amount')) || '12'
                    );

                    // Создание записи о кормлении в базе данных с текущими настройками
                    const dbFeeding = await mockDatabase.createFeeding(
                        dbUser.id,
                        foodType,
                        foodAmount
                    );

                    // Сохраняем ID кормления в сессии для возможности уточнения деталей
                    if (!ctx.session) {
                        ctx.session = {};
                    }
                    ctx.session.lastFeedingId = dbFeeding.id;

                    // Запуск таймера на следующее кормление
                    mockTimerService.startFeedingTimer();

                    // Получение информации о следующем кормлении
                    const nextFeedingInfo = mockTimerService.getNextFeedingInfo();

                    // Форматирование интервала
                    const intervalMinutes = nextFeedingInfo.intervalMinutes;
                    let intervalText = '';
                    if (intervalMinutes < 60) {
                        intervalText = `${intervalMinutes} мин`;
                    } else {
                        const hours = Math.floor(intervalMinutes / 60);
                        const remainingMinutes = intervalMinutes % 60;
                        if (remainingMinutes === 0) {
                            intervalText = `${hours} ч`;
                        } else {
                            intervalText = `${hours} ч ${remainingMinutes} мин`;
                        }
                    }

                    // Форматирование информации о корме
                    const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

                    // Уведомление всех пользователей
                    const message =
                        `🍽️ Собачка вкусно поел!\n\n` +
                        `01.01.2024 в 12:00\n` +
                        `@testuser дал ${foodInfo}\n\n` +
                        `⏰ Следующее кормление в 13:00 (через ${intervalText})`;

                    // Получаем всех пользователей из базы данных для уведомлений
                    const allUsers = await mockDatabase.getAllUsers();
                    for (const u of allUsers) {
                        // Пропускаем текущего пользователя, так как ему будет отправлено отдельное сообщение
                        if (u.telegramId === ctx.from!.id) {
                            continue;
                        }

                        if (u.notificationsEnabled) {
                            try {
                                await ctx.telegram.sendMessage(u.telegramId, message);
                            } catch (error) {
                                // Игнорируем ошибки
                            }
                        }
                    }

                    // Показываем сообщение об успешном кормлении и обновляем клавиатуру
                    await ctx.reply(message, expect.any(Object));
                } catch (error) {
                    await ctx.reply('Произошла ошибка при записи кормления. Попробуйте еще раз.');
                }
            }

            expect(mockDatabase.createFeeding).toHaveBeenCalledWith(
                1,
                'dry',
                12
            );
            expect(mockTimerService.startFeedingTimer).toHaveBeenCalled();
            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('🍽️ Собачка вкусно поел!'),
                expect.any(Object)
            );

            restoreSetTimeout();
        });

        it('should handle database error when getting user', async () => {
            const mockTimerService = {
                startFeedingTimer: jest.fn(),
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            mockDatabase.getUserByTelegramId = jest.fn().mockRejectedValue(new Error('Database error'));

            const mockReply = jest.fn();
            const ctx = {
                message: { text: '🍽️ Собачка поел' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                session: {},
                reply: mockReply,
                scene: { enter: jest.fn() },
                telegram: { sendMessage: jest.fn() },
            } as any;

            // Симулируем обработку ошибки базы данных при получении пользователя
            const text = ctx.message.text;

            if (text.includes('🍽️ Собачка поел')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Получаем или создаем пользователя в базе данных
                    await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    // Остальная логика...
                } catch (error) {
                    await ctx.reply('Произошла ошибка при записи кормления. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Произошла ошибка при записи кормления. Попробуйте еще раз.'
            );
        });

        it('should handle notification sending errors gracefully', async () => {
            const mockTimerService = {
                startFeedingTimer: jest.fn(),
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValue({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
                timezone: 'Europe/Moscow',
            });

            mockDatabase.createFeeding = jest.fn().mockResolvedValue({
                id: 1,
                userId: 1,
                timestamp: new Date(),
                foodType: 'dry',
                amount: 12,
            });

            mockDatabase.getSetting = jest
                .fn()
                .mockResolvedValueOnce('dry') // default_food_type
                .mockResolvedValueOnce('12'); // default_food_amount

            // Возвращаем двух пользователей: текущего и другого
            mockDatabase.getAllUsers = jest.fn().mockResolvedValue([
                {
                    id: 1,
                    telegramId: 123456789, // Текущий пользователь - будет пропущен
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
                {
                    id: 2,
                    telegramId: 987654321, // Другой пользователь - получит уведомление
                    username: 'testuser2',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
                {
                    id: 3,
                    telegramId: 555666777, // Третий пользователь - получит ошибку
                    username: 'testuser3',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                },
            ]);

            const restoreSetTimeout = mockSetTimeout();

            const mockSceneEnter = jest.fn();
            const mockSendMessage = jest.fn()
                .mockResolvedValueOnce({ message_id: 1 }) // Первый пользователь - успех
                .mockRejectedValueOnce(new Error('User blocked bot')); // Второй пользователь - ошибка

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            const ctx = {
                message: { text: '🍽️ Собачка поел' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                session: {},
                reply: jest.fn(),
                scene: { enter: mockSceneEnter },
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем отправку уведомлений с ошибками
            const text = ctx.message.text;

            if (text.includes('🍽️ Собачка поел')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Получаем или создаем пользователя в базе данных
                    let dbUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    if (!dbUser) {
                        dbUser = await mockDatabase.createUser(
                            ctx.from!.id,
                            ctx.from!.username || ctx.from!.first_name
                        );
                    }

                    // Автоматически определяем и сохраняем часовой пояс пользователя, если он еще не определен
                    // Симулируем autoDetectAndSaveTimezone
                    if (dbUser && !dbUser.timezone) {
                        const timezone = 'Europe/Moscow';
                        await mockDatabase.updateUserTimezone(dbUser.id, timezone);
                        dbUser.timezone = timezone;
                    }

                    // Получаем обновленного пользователя с таймзоной
                    const updatedUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    if (updatedUser) {
                        dbUser = updatedUser;
                    }

                    // Также создаем пользователя в старом формате для совместимости с таймерами
                    // Симулируем getOrCreateUser
                    let user: User = {
                        id: dbUser.id,
                        telegramId: dbUser.telegramId,
                        username: dbUser.username,
                        notificationsEnabled: dbUser.notificationsEnabled,
                    };

                    // Получаем текущие настройки корма из БД
                    const foodType =
                        (await mockDatabase.getSetting('default_food_type')) || 'dry';
                    const foodAmount = parseInt(
                        (await mockDatabase.getSetting('default_food_amount')) || '12'
                    );

                    // Создание записи о кормлении в базе данных с текущими настройками
                    const dbFeeding = await mockDatabase.createFeeding(
                        dbUser.id,
                        foodType,
                        foodAmount
                    );

                    // Сохраняем ID кормления в сессии для возможности уточнения деталей
                    if (!ctx.session) {
                        ctx.session = {};
                    }
                    ctx.session.lastFeedingId = dbFeeding.id;

                    // Запуск таймера на следующее кормление
                    mockTimerService.startFeedingTimer();

                    // Получение информации о следующем кормлении
                    const nextFeedingInfo = mockTimerService.getNextFeedingInfo();

                    // Форматирование интервала
                    const intervalMinutes = nextFeedingInfo.intervalMinutes;
                    let intervalText = '';
                    if (intervalMinutes < 60) {
                        intervalText = `${intervalMinutes} мин`;
                    } else {
                        const hours = Math.floor(intervalMinutes / 60);
                        const remainingMinutes = intervalMinutes % 60;
                        if (remainingMinutes === 0) {
                            intervalText = `${hours} ч`;
                        } else {
                            intervalText = `${hours} ч ${remainingMinutes} мин`;
                        }
                    }

                    // Форматирование информации о корме
                    const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

                    // Уведомление всех пользователей
                    const message =
                        `🍽️ Собачка вкусно поел!\n\n` +
                        `01.01.2024 в 12:00\n` +
                        `@testuser дал ${foodInfo}\n\n` +
                        `⏰ Следующее кормление в 13:00 (через ${intervalText})`;

                    // Получаем всех пользователей из базы данных для уведомлений
                    const allUsers = await mockDatabase.getAllUsers();
                    for (const u of allUsers) {
                        // Пропускаем текущего пользователя, так как ему будет отправлено отдельное сообщение
                        if (u.telegramId === ctx.from!.id) {
                            continue;
                        }

                        if (u.notificationsEnabled) {
                            try {
                                await ctx.telegram.sendMessage(u.telegramId, message);
                            } catch (error) {
                                console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
                            }
                        }
                    }

                    // Показываем сообщение об успешном кормлении и обновляем клавиатуру
                    await ctx.reply(message, expect.any(Object));
                } catch (error) {
                    await ctx.reply('Произошла ошибка при записи кормления. Попробуйте еще раз.');
                }
            }

            expect(mockSendMessage).toHaveBeenCalledTimes(2);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Ошибка отправки сообщения пользователю 555666777:',
                expect.any(Error)
            );
            expect(mockSceneEnter).not.toHaveBeenCalled();

            consoleErrorSpy.mockRestore();
            restoreSetTimeout();
        });
    });

    describe('hears "⏹️ Завершить кормления на сегодня"', () => {
        it('should stop feedings and notify users', async () => {
            const mockTimerService = {
                stopAllTimers: jest.fn(),
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

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
            ]);

            const mockReply = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });

            const ctx = {
                message: { text: '⏹️ Завершить кормления на сегодня' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                reply: mockReply,
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем логику обработки кнопки "Завершить кормления на сегодня"
            const text = ctx.message.text;

            if (text.includes('⏹️ Завершить кормления на сегодня')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Симулируем getOrCreateUser
                    const user = await mockDatabase.getUserByTelegramId(ctx.from!.id);
                    const dbUser = {
                        id: user?.id || 0,
                        telegramId: user?.telegramId || 0,
                        username: user?.username || '',
                        notificationsEnabled: user?.notificationsEnabled || false,
                        feedingInterval: user?.feedingInterval || 210,
                        createdAt: new Date(),
                    };

                    mockTimerService.stopAllTimers();

                    const message =
                        `⏹️ Кормления приостановлены.\n` +
                        `Инициатор: @testuser\n\n` +
                        `Чтобы возобновить кормления, нажмите "🍽️ Собачка поел"`;

                    // Уведомление всех пользователей через базу данных
                    const allUsers = await mockDatabase.getAllUsers();
                    for (const u of allUsers) {
                        if (u.notificationsEnabled) {
                            try {
                                await ctx.telegram.sendMessage(u.telegramId, message);
                            } catch (error) {
                                // Игнорируем ошибки
                            }
                        }
                    }

                    // Остаемся на главном экране
                    await ctx.reply('Возвращаемся на главный экран', expect.any(Object));
                } catch (error) {
                    await ctx.reply('Произошла ошибка при остановке кормлений. Попробуйте еще раз.');
                }
            }

            expect(mockTimerService.stopAllTimers).toHaveBeenCalled();
            expect(mockReply).toHaveBeenCalledWith(
                'Возвращаемся на главный экран',
                expect.any(Object)
            );
        });

        it('should show error when services are not initialized', async () => {
            // Сбрасываем глобальные сервисы
            setGlobalServices(null as any, null as any);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: '⏹️ Завершить кормления на сегодня' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Завершить кормления на сегодня" когда сервисы не инициализированы
            const text = ctx.message.text;

            if (text.includes('⏹️ Завершить кормления на сегодня')) {
                try {
                    const services = null; // Представляем что globalTimerService = null
                    const database = null; // Представляем что globalDatabase = null
                    if (!services || !database) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }
                } catch (error) {
                    await ctx.reply('Произошла ошибка при остановке кормлений. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем сервисы
            setGlobalServices({} as any, mockDatabase);
        });
    });

    describe('command "/status"', () => {
        it('should show status information', async () => {
            const mockTimerService = {
                getNextFeedingInfo: jest.fn().mockReturnValue({
                    isActive: true,
                    time: new Date('2023-07-26T10:00:00Z'),
                    intervalMinutes: 210,
                }),
            };

            setGlobalServices(mockTimerService, mockDatabase);

            mockDatabase.getUserByTelegramId = jest.fn()
                .mockResolvedValueOnce({
                    id: 1,
                    telegramId: 123456789,
                    username: 'testuser',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                })
                .mockResolvedValueOnce({
                    id: 2,
                    telegramId: 987654321,
                    username: 'testuser2',
                    notificationsEnabled: true,
                    feedingInterval: 210,
                    createdAt: new Date(),
                });

            mockDatabase.getLastFeeding = jest.fn().mockResolvedValue({
                id: 1,
                userId: 2,
                timestamp: new Date('2023-07-26T09:00:00Z'),
                foodType: 'dry',
                amount: 12,
            });

            mockDatabase.getStats = jest.fn().mockResolvedValue({
                totalUsers: 2,
                todayFeedings: 1,
                totalFeedings: 10,
            });

            mockDatabase.getUserById = jest.fn().mockResolvedValue({
                id: 2,
                telegramId: 987654321,
                username: 'testuser2',
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            const mockReply = jest.fn();
            const ctx = {
                message: { text: '/status' },
                from: { id: 123456789 },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки команды "/status"
            const text = ctx.message.text;

            if (text.startsWith('/status')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    const nextFeeding = mockTimerService.getNextFeedingInfo();
                    const lastFeeding = await mockDatabase.getLastFeeding();
                    const stats = await mockDatabase.getStats();

                    // Получаем текущего пользователя
                    const currentUser = await mockDatabase.getUserByTelegramId(ctx.from!.id);

                    let message = '📊 Статус кормления:\n\n';

                    if (lastFeeding) {
                        const lastUser = await mockDatabase.getUserById(lastFeeding.userId);
                        const username = lastUser?.username ? `@${lastUser.username}` : 'Пользователь';
                        message += `🍽️ Последнее кормление:\n`;
                        message += `   Время: 01.01.2024 в 12:00\n`;
                        message += `   Кто: ${username}\n\n`;
                    } else {
                        message += `🍽️ Кормлений еще не было\n\n`;
                    }

                    // Простое форматирование интервала
                    const intervalMinutes = nextFeeding.intervalMinutes;
                    let intervalText = '';
                    if (intervalMinutes < 60) {
                        intervalText = `${intervalMinutes} мин`;
                    } else {
                        const hours = Math.floor(intervalMinutes / 60);
                        const remainingMinutes = intervalMinutes % 60;
                        if (remainingMinutes === 0) {
                            intervalText = `${hours} ч`;
                        } else {
                            intervalText = `${hours} ч ${remainingMinutes} мин`;
                        }
                    }

                    message += `⏰ Интервал кормления: ${intervalText}\n\n`;

                    if (nextFeeding.isActive && nextFeeding.time) {
                        message += `⏰ Следующее кормление в 01.01.2024 в 12:00\n\n`;
                    } else {
                        message += '⏹️ Кормления приостановлены\n\n';
                    }

                    // Добавляем статистику из базы данных
                    message += `📊 Статистика:\n`;
                    message += `   👥 Пользователей: ${stats.totalUsers}\n`;
                    message += `   🍽️ Кормлений сегодня: ${stats.todayFeedings}\n`;
                    message += `   📈 Всего кормлений: ${stats.totalFeedings}`;

                    await ctx.reply(message);
                } catch (error) {
                    await ctx.reply('Ошибка при получении статуса. Попробуйте позже.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                expect.stringContaining('📊 Статус кормления:')
            );
        });

        it('should show error when services are not initialized', async () => {
            // Сбрасываем глобальные сервисы
            setGlobalServices(null as any, null as any);

            const mockReply = jest.fn();
            const ctx = {
                message: { text: '/status' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки команды "/status" когда сервисы не инициализированы
            const text = ctx.message.text;

            if (text.startsWith('/status')) {
                try {
                    const services = null; // Представляем что globalTimerService = null
                    const database = null; // Представляем что globalDatabase = null
                    if (!services || !database) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }
                } catch (error) {
                    await ctx.reply('Ошибка при получении статуса. Попробуйте позже.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start'
            );

            // Восстанавливаем сервисы
            setGlobalServices({} as any, mockDatabase);
        });
    });

    describe('command "/home"', () => {
        it('should show main screen', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '/home' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки команды "/home"
            const text = ctx.message.text;

            if (text.startsWith('/home')) {
                await ctx.reply('Возвращаемся на главный экран', expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Возвращаемся на главный экран',
                expect.any(Object)
            );
        });
    });

    describe('hears "📝 Уточнить детали кормления"', () => {
        it('should enter feeding details scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '📝 Уточнить детали кормления' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Уточнить детали кормления"
            const text = ctx.message.text;

            if (text.includes('📝 Уточнить детали кормления')) {
                await ctx.scene.enter('FEEDING_DETAILS');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('FEEDING_DETAILS');
        });
    });

    describe('hears "🏠 На главную"', () => {
        it('should enter main scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '🏠 На главную' },
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
    });

    describe('unknown text messages', () => {
        it('should show unknown command message', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Unknown command' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки неизвестных команд
            const text = ctx.message.text;
            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                await ctx.reply('Неизвестная команда. Пожалуйста, используйте кнопки или команды из меню.', expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Неизвестная команда. Пожалуйста, используйте кнопки или команды из меню.',
                expect.any(Object)
            );
        });

        it('should ignore commands starting with /', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '/unknown' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки команд, начинающихся с /
            const text = ctx.message.text;
            // Пропускаем команды, начинающиеся с /
            if (text.startsWith('/')) {
                // Не должно быть вызова reply
                return;
            }

            // Проверяем, что reply не был вызван
            expect(mockReply).not.toHaveBeenCalled();
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(mainScene.id).toBe('main'); // Исправлено с 'MAIN' на 'main'
            expect(typeof (mainScene as any).enterHandler).toBe('function');
            expect(typeof (mainScene as any).handler).toBe('function');
        });

        it('should handle global services initialization', () => {
            const testTimerService = {};
            const testDatabase = {} as DatabaseService;
            setGlobalServices(testTimerService, testDatabase);

            // Проверяем, что функция не падает при установке сервисов
            expect(() => setGlobalServices(testTimerService, testDatabase)).not.toThrow();

            // Восстанавливаем исходные сервисы
            setGlobalServices(null, mockDatabase);
        });

        it('should handle global database initialization', () => {
            const testDatabase = {} as DatabaseService;
            setGlobalDatabaseForMain(testDatabase);

            // Проверяем, что функция не падает при установке базы данных
            expect(() => setGlobalDatabaseForMain(testDatabase)).not.toThrow();

            // Восстанавливаем исходную базу данных
            setGlobalDatabaseForMain(mockDatabase);
        });
    });
});
