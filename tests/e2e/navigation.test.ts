import { Scenes } from 'telegraf';
import { mainScene } from '../../src/scenes/main';
import { settingsScene } from '../../src/scenes/settings';
import { foodSettingsScene } from '../../src/scenes/food-settings';
import { intervalSettingsScene } from '../../src/scenes/interval-settings';
import { notificationSettingsScene } from '../../src/scenes/notification-settings';
import { otherActionsScene } from '../../src/scenes/other-actions';
import { historyScene } from '../../src/scenes/history';
import { todayHistoryScene } from '../../src/scenes/today-history';
import { fullHistoryScene } from '../../src/scenes/full-history';
import { exportScene } from '../../src/scenes/export';
import { feedingDetailsScene } from '../../src/scenes/feeding-details';
import { scheduleFeedingScene } from '../../src/scenes/schedule-feeding';
import { scheduledListScene } from '../../src/scenes/scheduled-list';
import { DatabaseService } from '../../src/services/database';
import { TimerService } from '../../src/services/timer';
import { SchedulerService } from '../../src/services/scheduler';
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
  updateFeedingDetails: jest.fn(),
  updateUserNotifications: jest.fn(),
  getTodayFeedings: jest.fn(),
  getTotalFeedingsCount: jest.fn(),
  getFeedingsWithPagination: jest.fn(),
  getUserById: jest.fn(),
  getScheduledFeedingById: jest.fn()
} as unknown as DatabaseService;

// Mock для TimerService
const mockTimerService = {
  startFeedingTimer: jest.fn(),
  stopAllTimers: jest.fn(),
  getCurrentInterval: jest.fn(),
  updateInterval: jest.fn(),
  getNotificationService: jest.fn().mockReturnValue({
    sendToAll: jest.fn()
  })
};

// Mock для SchedulerService
const mockSchedulerService = {
  getActiveScheduledFeedings: jest.fn(),
  scheduleFeeding: jest.fn(),
  cancelScheduledFeeding: jest.fn(),
  cancelAllScheduledFeedings: jest.fn()
};

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;


describe('E2E Navigation Tests', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      from: {
        id: 123456789,
        username: 'testuser',
        first_name: 'Test'
      },
      session: {},
      reply: jest.fn(),
      replyWithDocument: jest.fn(),
      scene: {
        enter: jest.fn(),
        reenter: jest.fn()
      },
      telegram: mockBot.telegram,
      database: mockDatabase
    };
    
    // Установка глобальных сервисов для сцен
    const { setGlobalDatabaseForMain, setGlobalServices } = require('../../src/scenes/main');
    setGlobalDatabaseForMain(mockDatabase);
    setGlobalServices(mockTimerService, mockDatabase);
    
    // Установка глобальных сервисов для других сцен
    const { setGlobalDatabaseForFeedingDetails } = require('../../src/scenes/feeding-details');
    setGlobalDatabaseForFeedingDetails(mockDatabase);
    
    const { setGlobalDatabaseForFoodSettings } = require('../../src/scenes/food-settings');
    setGlobalDatabaseForFoodSettings(mockDatabase);
    
    const { setGlobalServicesForInterval } = require('../../src/scenes/interval-settings');
    setGlobalServicesForInterval(mockTimerService, {});
    
    const { setGlobalDatabaseForNotificationSettings } = require('../../src/scenes/notification-settings');
    setGlobalDatabaseForNotificationSettings(mockDatabase);
    
    const { setGlobalServicesForOtherActions } = require('../../src/scenes/other-actions');
    setGlobalServicesForOtherActions(mockTimerService, mockDatabase, require('../../src/scenes/main').getOrCreateUser);
    
    const { setGlobalDatabaseForTodayHistory, setGlobalSchedulerForTodayHistory, setGlobalTimerForTodayHistory } = require('../../src/scenes/today-history');
    setGlobalDatabaseForTodayHistory(mockDatabase);
    setGlobalSchedulerForTodayHistory(mockSchedulerService);
    setGlobalTimerForTodayHistory(mockTimerService);
    
    const { setGlobalSchedulerForFullHistory, setGlobalTimerForFullHistory } = require('../../src/scenes/full-history');
    setGlobalSchedulerForFullHistory(mockSchedulerService);
    setGlobalTimerForFullHistory(mockTimerService);
    
    const { setGlobalSchedulerForScheduleFeeding, setGlobalDatabaseForScheduleFeeding } = require('../../src/scenes/schedule-feeding');
    setGlobalSchedulerForScheduleFeeding(mockSchedulerService);
    setGlobalDatabaseForScheduleFeeding(mockDatabase);
    
    const { setGlobalSchedulerForScheduledList } = require('../../src/scenes/scheduled-list');
    setGlobalSchedulerForScheduledList(mockSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Main Scene Navigation', () => {
    it('should navigate from main scene to other actions scene', async () => {
      ctx.session.firstVisitDone = true;
      
      // Вход в главную сцену
      const enterHandlers = (mainScene as any).enterHandlers;
      await enterHandlers[0](ctx);
      
      // Нажатие на кнопку "Другие действия"
      const hearsHandlers = (mainScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('Другие действия'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('OTHER_ACTIONS');
    });

    it('should navigate from main scene to feeding details scene', async () => {
      ctx.session.firstVisitDone = true;
      ctx.session.lastFeedingId = 1;
      
      // Вход в главную сцену
      const enterHandlers = (mainScene as any).enterHandlers;
      await enterHandlers[0](ctx);
      
      // Нажатие на кнопку "Уточнить детали кормления"
      const hearsHandlers = (mainScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📝 Уточнить детали кормления'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('FEEDING_DETAILS');
    });

    it('should navigate from main scene to settings scene', async () => {
      ctx.session.firstVisitDone = true;
      
      // Вход в главную сцену
      const enterHandlers = (mainScene as any).enterHandlers;
      await enterHandlers[0](ctx);
      
      // Нажатие на кнопку "⚙️ Настройки"
      const hearsHandlers = (mainScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⚙️ Настройки'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });
  });

  describe('Settings Scene Navigation', () => {
    it('should navigate from settings scene to food settings scene', async () => {
      // Нажатие на кнопку "🍽️ корм"
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🍽️ корм'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('FOOD_SETTINGS');
    });

    it('should navigate from settings scene to interval settings scene', async () => {
      // Нажатие на кнопку "⏰ интервал"
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⏰ интервал'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('INTERVAL_SETTINGS');
    });

    it('should navigate from settings scene to notification settings scene', async () => {
      // Нажатие на кнопку "🔔 уведомления"
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🔔 уведомления'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('NOTIFICATION_SETTINGS');
    });

    it('should navigate from settings scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Food Settings Scene Navigation', () => {
    it('should navigate from food settings scene to main scene', async () => {
      ctx.message = { text: '🏠 На главную' };
      
      // Вызов обработчика on('text')
      const onHandlers = (foodSettingsScene as any).onHandlers;
      const handler = onHandlers.find((h: any) => h.type === 'text');
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should navigate from food settings scene to settings scene', async () => {
      ctx.message = { text: '⬅️ Назад' };
      
      // Вызов обработчика on('text')
      const onHandlers = (foodSettingsScene as any).onHandlers;
      const handler = onHandlers.find((h: any) => h.type === 'text');
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });
  });

  describe('Interval Settings Scene Navigation', () => {
    it('should navigate from interval settings scene to main scene', async () => {
      ctx.message = { text: '🏠 На главную' };
      
      // Вызов обработчика on('text')
      const onHandlers = (intervalSettingsScene as any).onHandlers;
      const handler = onHandlers.find((h: any) => h.type === 'text');
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should navigate from interval settings scene to settings scene', async () => {
      ctx.message = { text: '⬅️ Назад' };
      
      // Вызов обработчика on('text')
      const onHandlers = (intervalSettingsScene as any).onHandlers;
      const handler = onHandlers.find((h: any) => h.type === 'text');
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });
  });

  describe('Notification Settings Scene Navigation', () => {
    it('should navigate from notification settings scene to settings scene', async () => {
      // Нажатие на кнопку "⬅️ Назад"
      const hearsHandlers = (notificationSettingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⬅️ Назад'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });

    it('should navigate from notification settings scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (notificationSettingsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Other Actions Scene Navigation', () => {
    it('should navigate from other actions scene to history scene', async () => {
      // Нажатие на кнопку "📋 История кормлений"
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 История кормлений'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });

    it('should navigate from other actions scene to settings scene', async () => {
      // Нажатие на кнопку "⚙️ Настройки"
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⚙️ Настройки'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });

    it('should navigate from other actions scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should navigate from other actions scene to schedule feeding scene', async () => {
      // Нажатие на кнопку "📅 Запланировать кормление"
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📅 Запланировать кормление'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULE_FEEDING');
    });

    it('should navigate from other actions scene to scheduled list scene', async () => {
      // Нажатие на кнопку "📋 Просмотреть запланированные"
      const hearsHandlers = (otherActionsScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 Просмотреть запланированные'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULED_LIST');
    });
  });

  describe('History Scene Navigation', () => {
    it('should navigate from history scene to today history scene', async () => {
      // Нажатие на кнопку "📅 сегодня"
      const hearsHandlers = (historyScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📅 сегодня'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('TODAY_HISTORY');
    });

    it('should navigate from history scene to full history scene', async () => {
      // Нажатие на кнопку "📋 всё время"
      const hearsHandlers = (historyScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📋 всё время'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('FULL_HISTORY');
    });

    it('should navigate from history scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (historyScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Today History Scene Navigation', () => {
    it('should navigate from today history scene to history scene', async () => {
      // Нажатие на кнопку "⬅️ Назад"
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⬅️ Назад'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });

    it('should navigate from today history scene to main scene', async () => {
      // Нажатие на кнопку "🏠 Главный экран"
      const hearsHandlers = (todayHistoryScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 Главный экран'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Full History Scene Navigation', () => {
    it('should navigate from full history scene to history scene', async () => {
      // Нажатие на кнопку "⬅️ Назад"
      const hearsHandlers = (fullHistoryScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⬅️ Назад'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('HISTORY');
    });

    it('should navigate from full history scene to export scene', async () => {
      // Нажатие на кнопку "📤 Экспорт истории"
      const hearsHandlers = (fullHistoryScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📤 Экспорт истории'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('EXPORT');
    });

    it('should navigate from full history scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (fullHistoryScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Export Scene Navigation', () => {
    it('should navigate from export scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (exportScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Feeding Details Scene Navigation', () => {
    it('should navigate from feeding details scene to main scene', async () => {
      ctx.message = { text: '🏠 На главную' };
      ctx.session.lastFeedingId = 1;
      
      // Вызов обработчика on('text')
      const onHandlers = (feedingDetailsScene as any).onHandlers;
      const handler = onHandlers.find((h: any) => h.type === 'text');
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Schedule Feeding Scene Navigation', () => {
    it('should navigate from schedule feeding scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (scheduleFeedingScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should navigate from schedule feeding scene to main scene when cancelling input', async () => {
      // Нажатие на кнопку "❌ Отменить ввод"
      const hearsHandlers = (scheduleFeedingScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('❌ Отменить ввод'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('Scheduled List Scene Navigation', () => {
    it('should navigate from scheduled list scene to schedule feeding scene', async () => {
      // Нажатие на кнопку "📅 Создать новое кормление"
      const hearsHandlers = (scheduledListScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('📅 Создать новое кормление'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SCHEDULE_FEEDING');
    });

    it('should navigate from scheduled list scene to main scene', async () => {
      // Нажатие на кнопку "🏠 На главную"
      const hearsHandlers = (scheduledListScene as any).hearsHandlers;
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });
});
