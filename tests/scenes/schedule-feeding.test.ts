import { Scenes } from 'telegraf';
import { 
  scheduleFeedingScene, 
  setGlobalSchedulerForScheduleFeeding,
  setGlobalDatabaseForScheduleFeeding
} from '../../src/scenes/schedule-feeding';
import { DatabaseService } from '../../src/services/database';
import { SchedulerService } from '../../src/services/scheduler';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для DatabaseService
const mockDatabase = {
  getUserByTelegramId: jest.fn(),
  createUser: jest.fn()
} as unknown as DatabaseService;

// Mock для SchedulerService
const mockSchedulerService = {
  scheduleFeeding: jest.fn()
};

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

// Mock для getOrCreateUser
jest.mock('../../src/scenes/main', () => {
  return {
    getOrCreateUser: jest.fn()
  };
});

describe('scheduleFeedingScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Установка глобальных сервисов для scheduleFeedingScene
    setGlobalSchedulerForScheduleFeeding(mockSchedulerService as any);
    setGlobalDatabaseForScheduleFeeding(mockDatabase);
    
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
    it('should show schedule feeding menu', async () => {
      await (scheduleFeedingScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('📅 Запланировать кормление'),
        expect.any(Object)
      );
    });
  });

  describe('on text (time input)', () => {
    it('should show error when scheduler service is not initialized', async () => {
      ctx.message = { text: '10:00' };
      
      // Сбрасываем глобальный сервис планировщика
      setGlobalSchedulerForScheduleFeeding(null as any);
      
      await (scheduleFeedingScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Сервис планировщика не инициализирован',
        expect.any(Object)
      );
    });

    it('should schedule feeding with time only format', async () => {
      ctx.message = { text: '10:00' };
      
      // Мокаем getOrCreateUser
      const { getOrCreateUser } = require('../../src/scenes/main');
      getOrCreateUser.mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210
      });
      
      // Мокаем scheduleFeeding
      mockSchedulerService.scheduleFeeding.mockResolvedValueOnce({
        id: 1,
        scheduledTime: new Date('2023-07-26T10:00:00Z'),
        createdBy: 1
      });
      
      await (scheduleFeedingScene as any).onMiddleware('text')[0](ctx);
      
      expect(mockSchedulerService.scheduleFeeding).toHaveBeenCalledWith(
        expect.any(Date),
        1
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Кормление успешно запланировано'),
        expect.any(Object)
      );
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should show error message for invalid time format', async () => {
      ctx.message = { text: 'invalid time' };
      
      // Мокаем getOrCreateUser
      const { getOrCreateUser } = require('../../src/scenes/main');
      getOrCreateUser.mockResolvedValueOnce({
        id: 1,
        telegramId: 123456789,
        username: 'testuser',
        notificationsEnabled: true,
        feedingInterval: 210
      });
      
      await (scheduleFeedingScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Неверный формат времени',
        expect.any(Object)
      );
    });

    it('should ignore button presses', async () => {
      ctx.message = { text: '❌ Отменить ввод' };
      
      await (scheduleFeedingScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).not.toHaveBeenCalled();
    });
  });

  describe('hears "❌ Отменить ввод"', () => {
    it('should cancel feeding creation and enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (scheduleFeedingScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('❌ Отменить ввод'));
      await handler.handler(ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '❌ Создание кормления отменено.',
        expect.any(Object)
      );
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('hears "🏠 На главную"', () => {
    it('should enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (scheduleFeedingScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('command "home"', () => {
    it('should enter main scene', async () => {
      ctx.message = { text: '/home' };
      
      await (scheduleFeedingScene as any).commandMiddleware('home')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });
});
