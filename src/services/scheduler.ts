import { DatabaseService, DatabaseScheduledFeeding } from './database';
import { TimerService } from './timer';
import { SCHEDULER_SETTINGS } from '../utils/constants';
import { createUserText } from '../utils/user-utils';

export interface ScheduledFeeding {
  id: number;
  scheduledTime: Date;
  isActive: boolean;
  createdBy: number;
  createdAt: Date;
}

export class SchedulerService {
  private database: DatabaseService;
  private timerService: TimerService;
  private scheduledTimers: Map<number, NodeJS.Timeout> = new Map();

  constructor(database: DatabaseService, timerService: TimerService) {
    this.database = database;
    this.timerService = timerService;
  }

  // Инициализация планировщика (восстановление таймеров после перезапуска)
  async initialize(): Promise<void> {
    try {
      const activeSchedules = await this.database.getActiveScheduledFeedings();
      
      for (const schedule of activeSchedules) {
        await this.restoreTimer(schedule);
      }

      console.log(`Восстановлено ${activeSchedules.length} запланированных кормлений`);
    } catch (error) {
      console.error('Ошибка инициализации планировщика:', error);
    }
  }

  // Создание запланированного кормления
  async scheduleFeeding(scheduledTime: Date, createdBy: number): Promise<ScheduledFeeding> {
    const now = new Date();
    
    // Проверяем, что время в будущем
    if (scheduledTime <= now) {
      throw new Error('Время кормления должно быть в будущем');
    }

    // Проверяем минимальный интервал (5 минут)
    const minTime = new Date(now.getTime() + SCHEDULER_SETTINGS.MIN_SCHEDULE_MINUTES * 60 * 1000);
    if (scheduledTime < minTime) {
      throw new Error(`Минимальный интервал планирования: ${SCHEDULER_SETTINGS.MIN_SCHEDULE_MINUTES} минут`);
    }

    // Проверяем, что время не слишком далеко
    const maxTime = new Date();
    maxTime.setDate(maxTime.getDate() + SCHEDULER_SETTINGS.MAX_SCHEDULE_DAYS);
    if (scheduledTime > maxTime) {
      throw new Error(`Максимальный период планирования: ${SCHEDULER_SETTINGS.MAX_SCHEDULE_DAYS} дней`);
    }

    // Проверяем максимальное количество активных кормлений
    const activeSchedules = await this.database.getActiveScheduledFeedings();
    if (activeSchedules.length >= SCHEDULER_SETTINGS.MAX_SCHEDULED_FEEDINGS) {
      throw new Error(`Максимальное количество запланированных кормлений: ${SCHEDULER_SETTINGS.MAX_SCHEDULED_FEEDINGS}`);
    }

    try {
      // Сохраняем в БД
      const schedule = await this.database.createScheduledFeeding(scheduledTime, createdBy);
      
      // Создаем таймер
      await this.createTimer(schedule);
      
      // Получаем пользователя для логирования
      const user = await this.database.getUserById(createdBy);
      console.log(`Запланировано кормление на ${scheduledTime.toLocaleString('ru-RU')} пользователем ${createUserText(user)}`);
      
      return {
        id: schedule.id,
        scheduledTime: schedule.scheduledTime,
        isActive: schedule.isActive,
        createdBy: schedule.createdBy,
        createdAt: schedule.createdAt
      };
    } catch (error) {
      console.error('Ошибка создания запланированного кормления:', error);
      throw error;
    }
  }

  // Отмена запланированного кормления
  async cancelScheduledFeeding(scheduleId: number): Promise<void> {
    try {
      // Отменяем таймер
      const timer = this.scheduledTimers.get(scheduleId);
      if (timer) {
        clearTimeout(timer);
        this.scheduledTimers.delete(scheduleId);
      }

      // Деактивируем в БД
      await this.database.deactivateScheduledFeeding(scheduleId);
      
      console.log(`Отменено запланированное кормление ID: ${scheduleId}`);
    } catch (error) {
      console.error('Ошибка отмены запланированного кормления:', error);
      throw error;
    }
  }

  // Отмена всех активных запланированных кормлений
  async cancelAllScheduledFeedings(): Promise<number> {
    try {
      const activeSchedules = await this.database.getActiveScheduledFeedings();
      
      for (const schedule of activeSchedules) {
        await this.cancelScheduledFeeding(schedule.id);
      }

      console.log(`Отменено ${activeSchedules.length} запланированных кормлений`);
      return activeSchedules.length;
    } catch (error) {
      console.error('Ошибка отмены всех запланированных кормлений:', error);
      throw error;
    }
  }

  // Получение активных запланированных кормлений
  async getActiveScheduledFeedings(): Promise<ScheduledFeeding[]> {
    const dbSchedules = await this.database.getActiveScheduledFeedings();
    return dbSchedules.map(schedule => ({
      id: schedule.id,
      scheduledTime: schedule.scheduledTime,
      isActive: schedule.isActive,
      createdBy: schedule.createdBy,
      createdAt: schedule.createdAt
    }));
  }

  // Получение всех запланированных кормлений
  async getAllScheduledFeedings(): Promise<ScheduledFeeding[]> {
    const dbSchedules = await this.database.getAllScheduledFeedings();
    return dbSchedules.map(schedule => ({
      id: schedule.id,
      scheduledTime: schedule.scheduledTime,
      isActive: schedule.isActive,
      createdBy: schedule.createdBy,
      createdAt: schedule.createdAt
    }));
  }

  // Создание таймера для запланированного кормления
  private async createTimer(schedule: DatabaseScheduledFeeding): Promise<void> {
    const now = new Date();
    const delay = schedule.scheduledTime.getTime() - now.getTime();

    if (delay <= 0) {
      // Время уже прошло, деактивируем
      await this.database.deactivateScheduledFeeding(schedule.id);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Отправляем напоминание о кормлении
        const notificationService = this.timerService.getNotificationService();
        const message = `🔔 Запланированное кормление!\n\nВремя: ${schedule.scheduledTime.toLocaleString('ru-RU')}\n\nПора покормить собаку!`;
        
        await notificationService.sendToAll(message);

        // Деактивируем выполненное кормление
        await this.database.deactivateScheduledFeeding(schedule.id);
        this.scheduledTimers.delete(schedule.id);

        console.log(`Выполнено запланированное кормление ID: ${schedule.id}`);
      } catch (error) {
        console.error('Ошибка выполнения запланированного кормления:', error);
      }
    }, delay);

    this.scheduledTimers.set(schedule.id, timer);
  }

  // Восстановление таймера после перезапуска
  private async restoreTimer(schedule: DatabaseScheduledFeeding): Promise<void> {
    const now = new Date();
    
    if (schedule.scheduledTime <= now) {
      // Время уже прошло, деактивируем
      await this.database.deactivateScheduledFeeding(schedule.id);
      console.log(`Деактивировано просроченное кормление ID: ${schedule.id}`);
      return;
    }

    await this.createTimer(schedule);
    console.log(`Восстановлен таймер для кормления ID: ${schedule.id} на ${schedule.scheduledTime.toLocaleString('ru-RU')}`);
  }

  // Очистка всех таймеров (при остановке бота)
  cleanup(): void {
    for (const timer of this.scheduledTimers.values()) {
      clearTimeout(timer);
    }
    this.scheduledTimers.clear();
    console.log('Очищены все таймеры планировщика');
  }

  // Получение следующего запланированного кормления
  async getNextScheduledFeeding(): Promise<ScheduledFeeding | null> {
    const activeSchedules = await this.database.getActiveScheduledFeedings();
    
    if (activeSchedules.length === 0) {
      return null;
    }

    // Сортируем по времени и возвращаем ближайшее
    activeSchedules.sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
    const next = activeSchedules[0];
    
    return {
      id: next.id,
      scheduledTime: next.scheduledTime,
      isActive: next.isActive,
      createdBy: next.createdBy,
      createdAt: next.createdAt
    };
  }

  // Получение статистики планировщика
  async getSchedulerStats(): Promise<{
    activeSchedules: number;
    totalSchedules: number;
    nextSchedule: ScheduledFeeding | null;
    runningTimers: number;
  }> {
    const activeSchedules = await this.database.getActiveScheduledFeedings();
    const allSchedules = await this.database.getAllScheduledFeedings();
    const nextSchedule = await this.getNextScheduledFeeding();

    return {
      activeSchedules: activeSchedules.length,
      totalSchedules: allSchedules.length,
      nextSchedule,
      runningTimers: this.scheduledTimers.size
    };
  }

  // Очистка старых записей
  async cleanupOldSchedules(): Promise<number> {
    return await this.database.cleanupOldScheduledFeedings();
  }
} 
