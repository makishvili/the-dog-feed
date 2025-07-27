import { Scenes } from 'telegraf';
import { mainScene, setGlobalDatabaseForMain, setGlobalServices } from '../../src/scenes/main';
import { DatabaseService } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
  getUserByTelegramId: jest.fn(),
  createUser: jest.fn(),
  getSetting: jest.fn(),
  createFeeding: jest.fn(),
  getAllUsers: jest.fn(),
  getLastFeeding: jest.fn(),
  getStats: jest.fn()
} as unknown as DatabaseService;

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('mainScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Установка глобальной базы данных для mainScene
    setGlobalDatabaseForMain(mockDatabase);
    
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
    it('should show welcome message on first visit', async () => {
      ctx.session.firstVisitDone = false;
      
      // Вызываем обработчик события enter
      const enterHandlers = (mainScene as any).enterHandlers;
      await enterHandlers[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
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
      ctx.session.firstVisitDone = true;
      
      // Вызываем обработчик события enter
      const enterHandlers = (mainScene as any).enterHandlers;
      await enterHandlers[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Возвращаемся на главный экран',
        expect.any(Object)
      );
    });
  });

  describe('hears "Другие действия"', () => {
    it('should enter other actions scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('Другие действия'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('OTHER_ACTIONS');
    });
  });

  describe('hears "Когда следующее кормление?"', () => {
    it('should show next feeding time', async () => {
      const mockTimerService = {
        getNextFeedingInfo: jest.fn().mockReturnValue({
          isActive: true,
          time: new Date('2023-07-26T10:00:00Z'),
          intervalMinutes: 210
        })
      };
      
      setGlobalServices(mockTimerService, mockDatabase);
      
      // Получаем обработчики для hears
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('Когда следующее кормление?'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ Следующее кормление в 13:00 (через 3 ч 0 мин)')
      );
    });

    it('should show stopped message when timer is not active', async () => {
      const mockTimerService = {
        getNextFeedingInfo: jest.fn().mockReturnValue({
          isActive: false,
          time: null,
          intervalMinutes: 210
        })
      };
      
      setGlobalServices(mockTimerService, mockDatabase);
      
      // Получаем обработчики для hears
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('Когда следующее кормление?'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '⏹️ Кормления приостановлены.\nЧтобы возобновить, нажмите "🍽️ Собачка поел"'
      );
    });
  });

  describe('hears "🍽️ Собачка поел"', () => {
    it('should record feeding and start timer', async () => {
      const mockTimerService = {
        startFeedingTimer: jest.fn(),
        getNextFeedingInfo: jest.fn().mockReturnValue({
          isActive: true,
          time: new Date('2023-07-26T10:00:00Z'),
          intervalMinutes: 210
        })
      };
      
      setGlobalServices(mockTimerService, mockDatabase);
      
      mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      });
      
      mockDatabase.createFeeding = jest.fn().mockResolvedValueOnce({
        id: 1,
        userId: 1,
        timestamp: new Date(),
        foodType: 'dry',
        amount: 12
      });
      
      mockDatabase.getSetting = jest.fn()
        .mockResolvedValueOnce('dry') // default_food_type
        .mockResolvedValueOnce('12'); // default_food_amount
      
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
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🍽️ Собачка поел'));
      await handler.handler(ctx);
      
      expect(mockDatabase.createFeeding).toHaveBeenCalledWith(1, 'dry', 12);
      expect(mockTimerService.startFeedingTimer).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🍽️ Собачка вкусно поел!'),
        expect.any(Object)
      );
    });
  });

  describe('hears "📝 Уточнить детали кормления"', () => {
    it('should enter feeding details scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📝 Уточнить детали кормления'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('FEEDING_DETAILS');
    });
  });

  describe('hears "🏠 На главную"', () => {
    it('should enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (mainScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });
});
