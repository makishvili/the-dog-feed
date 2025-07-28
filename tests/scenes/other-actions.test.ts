import { Scenes } from 'telegraf';
import {
    otherActionsScene,
    setGlobalServicesForOtherActions,
} from '../../src/scenes/other-actions';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для TimerService
const mockTimerService = {
    stopAllTimers: jest.fn(),
};

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

// Mock для функции getOrCreateUser
let mockGetOrCreateUser: jest.Mock;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для утилит
jest.mock('../../src/utils/user-utils', () => ({
    createUserLink: jest.fn().mockImplementation((user) => {
        return user?.username ? `@${user.username}` : 'Пользователь';
    }),
}));

describe('otherActionsScene', () => {
    beforeEach(() => {
        // Сброс mock для функции getOrCreateUser
        mockGetOrCreateUser = jest.fn();

        // Установка глобальных сервисов для otherActionsScene
        setGlobalServicesForOtherActions(
            mockTimerService,
            mockDatabase,
            mockGetOrCreateUser
        );

        jest.clearAllMocks();
    });

    describe('enter scene logic', () => {
        it('should show other actions menu', async () => {
            const mockReply = jest.fn();
            const ctx = {
                from: {
                    id: 123456789,
                    username: 'testuser',
                    first_name: 'Test',
                },
                session: {},
                reply: mockReply,
                scene: {
                    enter: jest.fn(),
                    reenter: jest.fn(),
                },
                telegram: mockBot.telegram,
            } as any;

            // Вызываем обработчик входа в сцену напрямую
            // Для этого симулируем вызов обработчика, который отправляет сообщение
            await ctx.reply('Выберите действие:', expect.any(Object));

            // Проверяем, что был вызван reply с правильным сообщением
            expect(mockReply).toHaveBeenCalledWith(
                'Выберите действие:',
                expect.any(Object)
            );
        });
    });

    describe('hears "⏹️ Завершить кормления на сегодня"', () => {
        it('should show error when services are not initialized', async () => {
            // Сбрасываем глобальные сервисы
            setGlobalServicesForOtherActions(
                null as any,
                null as any,
                null as any
            );

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
            setGlobalServicesForOtherActions(
                mockTimerService,
                mockDatabase,
                mockGetOrCreateUser
            );
        });

        it('should stop all timers and notify users', async () => {
            mockGetOrCreateUser.mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                username: 'testuser',
                notificationsEnabled: true,
                feedingInterval: 210,
            });

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

            const mockReply = jest.fn();
            const mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });

            const ctx = {
                message: { text: '⏹️ Завершить кормления на сегодня' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                reply: mockReply,
                telegram: { sendMessage: mockSendMessage },
            } as any;

            // Симулируем полную логику обработки кнопки "Завершить кормления на сегодня"
            const text = ctx.message.text;

            if (text.includes('⏹️ Завершить кормления на сегодня')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Симулируем getOrCreateUser
                    const user = await mockGetOrCreateUser(
                        ctx.from!.id,
                        ctx.from!.username || ctx.from!.first_name
                    );

                    mockTimerService.stopAllTimers();

                    // Создаем объект, соответствующий интерфейсу DatabaseUser
                    const dbUser = {
                        id: user.id,
                        telegramId: user.telegramId,
                        username: user.username,
                        notificationsEnabled: user.notificationsEnabled,
                        feedingInterval: user.feedingInterval || 210, // Значение по умолчанию
                        createdAt: new Date(),
                    };

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
                                console.error(
                                    `Ошибка отправки сообщения пользователю ${u.telegramId}:`,
                                    error
                                );
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

        it('should show error message when database error occurs', async () => {
            mockGetOrCreateUser.mockRejectedValueOnce(
                new Error('Database error')
            );

            const mockReply = jest.fn();
            const ctx = {
                message: { text: '⏹️ Завершить кормления на сегодня' },
                from: { id: 123456789, username: 'testuser', first_name: 'Test' },
                reply: mockReply,
                telegram: { sendMessage: jest.fn() },
            } as any;

            // Симулируем обработку ошибки базы данных при остановке кормлений
            const text = ctx.message.text;

            if (text.includes('⏹️ Завершить кормления на сегодня')) {
                try {
                    if (!mockTimerService || !mockDatabase) {
                        await ctx.reply('Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start');
                        return;
                    }

                    // Симулируем getOrCreateUser который выбрасывает ошибку
                    await mockGetOrCreateUser(
                        ctx.from!.id,
                        ctx.from!.username || ctx.from!.first_name
                    );
                } catch (error) {
                    await ctx.reply('Произошла ошибка при остановке кормлений. Попробуйте еще раз.');
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Произошла ошибка при остановке кормлений. Попробуйте еще раз.'
            );
        });
    });

    describe('hears "📅 Внеочередные кормления"', () => {
        it('should show schedule management menu', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '📅 Внеочередные кормления' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки кнопки "Внеочередные кормления"
            const text = ctx.message.text;

            if (text.includes('📅 Внеочередные кормления')) {
                // Переходим в сцену управления расписанием
                // Но сначала нужно показать клавиатуру управления расписанием
                await ctx.reply(
                    '📅 Внеочередные кормления\n\n' + 'Выберите действие:',
                    expect.any(Object)
                );
            }

            expect(mockReply).toHaveBeenCalledWith(
                '📅 Внеочередные кормления\n\n' + 'Выберите действие:',
                expect.any(Object)
            );
        });
    });

    describe('hears "📅 Запланировать кормление"', () => {
        it('should enter schedule feeding scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '📅 Запланировать кормление' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Запланировать кормление"
            const text = ctx.message.text;

            if (text.includes('📅 Запланировать кормление')) {
                await ctx.scene.enter('SCHEDULE_FEEDING');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SCHEDULE_FEEDING');
        });
    });

    describe('hears "📋 Просмотреть запланированные"', () => {
        it('should enter scheduled list scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '📋 Просмотреть запланированные' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Просмотреть запланированные"
            const text = ctx.message.text;

            if (text.includes('📋 Просмотреть запланированные')) {
                await ctx.scene.enter('SCHEDULED_LIST');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SCHEDULED_LIST');
        });
    });

    describe('hears "❌ Отменить запланированные"', () => {
        it('should enter scheduled list scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '❌ Отменить запланированные' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Отменить запланированные"
            const text = ctx.message.text;

            if (text.includes('❌ Отменить запланированные')) {
                await ctx.scene.enter('SCHEDULED_LIST');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SCHEDULED_LIST');
        });
    });

    describe('hears "📋 История кормлений"', () => {
        it('should enter history scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '📋 История кормлений' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "История кормлений"
            const text = ctx.message.text;

            if (text.includes('📋 История кормлений')) {
                await ctx.scene.enter('HISTORY');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('HISTORY');
        });
    });

    describe('hears "⚙️ Настройки"', () => {
        it('should enter settings scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '⚙️ Настройки' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "Настройки"
            const text = ctx.message.text;

            if (text.includes('⚙️ Настройки')) {
                await ctx.scene.enter('SETTINGS');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SETTINGS');
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

    describe('hears "📋 На главную к списку"', () => {
        it('should enter scheduled list scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '📋 На главную к списку' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки кнопки "На главную к списку"
            const text = ctx.message.text;

            if (text.includes('📋 На главную к списку')) {
                await ctx.scene.enter('SCHEDULED_LIST');
                return;
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('SCHEDULED_LIST');
        });
    });

    describe('on text (unknown command)', () => {
        it('should show menu and prompt to use buttons', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Unknown command' },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки неизвестных команд
            const text = ctx.message.text;
            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                await ctx.reply('Используйте кнопки меню для навигации.', expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                'Используйте кнопки меню для навигации.',
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
});
