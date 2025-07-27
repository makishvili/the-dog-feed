import { Telegraf } from 'telegraf';
import { DatabaseService, DatabaseUser } from './database';
import { createUserText } from '../utils/user-utils';

export interface NotificationOptions {
    excludeUser?: number; // ID пользователя, которого нужно исключить
    onlyUser?: number; // Отправить только конкретному пользователю
}

export class NotificationService {
    private bot: Telegraf;
    private database: DatabaseService;

    constructor(bot: Telegraf, database: DatabaseService) {
        this.bot = bot;
        this.database = database;
    }

    // Отправка уведомления всем пользователям с включенными уведомлениями
    async sendToAll(
        message: string,
        options: NotificationOptions = {}
    ): Promise<void> {
        try {
            const users = await this.database.getAllUsers();
            const filteredUsers = this.filterUsers(users, options);

            const promises = filteredUsers.map(user =>
                this.sendToUser(user, message)
            );
            const results = await Promise.allSettled(promises);

            // Логирование результатов
            const successful = results.filter(
                r => r.status === 'fulfilled'
            ).length;
            const failed = results.filter(r => r.status === 'rejected').length;

            console.log(
                `Уведомление отправлено: ${successful} успешно, ${failed} ошибок`
            );

            if (failed > 0) {
                const errors = results
                    .filter(r => r.status === 'rejected')
                    .map(r => (r as PromiseRejectedResult).reason);
                console.error('Ошибки отправки уведомлений:', errors);
            }
        } catch (error) {
            console.error(
                'Ошибка получения пользователей для уведомлений:',
                error
            );
        }
    }

    // Отправка уведомления конкретному пользователю
    async sendToUser(user: DatabaseUser, message: string): Promise<void> {
        if (!user.notificationsEnabled) {
            return; // Пользователь отключил уведомления
        }

        try {
            await this.bot.telegram.sendMessage(user.telegramId, message);
            console.log(
                `Уведомление отправлено пользователю: ${createUserText(user)}`
            );
        } catch (error) {
            console.error(
                `Ошибка отправки уведомления пользователю ${user.telegramId}:`,
                error
            );
            throw error; // Пробрасываем ошибку для обработки в sendToAll
        }
    }

    // Фильтрация пользователей по опциям
    private filterUsers(
        users: DatabaseUser[],
        options: NotificationOptions
    ): DatabaseUser[] {
        let filtered = users.filter(user => user.notificationsEnabled);

        if (options.onlyUser) {
            filtered = filtered.filter(user => user.id === options.onlyUser);
        }

        if (options.excludeUser) {
            filtered = filtered.filter(user => user.id !== options.excludeUser);
        }

        return filtered;
    }

    // Получение статистики уведомлений
    async getNotificationStats(): Promise<{
        totalUsers: number;
        enabledUsers: number;
        disabledUsers: number;
        enabledUsersList: string[];
        disabledUsersList: string[];
    }> {
        try {
            const users = await this.database.getAllUsers();
            const enabledUsers = users.filter(u => u.notificationsEnabled);
            const disabledUsers = users.filter(u => !u.notificationsEnabled);

            const enabledUsersList = enabledUsers.map(u => createUserText(u));
            const disabledUsersList = disabledUsers.map(u => createUserText(u));

            return {
                totalUsers: users.length,
                enabledUsers: enabledUsers.length,
                disabledUsers: disabledUsers.length,
                enabledUsersList,
                disabledUsersList,
            };
        } catch (error) {
            console.error('Ошибка получения статистики уведомлений:', error);
            return {
                totalUsers: 0,
                enabledUsers: 0,
                disabledUsers: 0,
                enabledUsersList: [],
                disabledUsersList: [],
            };
        }
    }

    // Проверка, включены ли уведомления у пользователя
    async isUserNotificationsEnabled(telegramId: number): Promise<boolean> {
        try {
            const user = await this.database.getUserByTelegramId(telegramId);
            return user?.notificationsEnabled || false;
        } catch (error) {
            console.error('Ошибка проверки настроек уведомлений:', error);
            return false;
        }
    }
}
