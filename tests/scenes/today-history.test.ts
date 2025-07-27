import { Scenes } from 'telegraf';
import { 
  todayHistoryScene, 
  setGlobalDatabaseForTodayHistory,
  setGlobalSchedulerForTodayHistory,
  setGlobalTimerForTodayHistory
} from '../../src/scenes/today-history';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
  getTodayFeedings: jest.fn(),
  getAllUsers: jest.fn(),
  getStats: jest.fn(),
  getLastFeeding: jest.fn(),
  getUserByTelegramId: jest.fn()
} as unknown as DatabaseService;

// Mock для SchedulerService
const mockSchedulerService = {
  getActiveScheduledFeedings: jest.fn()
};

// Mock для TimerService
const mockTimerService = {};

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('todayHistoryScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Установка глобальных сервисов для todayHistoryScene
    setGlobalDatabaseForTodayHistory(mockDatabase);
    setGlobalSchedulerForTodayHistory(mockSchedulerService);
    setGlobalTimerForTodayHistory(mockTimerService as any);
    
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
      setGlobalDatabaseForTodayHistory(null as any);
      
      await (todayHistoryScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
      );
    });

    it('should show today history with no feedings', async () => {
      mockDatabase.getTodayFeedings = jest.fn().mockResolvedValueOnce([]);
      mockDatabase.getAllUsers = jest.fn().mockResolvedValueOnce([]);
      mockDatabase.getStats = jest.fn().mockResolvedValueOnce({
        totalFeedings: 0,
        totalUsers: 0,
        todayFeedings: 0
      });
      mockSchedulerService.getActiveScheduledFeedings = jest.fn().mockResolvedValueOnce([]);
      
      await (todayHistoryScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📅 *История кормлений за сегодня*'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Сегодня кормлений еще не было'),
        expect.any(Object)
      );
    });

    it('should show today history with feedings', async () => {
      const mockFeedings = [
        {
          id: 1,
          userId: 1,
          timestamp: new Date('2023-07-26T10:00:00Z'),
          foodType: 'dry',
          amount: 120,
          details: 'Сухой корм'
        }
      ];
      
      const mockUsers = [
        {
          id: 1,
          telegramId: 123456789,
          username: 'testuser',
          notificationsEnabled: true,
          feedingInterval: 210,
          createdAt: new Date()
        }
      ];
      
      mockDatabase.getTodayFeedings = jest.fn().mockResolvedValueOnce(mockFeedings);
      mockDatabase.getAllUsers = jest.fn().mockResolvedValueOnce(mockUsers);
      mockDatabase.getStats = jest.fn().mockResolvedValueOnce({
        totalFeedings: 1,
        totalUsers: 1,
        todayFeedings: 1
      });
      mockSchedulerService.getActiveScheduledFeedings = jest.fn().mockResolvedValueOnce([]);
      
      await (todayHistoryScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📅 *История кормлений за сегодня*'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📊 Всего кормлений: 1'),
        expect.any(Object)
      );
    });

    it('should show error message when database error occurs', async () => {
      mockDatabase.getTodayFeedings = jest.fn().mockRejectedValueOnce(new Error('Database error'));
      
      await (todayHistoryScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Произошла ошибка при загрузке истории кормлений. Попробуйте позже.',
        expect.any(Object)
      );
    });
  });

  describe('hears "🔄 Обновить"', () => {
    it('should reenter scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🔄 Обновить'));
      await handler.handler(ctx);
      
      expect(ctx.scene.reenter).toHaveBeenCalled();
    });
  });

  describe('hears "📋 Вся история"', () => {
    it('should enter history scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 Вся история'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });
  });

  describe('hears "⬅️ Назад"', () => {
    it('should enter history scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⬅️ Назад'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });
  });

  describe('hears "🏠 Главный экран"', () => {
    it('should enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 Главный экран'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('command "home"', () => {
    it('should enter main scene', async () => {
      ctx.message = { text: '/home' };
      
      await (todayHistoryScene as any).commandMiddleware('home')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('command "status"', () => {
    it('should show error when database is not initialized', async () => {
      ctx.message = { text: '/status' };
      
      // Сбрасываем глобальную базу данных
      setGlobalDatabaseForTodayHistory(null as any);
      
      await (todayHistoryScene as any).commandMiddleware('status')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith('Ошибка: база данных не инициализирована.');
    });

    it('should show status with last feeding', async () => {
      ctx.message = { text: '/status' };
      
      mockDatabase.getLastFeeding = jest.fn().mockResolvedValueOnce({
        id: 1,
        userId: 1,
        timestamp: new Date('2023-07-26T10:00:00Z'),
        foodType: 'dry',
        amount: 120,
        details: 'Сухой корм'
      });
      
      mockDatabase.getStats = jest.fn().mockResolvedValueOnce({
        totalFeedings: 1,
        totalUsers: 1,
        todayFeedings: 1
      });
      
      mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      });
      
      await (todayHistoryScene as any).commandMiddleware('status')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📊 Статус кормления:'),
        undefined
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Последнее кормление:'),
        undefined
      );
    });

    it('should show status with no feedings', async () => {
      ctx.message = { text: '/status' };
      
      mockDatabase.getLastFeeding = jest.fn().mockResolvedValueOnce(null);
      mockDatabase.getStats = jest.fn().mockResolvedValueOnce({
        totalFeedings: 0,
        totalUsers: 0,
        todayFeedings: 0
      });
      
      await (todayHistoryScene as any).commandMiddleware('status')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📊 Статус кормления:'),
        undefined
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Кормлений еще не было'),
        undefined
      );
    });

    it('should show error message when database error occurs', async () => {
      ctx.message = { text: '/status' };
      
      mockDatabase.getLastFeeding = jest.fn().mockRejectedValueOnce(new Error('Database error'));
      
      await (todayHistoryScene as any).commandMiddleware('status')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith('Ошибка при получении статуса. Попробуйте позже.');
    });
  });

  describe('on text (unknown command)', () => {
    it('should show menu and prompt to use buttons', async () => {
      ctx.message = { text: 'Unknown command' };
      
      await (todayHistoryScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Я не понимаю эту команду. Используйте кнопки меню.',
        expect.any(Object)
      );
    });

    it('should ignore commands starting with /', async () => {
      ctx.message = { text: '/unknown' };
      
      await (todayHistoryScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });
});
