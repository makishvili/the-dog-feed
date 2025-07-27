import { Scenes } from 'telegraf';
import { intervalSettingsScene, setGlobalServicesForInterval } from '../../src/scenes/interval-settings';
import { TimeParser } from '../../src/services/parser';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для TimerService
const mockTimerService = {
  getCurrentInterval: jest.fn(),
  updateInterval: jest.fn()
};

// Mock для BotState
const mockBotState = {};

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('intervalSettingsScene', () => {
  let ctx: any;

  beforeEach(() => {
    // Установка глобальных сервисов для intervalSettingsScene
    setGlobalServicesForInterval(mockTimerService, mockBotState);
    
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
    it('should show interval settings menu with current interval from timer service', async () => {
      mockTimerService.getCurrentInterval = jest.fn().mockReturnValue(210);
      
      await (intervalSettingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ интервал'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Текущий интервал: 3 ч 30 мин'),
        expect.any(Object)
      );
    });

    it('should show interval settings menu with default interval when timer service is not available', async () => {
      // Сбрасываем глобальный сервис таймеров
      setGlobalServicesForInterval(null as any, mockBotState);
      
      await (intervalSettingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⏰ интервал'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Текущий интервал: 3 ч 30 мин'),
        expect.any(Object)
      );
    });
  });

  describe('on text', () => {
    it('should enter main scene when "🏠 На главную" is received', async () => {
      ctx.message = { text: '🏠 На главную' };
      
      await (intervalSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });

    it('should enter settings scene when "⬅️ Назад" is received', async () => {
      ctx.message = { text: '⬅️ Назад' };
      
      await (intervalSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('SETTINGS');
    });

    it('should show error when interval parsing fails', async () => {
      ctx.message = { text: 'Invalid interval' };
      
      // Мокаем TimeParser для возврата ошибки
      jest.mock('../../src/services/parser', () => {
        return {
          TimeParser: {
            parseInterval: jest.fn().mockReturnValue({
              isValid: false,
              error: 'Неверный формат'
            }),
            formatInterval: jest.fn().mockReturnValue('3 ч 30 мин'),
            getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2'])
          }
        };
      });
      
      await (intervalSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('❌ Ошибка: Неверный формат'),
        expect.any(Object)
      );
    });

    it('should update interval settings and session', async () => {
      ctx.message = { text: '4 часа' };
      
      // Мокаем TimeParser для успешного парсинга
      jest.mock('../../src/services/parser', () => {
        return {
          TimeParser: {
            parseInterval: jest.fn().mockReturnValue({
              isValid: true,
              minutes: 240,
              error: null
            }),
            formatInterval: jest.fn().mockReturnValue('4 ч 0 мин'),
            getExamples: jest.fn().mockReturnValue(['Пример 1', 'Пример 2'])
          }
        };
      });
      
      await (intervalSettingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.session.feedingInterval).toBe(240);
      expect(mockTimerService.updateInterval).toHaveBeenCalledWith(240);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('✅ Интервал кормления обновлен!'),
        expect.any(Object)
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Новый интервал: 4 ч 0 мин'),
        expect.any(Object)
      );
    });
  });
});
