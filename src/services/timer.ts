import { Telegraf } from 'telegraf';
import { BotContext } from '../types';
import { DEFAULT_FEEDING_INTERVAL_MINUTES } from '../utils/constants';
import { NotificationService } from './notifications';
import { DatabaseService } from './database';
import { toMoscowTime } from '../utils/time-utils';

export interface TimerState {
  nextFeedingTime: Date | null;
  isActive: boolean;
  reminderInterval: NodeJS.Timeout | null;
  feedingTimeout: NodeJS.Timeout | null;
  currentIntervalMinutes: number;
}

export class TimerService {
  private bot: Telegraf<BotContext>;
  private database: DatabaseService;
  private notificationService: NotificationService;
  private timerState: TimerState;
  
  // Интервалы в миллисекундах
  private readonly REMINDER_INTERVAL = 10 * 60 * 1000; // 10 минут
  
  constructor(bot: Telegraf<BotContext>, database: DatabaseService) {
    this.bot = bot;
    this.database = database;
    this.notificationService = new NotificationService(bot, database);
    this.timerState = {
      nextFeedingTime: null,
      isActive: false,
      reminderInterval: null,
      feedingTimeout: null,
      currentIntervalMinutes: DEFAULT_FEEDING_INTERVAL_MINUTES
    };
  }
  
  // Обновление интервала кормления
  updateInterval(minutes: number): void {
    this.timerState.currentIntervalMinutes = minutes;
    console.log(`Интервал кормления обновлен: ${minutes} минут`);
    
    // Если таймер активен, перезапускаем его с новым интервалом
    if (this.timerState.isActive) {
      console.log('Перезапуск активного таймера с новым интервалом');
      this.restartWithNewInterval();
    }
  }
  
  // Перезапуск таймера с новым интервалом
  private restartWithNewInterval(): void {
    this.clearAllTimers();
    
    const intervalMs = this.timerState.currentIntervalMinutes * 60 * 1000;
    const nextTime = new Date(toMoscowTime(new Date()).getTime() + intervalMs);
    this.timerState.nextFeedingTime = nextTime;
    this.timerState.isActive = true;
    
    console.log(`Таймер перезапущен. Следующее кормление: ${nextTime.toLocaleString('ru-RU')}`);
    
    this.timerState.feedingTimeout = setTimeout(() => {
      this.sendFeedingReminder();
    }, intervalMs);
  }
  
  // Запуск таймера после кормления
  startFeedingTimer(customIntervalMinutes?: number): void {
    this.clearAllTimers();
    
    const intervalMinutes = customIntervalMinutes || this.timerState.currentIntervalMinutes;
    const intervalMs = intervalMinutes * 60 * 1000;
    const nextTime = new Date(toMoscowTime(new Date()).getTime() + intervalMs);
    
    this.timerState.nextFeedingTime = nextTime;
    this.timerState.isActive = true;
    
    console.log(`Таймер запущен. Следующее кормление: ${nextTime.toLocaleString('ru-RU')} (интервал: ${intervalMinutes} мин)`);
    
    this.timerState.feedingTimeout = setTimeout(() => {
      this.sendFeedingReminder();
    }, intervalMs);
  }
  
  // Отправка напоминания о кормлении
  private async sendFeedingReminder(): Promise<void> {
    if (!this.timerState.isActive) return;
    
    const message = '🔔 Пора покормить собаку!';
    await this.notificationService.sendToAll(message);
    
    console.log('Отправлено напоминание о кормлении');
    
    // Запуск повторных напоминаний
    this.startReminderInterval();
  }
  
  // Запуск повторных напоминаний каждые 10 минут
  private startReminderInterval(): void {
    this.timerState.reminderInterval = setInterval(async () => {
      if (!this.timerState.isActive) {
        this.clearReminderInterval();
        return;
      }
      
      const message = '🔔 Напоминание: собаку все еще нужно покормить!';
      await this.notificationService.sendToAll(message);
      
      console.log('Отправлено повторное напоминание');
    }, this.REMINDER_INTERVAL);
  }
  
  // Остановка всех таймеров (завершение кормлений на сегодня)
  stopAllTimers(): void {
    this.clearAllTimers();
    this.timerState.isActive = false;
    this.timerState.nextFeedingTime = null;
    console.log('Все таймеры остановлены');
  }
  
  // Очистка всех таймеров
  private clearAllTimers(): void {
    this.clearFeedingTimeout();
    this.clearReminderInterval();
  }
  
  private clearFeedingTimeout(): void {
    if (this.timerState.feedingTimeout) {
      clearTimeout(this.timerState.feedingTimeout);
      this.timerState.feedingTimeout = null;
    }
  }
  
  private clearReminderInterval(): void {
    if (this.timerState.reminderInterval) {
      clearInterval(this.timerState.reminderInterval);
      this.timerState.reminderInterval = null;
    }
  }
  
  // Получение информации о следующем кормлении
  getNextFeedingInfo(): { time: Date | null; isActive: boolean; intervalMinutes: number } {
    return {
      time: this.timerState.nextFeedingTime,
      isActive: this.timerState.isActive,
      intervalMinutes: this.timerState.currentIntervalMinutes
    };
  }
  
  // Проверка активности таймеров
  isTimerActive(): boolean {
    return this.timerState.isActive;
  }
  
  // Получение текущего интервала
  getCurrentInterval(): number {
    return this.timerState.currentIntervalMinutes;
  }

  // Получить сервис уведомлений (для использования в других местах)
  getNotificationService(): NotificationService {
    return this.notificationService;
  }
}
