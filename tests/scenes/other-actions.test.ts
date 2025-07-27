import { Scenes } from 'telegraf';
import { otherActionsScene, setGlobalServicesForOtherActions } from '../../src/scenes/other-actions';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для TimerService
const mockTimerService = {
  stopAllTimers: jest.fn()
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
  updateUserNotifications: jest.fn()
} as unknown as DatabaseService;

// Mock для функции getOrCreateUser
let mockGetOrCreateUser: jest.Mock;

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('otherActionsScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Сброс mock для функции getOrCreateUser
    mockGetOrCreateUser = jest.fn();
    
    // Установка глобальных сервисов для otherActionsScene
    setGlobalServicesForOtherActions(mockTimerService, mockDatabase, mockGetOrCreateUser);
    
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
    it('should show other actions menu', async () => {
      await (otherActionsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Выберите действие:',
        expect.any(Object)
      );
    });
  });

  describe('hears "⏹️ Завершить кормления на сегодня"', () => {
    it('should show error when services are not initialized', async () => {
      // Сбрасываем глобальные сервисы
      setGlobalServicesForOtherActions(null as any, null as any, null as any);
      
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⏹️ Завершить кормления на сегодня'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Ошибка: сервисы не инициализированы. Попробуйте перезапустить бота командой /start'
      );
    });

    it('should stop all timers and notify users', async () => {
      mockGetOrCreateUser.mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210
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
      
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⏹️ Завершить кормления на сегодня'));
      await handler.handler(ctx);
      
      expect(mockTimerService.stopAllTimers).toHaveBeenCalled();
      expect(ctx.telegram.sendMessage).toHaveBeenCalledWith(
        123456789,
        expect.stringContaining('⏹️ Кормления приостановлены.')
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        'Возвращаемся на главный экран',
        expect.objectContaining({
          resize_keyboard: true
        })
      );
    });

    it('should show error message when database error occurs', async () => {
      mockGetOrCreateUser.mockRejectedValueOnce(new Error('Database error'));
      
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⏹️ Завершить кормления на сегодня'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Произошла ошибка при остановке кормлений. Попробуйте еще раз.'
      );
    });
  });

  describe('hears "📅 Внеочередные кормления"', () => {
    it('should show schedule management menu', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📅 Внеочередные кормления'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📅 Внеочередные кормления'),
        expect.any(Object)
      );
    });
  });

  describe('hears "📅 Запланировать кормление"', () => {
    it('should enter schedule feeding scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📅 Запланировать кормление'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULE_FEEDING');
    });
  });

  describe('hears "📋 Просмотреть запланированные"', () => {
    it('should enter scheduled list scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 Просмотреть запланированные'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULED_LIST');
    });
  });

  describe('hears "❌ Отменить запланированные"', () => {
    it('should enter scheduled list scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('❌ Отменить запланированные'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULED_LIST');
    });
  });

  describe('hears "📋 История кормлений"', () => {
    it('should enter history scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 История кормлений'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });
  });

  describe('hears "⚙️ Настройки"', () => {
    it('should enter settings scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⚙️ Настройки'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });
  });

  describe('hears "🏠 На главную"', () => {
    it('should enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('hears "📋 На главную к списку"', () => {
    it('should enter scheduled list scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 На главную к списку'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULED_LIST');
    });
  });

  describe('on text (unknown command)', () => {
    it('should show menu and prompt to use buttons', async () => {
      ctx.message = { text: 'Unknown command' };
      
      await (otherActionsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Используйте кнопки меню для навигации.',
        expect.any(Object)
      );
    });
  });
});
