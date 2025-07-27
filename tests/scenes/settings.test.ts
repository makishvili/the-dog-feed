import { Scenes } from 'telegraf';
import { settingsScene } from '../../src/scenes/settings';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

describe('settingsScene', () => {
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
    it('should show settings menu', async () => {
      await (settingsScene as any).enterMiddleware()[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        '⚙️ Настройки',
        expect.any(Object)
      );
    });
  });

  describe('hears "🍽️ корм"', () => {
    it('should enter food settings scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🍽️ корм'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('FOOD_SETTINGS');
    });
  });

  describe('hears "⏰ интервал"', () => {
    it('should enter interval settings scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('⏰ интервал'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('INTERVAL_SETTINGS');
    });
  });

  describe('hears "🔔 уведомления"', () => {
    it('should enter notification settings scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🔔 уведомления'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('NOTIFICATION_SETTINGS');
    });
  });

  describe('hears "🏠 На главную"', () => {
    it('should enter main scene', async () => {
      // Получаем обработчики для hears
      const hearsHandlers = (settingsScene as any).hearsHandlers;
      // Находим нужный обработчик по паттерну
      const handler = hearsHandlers.find((h: any) => h.triggers.includes('🏠 На главную'));
      await handler.handler(ctx);
      
      expect(ctx.scene.enter).toHaveBeenCalledWith('MAIN');
    });
  });

  describe('on text (unknown command)', () => {
    it('should show menu and prompt to use buttons', async () => {
      ctx.message = { text: 'Unknown command' };
      
      await (settingsScene as any).onMiddleware('text')[0](ctx);
      
      expect(ctx.reply).toHaveBeenCalledWith(
        'Используйте кнопки меню для навигации.',
        expect.any(Object)
      );
    });
  });
});
