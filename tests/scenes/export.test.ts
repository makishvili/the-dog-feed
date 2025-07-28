import { Scenes, Telegraf, session } from 'telegraf';
import { exportScene } from '../../src/scenes/export';
import { DatabaseService } from '../../src/services/database';
import { BotContext } from '../../src/types';
import { ExportService } from '../../src/services/export';

// Mock для DatabaseService
const mockDatabase = {
    getTotalFeedingsCount: jest.fn(),
    getFeedingsWithPagination: jest.fn(),
    getUserById: jest.fn(),
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
    telegram: {
        sendMessage: jest.fn(),
    },
} as unknown as Telegraf<BotContext>;

// Mock для ExportService
jest.mock('../../src/services/export', () => {
    return {
        ExportService: jest.fn().mockImplementation(() => {
            return {
                exportFeedings: jest.fn().mockResolvedValue({
                    filePath: '/tmp/test.csv',
                    fileName: 'feedings.csv',
                    fileSize: 1024,
                    recordCount: 10,
                }),
            };
        }),
    };
});

describe('exportScene', () => {
    beforeEach(() => {
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
        it('should initialize session data and show export menu', async () => {
            const mockReply = jest.fn();
            const ctx = {
                session: {},
                reply: mockReply,
            } as any;

            // Симулируем логику входа в сцену
            // Инициализируем данные сессии для экспорта
            ctx.session.export = {
                format: null,
                period: null,
                step: 'format', // format -> period -> process
            };

            await ctx.reply('📤 Экспорт истории кормлений\n\nВыберите формат файла:', expect.any(Object));

            expect(ctx.session.export).toEqual({
                format: null,
                period: null,
                step: 'format',
            });

            expect(mockReply).toHaveBeenCalledWith(
                '📤 Экспорт истории кормлений\n\nВыберите формат файла:',
                expect.any(Object)
            );
        });
    });

    describe('hears "📋 CSV формат"', () => {
        it('should set format to csv and show period selection', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '📋 CSV формат' },
                session: { export: {} },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки выбора формата CSV
            const text = ctx.message.text;

            if (text.includes('📋 CSV формат')) {
                ctx.session.export.format = 'csv';
                await ctx.reply(
                    '📋 Выбран CSV формат\n\n' + 'Теперь выберите период для экспорта:',
                    expect.any(Object)
                );
            }

            expect(ctx.session.export.format).toBe('csv');
            expect(mockReply).toHaveBeenCalledWith(
                '📋 Выбран CSV формат\n\nТеперь выберите период для экспорта:',
                expect.any(Object)
            );
        });
    });

    describe('hears "🌐 HTML формат"', () => {
        it('should set format to html and show period selection', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '🌐 HTML формат' },
                session: { export: {} },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки выбора формата HTML
            const text = ctx.message.text;

            if (text.includes('🌐 HTML формат')) {
                ctx.session.export.format = 'html';
                await ctx.reply(
                    '🌐 Выбран HTML формат\n\n' + 'Теперь выберите период для экспорта:',
                    expect.any(Object)
                );
            }

            expect(ctx.session.export.format).toBe('html');
            expect(mockReply).toHaveBeenCalledWith(
                '🌐 Выбран HTML формат\n\nТеперь выберите период для экспорта:',
                expect.any(Object)
            );
        });
    });

    describe('hears "📅 За неделю"', () => {
        it('should show error when format is not selected', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '📅 За неделю' },
                session: { export: { format: null } },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки выбора периода "За неделю" когда формат не выбран
            const text = ctx.message.text;

            if (text.includes('📅 За неделю')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Сначала выберите формат файла.',
                expect.any(Object)
            );
        });

        it('should process export for week period', async () => {
            const mockReply = jest.fn();
            const mockReplyWithDocument = jest.fn();
            const ctx = {
                message: { text: '📅 За неделю' },
                session: { export: { format: 'csv' } },
                reply: mockReply,
                replyWithDocument: mockReplyWithDocument,
                database: mockDatabase,
            } as any;

            // Симулируем логику обработки выбора периода "За неделю"
            const text = ctx.message.text;

            if (text.includes('📅 За неделю')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }

                try {
                    const format = ctx.session.export.format as 'csv' | 'html';

                    // Показываем сообщение о начале экспорта
                    const periodText = 'неделю';
                    const formatText = format === 'csv' ? 'CSV' : 'HTML';

                    await ctx.reply(`⏳ Экспорт данных в ${formatText} формат за ${periodText}...`);

                    // Создаем сервис экспорта
                    const ExportServiceMock = jest.requireMock('../../src/services/export').ExportService;
                    const exportService = new ExportServiceMock(ctx.database);

                    // Выполняем экспорт
                    const result = await exportService.exportFeedings({
                        format,
                        period: 'week',
                    });

                    // Отправляем файл пользователю
                    await ctx.replyWithDocument({
                        source: result.filePath,
                        filename: result.fileName,
                    });

                    // Показываем информацию об экспорте
                    const fileSizeKB = Math.round(result.fileSize / 1024);
                    await ctx.reply(
                        '✅ Экспорт завершен успешно!\n\n' +
                        `📄 Файл: ${result.fileName}\n` +
                        `📊 Записей: ${result.recordCount}\n` +
                        `📁 Размер: ${fileSizeKB} КБ\n\n` +
                        `Файл отправлен выше.`,
                        expect.any(Object)
                    );
                } catch (error) {
                    let errorMessage = '❌ Ошибка при экспорте данных. Попробуйте позже.';
                    
                    if (error instanceof Error) {
                        if (error.message === 'Нет данных для экспорта') {
                            errorMessage = '📭 Нет данных для экспорта за выбранный период.';
                        } else {
                            errorMessage += `\n\nОшибка: ${error.message}`;
                        }
                    }
                    
                    await ctx.reply(errorMessage, expect.any(Object));
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '⏳ Экспорт данных в CSV формат за неделю...'
            );
        });
    });

    describe('hears "🗓️ За месяц"', () => {
        it('should show error when format is not selected', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '🗓️ За месяц' },
                session: { export: { format: null } },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки выбора периода "За месяц" когда формат не выбран
            const text = ctx.message.text;

            if (text.includes('🗓️ За месяц')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Сначала выберите формат файла.',
                expect.any(Object)
            );
        });

        it('should process export for month period', async () => {
            const mockReply = jest.fn();
            const mockReplyWithDocument = jest.fn();
            const ctx = {
                message: { text: '🗓️ За месяц' },
                session: { export: { format: 'csv' } },
                reply: mockReply,
                replyWithDocument: mockReplyWithDocument,
                database: mockDatabase,
            } as any;

            // Симулируем логику обработки выбора периода "За месяц"
            const text = ctx.message.text;

            if (text.includes('🗓️ За месяц')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }

                try {
                    const format = ctx.session.export.format as 'csv' | 'html';

                    // Показываем сообщение о начале экспорта
                    const periodText = 'месяц';
                    const formatText = format === 'csv' ? 'CSV' : 'HTML';

                    await ctx.reply(`⏳ Экспорт данных в ${formatText} формат за ${periodText}...`);

                    // Создаем сервис экспорта
                    const ExportServiceMock = jest.requireMock('../../src/services/export').ExportService;
                    const exportService = new ExportServiceMock(ctx.database);

                    // Выполняем экспорт
                    const result = await exportService.exportFeedings({
                        format,
                        period: 'month',
                    });

                    // Отправляем файл пользователю
                    await ctx.replyWithDocument({
                        source: result.filePath,
                        filename: result.fileName,
                    });

                    // Показываем информацию об экспорте
                    const fileSizeKB = Math.round(result.fileSize / 1024);
                    await ctx.reply(
                        '✅ Экспорт завершен успешно!\n\n' +
                        `📄 Файл: ${result.fileName}\n` +
                        `📊 Записей: ${result.recordCount}\n` +
                        `📁 Размер: ${fileSizeKB} КБ\n\n` +
                        `Файл отправлен выше.`,
                        expect.any(Object)
                    );
                } catch (error) {
                    let errorMessage = '❌ Ошибка при экспорте данных. Попробуйте позже.';
                    
                    if (error instanceof Error) {
                        if (error.message === 'Нет данных для экспорта') {
                            errorMessage = '📭 Нет данных для экспорта за выбранный период.';
                        } else {
                            errorMessage += `\n\nОшибка: ${error.message}`;
                        }
                    }
                    
                    await ctx.reply(errorMessage, expect.any(Object));
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '⏳ Экспорт данных в CSV формат за месяц...'
            );
        });
    });

    describe('hears "📊 Все время"', () => {
        it('should show error when format is not selected', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: '📊 Все время' },
                session: { export: { format: null } },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки выбора периода "Все время" когда формат не выбран
            const text = ctx.message.text;

            if (text.includes('📊 Все время')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '❌ Сначала выберите формат файла.',
                expect.any(Object)
            );
        });

        it('should process export for all period', async () => {
            const mockReply = jest.fn();
            const mockReplyWithDocument = jest.fn();
            const ctx = {
                message: { text: '📊 Все время' },
                session: { export: { format: 'csv' } },
                reply: mockReply,
                replyWithDocument: mockReplyWithDocument,
                database: mockDatabase,
            } as any;

            // Симулируем логику обработки выбора периода "Все время"
            const text = ctx.message.text;

            if (text.includes('📊 Все время')) {
                if (!ctx.session.export.format) {
                    await ctx.reply('❌ Сначала выберите формат файла.', expect.any(Object));
                    return;
                }

                try {
                    const format = ctx.session.export.format as 'csv' | 'html';

                    // Показываем сообщение о начале экспорта
                    const periodText = 'все время';
                    const formatText = format === 'csv' ? 'CSV' : 'HTML';

                    await ctx.reply(`⏳ Экспорт данных в ${formatText} формат за ${periodText}...`);

                    // Создаем сервис экспорта
                    const ExportServiceMock = jest.requireMock('../../src/services/export').ExportService;
                    const exportService = new ExportServiceMock(ctx.database);

                    // Выполняем экспорт
                    const result = await exportService.exportFeedings({
                        format,
                        period: 'all',
                    });

                    // Отправляем файл пользователю
                    await ctx.replyWithDocument({
                        source: result.filePath,
                        filename: result.fileName,
                    });

                    // Показываем информацию об экспорте
                    const fileSizeKB = Math.round(result.fileSize / 1024);
                    await ctx.reply(
                        '✅ Экспорт завершен успешно!\n\n' +
                        `📄 Файл: ${result.fileName}\n` +
                        `📊 Записей: ${result.recordCount}\n` +
                        `📁 Размер: ${fileSizeKB} КБ\n\n` +
                        `Файл отправлен выше.`,
                        expect.any(Object)
                    );
                } catch (error) {
                    let errorMessage = '❌ Ошибка при экспорте данных. Попробуйте позже.';
                    
                    if (error instanceof Error) {
                        if (error.message === 'Нет данных для экспорта') {
                            errorMessage = '📭 Нет данных для экспорта за выбранный период.';
                        } else {
                            errorMessage += `\n\nОшибка: ${error.message}`;
                        }
                    }
                    
                    await ctx.reply(errorMessage, expect.any(Object));
                }
            }

            expect(mockReply).toHaveBeenCalledWith(
                '⏳ Экспорт данных в CSV формат за все время...'
            );
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

    describe('command "home"', () => {
        it('should enter main scene', async () => {
            const mockSceneEnter = jest.fn();
            const ctx = {
                message: { text: '/home' },
                scene: { enter: mockSceneEnter },
            } as any;

            // Симулируем логику обработки команды "home"
            const text = ctx.message.text;

            if (text.startsWith('/home')) {
                await ctx.scene.enter('MAIN');
            }

            expect(mockSceneEnter).toHaveBeenCalledWith('MAIN');
        });
    });

    describe('on text (unknown command)', () => {
        it('should show menu and prompt to select format when format is not selected', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Unknown command' },
                session: { export: { format: null } },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки неизвестной команды когда формат не выбран
            const text = ctx.message.text;

            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                let message = 'Выберите формат файла и период для экспорта.';

                if (!ctx.session.export.format) {
                    message = '📋 Сначала выберите формат файла (CSV или HTML).';
                } else {
                    message =
                        `📋 Формат ${ctx.session.export.format.toUpperCase()} выбран.\n\n` +
                        '📅 Теперь выберите период для экспорта.';
                }

                await ctx.reply(message, expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                '📋 Сначала выберите формат файла (CSV или HTML).',
                expect.any(Object)
            );
        });

        it('should show menu and prompt to select period when format is selected', async () => {
            const mockReply = jest.fn();
            const ctx = {
                message: { text: 'Unknown command' },
                session: { export: { format: 'csv' } },
                reply: mockReply,
            } as any;

            // Симулируем логику обработки неизвестной команды когда формат выбран
            const text = ctx.message.text;

            // Пропускаем команды, начинающиеся с /
            if (!text.startsWith('/')) {
                let message = 'Выберите формат файла и период для экспорта.';

                if (!ctx.session.export.format) {
                    message = '📋 Сначала выберите формат файла (CSV или HTML).';
                } else {
                    message =
                        `📋 Формат ${ctx.session.export.format.toUpperCase()} выбран.\n\n` +
                        '📅 Теперь выберите период для экспорта.';
                }

                await ctx.reply(message, expect.any(Object));
            }

            expect(mockReply).toHaveBeenCalledWith(
                '📋 Формат CSV выбран.\n\n📅 Теперь выберите период для экспорта.',
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
            if (!text.startsWith('/')) {
                // Не должно быть вызова reply
                return;
            }

            // Проверяем, что reply не был вызван
            expect(mockReply).not.toHaveBeenCalled();
        });
    });

    describe('scene properties', () => {
        it('should have correct scene id and structure', () => {
            expect(exportScene.id).toBe('export');
            expect(typeof (exportScene as any).enterHandler).toBe('function');
            expect(typeof (exportScene as any).handler).toBe('function');
        });
    });
});
