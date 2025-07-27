import { NotificationService } from '../../src/services/notifications';
import { DatabaseService, DatabaseUser } from '../../src/services/database';
import { Telegraf } from 'telegraf';
import { BotContext } from '../../src/types';

// Mock для Telegraf
const mockBot = {
  telegram: {
    sendMessage: jest.fn()
  }
} as unknown as Telegraf<BotContext>;

// Mock для DatabaseService
const mockDatabase = {
  getAllUsers: jest.fn(),
  getUserByTelegramId: jest.fn()
} as unknown as DatabaseService;

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService(mockBot, mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendToUser', () => {
    it('should not send notification if user has notifications disabled', async () => {
      const user: DatabaseUser = {
        id: 1,
        telegramId: 123456789,
        notificationsEnabled: false,
        feedingInterval: 210,
        createdAt: new Date()
      };

      await notificationService.sendToUser(user, 'Test message');

      expect(mockBot.telegram.sendMessage).not.toHaveBeenCalled();
    });

    it('should send notification if user has notifications enabled', async () => {
      const user: DatabaseUser = {
        id: 1,
        telegramId: 123456789,
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      };

      await notificationService.sendToUser(user, 'Test message');

      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(user.telegramId, 'Test message');
    });

    it('should throw error if sending fails', async () => {
      const user: DatabaseUser = {
        id: 1,
        telegramId: 123456789,
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      };

      const errorMessage = 'Failed to send message';
      (mockBot.telegram.sendMessage as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

      await expect(notificationService.sendToUser(user, 'Test message')).rejects.toThrow(errorMessage);
    });
  });

  describe('filterUsers', () => {
    const users: DatabaseUser[] = [
      {
        id: 1,
        telegramId: 123456789,
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      },
      {
        id: 2,
        telegramId: 987654321,
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      },
      {
        id: 3,
        telegramId: 111111111,
        notificationsEnabled: false,
        feedingInterval: 210,
        createdAt: new Date()
      }
    ];

    it('should filter out users with disabled notifications', () => {
      // Вызовем приватный метод filterUsers через any
      const filteredUsers = (notificationService as any).filterUsers(users, {});
      
      expect(filteredUsers).toHaveLength(2);
      expect(filteredUsers[0].id).toBe(1);
      expect(filteredUsers[1].id).toBe(2);
    });

    it('should filter users to send only to specific user', () => {
      // Вызовем приватный метод filterUsers через any
      const filteredUsers = (notificationService as any).filterUsers(users, { onlyUser: 1 });
      
      expect(filteredUsers).toHaveLength(1);
      expect(filteredUsers[0].id).toBe(1);
    });

    it('should filter users to exclude specific user', () => {
      // Вызовем приватный метод filterUsers через any
      const filteredUsers = (notificationService as any).filterUsers(users, { excludeUser: 1 });
      
      expect(filteredUsers).toHaveLength(1);
      expect(filteredUsers[0].id).toBe(2);
    });
  });

  describe('isUserNotificationsEnabled', () => {
    it('should return false if user is not found', async () => {
      mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce(null);

      const result = await notificationService.isUserNotificationsEnabled(123456789);
      
      expect(result).toBe(false);
    });

    it('should return user notification status if user is found', async () => {
      const user: DatabaseUser = {
        id: 1,
        telegramId: 123456789,
        notificationsEnabled: true,
        feedingInterval: 210,
        createdAt: new Date()
      };

      mockDatabase.getUserByTelegramId = jest.fn().mockResolvedValueOnce(user);

      const result = await notificationService.isUserNotificationsEnabled(123456789);
      
      expect(result).toBe(true);
    });

    it('should return false if there is an error', async () => {
      mockDatabase.getUserByTelegramId = jest.fn().mockRejectedValueOnce(new Error('Database error'));

      const result = await notificationService.isUserNotificationsEnabled(123456789);
      
      expect(result).toBe(false);
    });
  });
});
