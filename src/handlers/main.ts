import { Context } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseUser, DatabaseFeeding } from '../services/database';
import { TimerService } from '../services/timer';
import { DatabaseService } from '../services/database';
import { MESSAGES, SCENES } from '../utils/constants';
import { toMoscowTime, formatDateTime } from '../utils/time-utils';

export class MainHandler {
  private timerService: TimerService;
  private database: DatabaseService;

  constructor(timerService: TimerService, database: DatabaseService) {
    this.timerService = timerService;
    this.database = database;
  }

  // Обработка кнопки "Собачка поел"
  async handleFeeding(ctx: BotContext): Promise<void> {
    try {
      const user = await this.getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username || ctx.from!.first_name
      );

      // Получаем текущие настройки корма из БД
      const foodType = await this.database.getSetting('default_food_type') || 'dry';
      const foodAmount = parseInt(await this.database.getSetting('default_food_amount') || '12');

      // Создание записи о кормлении в БД с текущими настройками
      const feeding = await this.database.createFeeding(user.id, foodType, foodAmount);

      // Сохраняем ID кормления в сессии для возможности уточнения деталей
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.lastFeedingId = feeding.id;

      // Запуск таймера на следующее кормление
      this.timerService.startFeedingTimer();

      // Форматирование информации о корме
      const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

      // Уведомление всех пользователей через NotificationService
      const nextFeedingTime = new Date(toMoscowTime(feeding.timestamp).getTime() + this.timerService.getCurrentInterval() * 60 * 1000);
      const formattedNextTime = `${nextFeedingTime.getHours().toString().padStart(2, '0')}:${nextFeedingTime.getMinutes().toString().padStart(2, '0')}`;
      
      const message = `🍽️ Собаку покормили!\n` +
        `${formatDateTime(toMoscowTime(feeding.timestamp)).replace(', ', ' в ')}\n` +
        `${user.username || 'Пользователь'} дал ${foodInfo}\n\n` +
        `⏰ Следующее кормление в ${formattedNextTime} (через ${Math.round(this.timerService.getCurrentInterval() / 60)} ч ${this.timerService.getCurrentInterval() % 60} мин)`;

      const notificationService = this.timerService.getNotificationService();
      await notificationService.sendToAll(message);

      console.log(`Кормление записано: ${user.username} в ${toMoscowTime(feeding.timestamp)}, ${foodInfo}`);

    } catch (error) {
      console.error('Ошибка обработки кормления:', error);
      ctx.reply('❌ Произошла ошибка при записи кормления. Попробуйте еще раз.');
    }
  }

  // Обработка кнопки "Завершить кормления на сегодня"
  async handleStopFeedings(ctx: BotContext): Promise<void> {
    try {
      const user = await this.getOrCreateUser(
        ctx.from!.id,
        ctx.from!.username || ctx.from!.first_name
      );

      this.timerService.stopAllTimers();

      const message = `${MESSAGES.FEEDINGS_STOPPED}\n` +
        `Инициатор: ${user.username || 'Пользователь'}\n\n` +
        `Чтобы возобновить кормления, нажмите "🍽️ Собачка поел"`;

      // Уведомление всех пользователей через NotificationService
      const notificationService = this.timerService.getNotificationService();
      await notificationService.sendToAll(message);

      console.log(`Кормления остановлены пользователем: ${user.username}`);

    } catch (error) {
      console.error('Ошибка остановки кормлений:', error);
      ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
    }
  }

  // Получение или создание пользователя
  private async getOrCreateUser(telegramId: number, username?: string): Promise<DatabaseUser> {
    let user = await this.database.getUserByTelegramId(telegramId);

    if (!user) {
      user = await this.database.createUser(telegramId, username);
      console.log(`Новый пользователь создан: ${username || telegramId}`);
    }

    return user;
  }
}
