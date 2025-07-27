import { Scenes } from 'telegraf';
import { foodSettingsScene, setGlobalDatabaseForFoodSettings } from '../../src/scenes/food-settings';
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
  updateFeedingDetails: jest.fn()
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('foodSettingsScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Установка глобальной базы данных для foodSettingsScene
    setGlobalDatabaseForFoodSettings(mockDatabase);
    
    ctx = {
      from: {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test'
      },
      session: {},
      reply: jest.fn(),
      scene: {
        enter: jest.fn(),
        reenter: jest.fn()
      },
      telegram: mockBot.telegram
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('enter', () => {
    it('should show error message when database is not initialized', async () => {
      // Сбрасываем глобальную базу данных
      setGlobalDatabaseForFoodSettings(null as any);
      
      await (foodSettingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
      );
    });

    it('should show food settings menu with current settings', async () => {
      mockDatabase.getSetting = jest.fn()
        .mockResolvedValueOnce('dry') // default_food_type
        .mockResolvedValueOnce('12'); // default_food_amount
      
      await (foodSettingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ корм'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Текущие настройки:'),
        expect.any(Object)
      );
    });

    it('should show error message when database error occurs', async () => {
      mockDatabase.getSetting = jest.fn().mockRejectedValueOnce(new Error('Database error'));
      
      await (foodSettingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Ошибка получения настроек. Попробуйте еще раз.',
        expect.any(Object)
      );
    });
  });

  describe('on text', () => {
    it('should enter main scene when "🏠 На главную" is received', async () => {
      ctx.message = { text: '🏠 На главную' };
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should enter settings scene when "⬅️ Назад" is received', async () => {
      ctx.message = { text: '⬅️ Назад' };
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });

    it('should show error when database is not initialized', async () => {
      ctx.message = { text: 'Сухой корм 150г' };
      
      // Сбрасываем глобальную базу данных
      setGlobalDatabaseForFoodSettings(null as any);
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
      );
    });

    it('should show error when details parsing fails', async () => {
      ctx.message = { text: 'Invalid details' };
      
      // Мокаем FeedingParser для возврата ошибки
      jest.mock('../../src/services/feeding-parser', () => {
        return {
          FeedingParser: {
            parseDetails: jest.fn().mockReturnValue({
              isValid: false,
              error: 'Неверный формат'
            }),
            getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2'])
          }
        };
      });
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Ошибка: Неверный формат'),
        expect.any(Object)
      );
    });

    it('should update food settings and notify users', async () => {
      ctx.message = { text: 'Сухой корм 150г' };
      
      // Мокаем FeedingParser для успешного парсинга
      jest.mock('../../src/services/feeding-parser', () => {
        return {
          FeedingParser: {
            parseDetails: jest.fn().mockReturnValue({
              isValid: true,
              amount: 150,
              foodType: 'dry',
              details: 'Сухой корм 150г'
            }),
            getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2'])
          }
        };
      });
      
      mockDatabase.setSetting = jest.fn().mockResolvedValue(undefined);
      
      mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      });
      
      mockDatabase.getAllUsers = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          telegramId: 123456789,
          username: 'testuser',
          notificationsEnabled: true,
          feedingInterval: 210,
          createdAt: new Date()
        }
      ]);
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(mockDatabase.setSetting).toHaveBeenCalledWith('default_food_amount', '150');
      expect(mockDatabase.setSetting).toHaveBeenCalledWith('default_food_type', 'dry');
      expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(123456789, expect.stringContaining('🍽️ ✅ Настройки корма обновлены!'));
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Настройки корма обновлены!'),
        expect.any(Object)
      );
    });

    it('should show error message when database error occurs during update', async () => {
      ctx.message = { text: 'Сухой корм 150г' };
      
      // Мокаем FeedingParser для успешного парсинга
      jest.mock('../../src/services/feeding-parser', () => {
        return {
          FeedingParser: {
            parseDetails: jest.fn().mockReturnValue({
              isValid: true,
              amount: 150,
              foodType: 'dry',
              details: 'Сухой корм 150г'
            }),
            getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2'])
          }
        };
      });
      
      mockDatabase.setSetting = jest.fn().mockRejectedValueOnce(new Error('Database error'));
      
      await (foodSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
        expect.any(Object)
      );
    });
  });
});
