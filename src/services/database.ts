import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

export interface DatabaseUser {
    id: number;
    telegramId: number;
    username?: string;
    notificationsEnabled: boolean;
    feedingInterval: number;
    timezone?: string; // Добавлено для поддержки часовых поясов
    createdAt: Date;
}

export interface DatabaseFeeding {
    id: number;
    userId: number;
    timestamp: Date;
    foodType: string;
    amount: number;
    details?: string;
}

export interface DatabaseSettings {
    id: number;
    key: string;
    value: string;
    updatedAt: Date;
}

export interface DatabaseScheduledFeeding {
    id: number;
    scheduledTime: Date;
    isActive: boolean;
    createdBy: number;
    createdAt: Date;
}

export class DatabaseService {
    private db: sqlite3.Database;
    private dbPath: string;

    constructor(dbPath: string = 'dog_feeding.db') {
        this.dbPath = path.resolve(dbPath);
        this.db = new sqlite3.Database(this.dbPath);

        // Включаем поддержку внешних ключей
        this.db.run('PRAGMA foreign_keys = ON');
    }

    // Инициализация базы данных
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Таблица пользователей
                this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            notifications_enabled BOOLEAN DEFAULT 1,
            feeding_interval INTEGER DEFAULT 210,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

                // Таблица кормлений
                this.db.run(`
          CREATE TABLE IF NOT EXISTS feedings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            food_type TEXT DEFAULT 'dry',
            amount INTEGER DEFAULT 12,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `);

                // Таблица настроек
                this.db.run(`
          CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

                // Таблица запланированных кормлений
                this.db.run(
                    `
          CREATE TABLE IF NOT EXISTS scheduled_feedings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheduled_time DATETIME NOT NULL,
            is_active BOOLEAN DEFAULT 1,
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users (id)
          )
        `,
                    err => {
                        if (err) {
                            console.error('Ошибка создания таблиц:', err);
                            reject(err);
                        } else {
                            // Выполняем миграции
                            this.runMigrations()
                                .then(() => {
                                    // Инициализация настроек по умолчанию
                                    return this.initializeDefaultSettings();
                                })
                                .then(() => {
                                    console.log(
                                        'База данных инициализирована:',
                                        this.dbPath
                                    );
                                    resolve();
                                })
                                .catch(reject);
                        }
                    }
                );
            });
        });
    }

    // Миграции базы данных
    private async runMigrations(): Promise<void> {
        try {
            // Проверяем, есть ли поле details в таблице feedings
            const checkDetailsColumn = await this.checkColumnExists(
                'feedings',
                'details'
            );

            if (!checkDetailsColumn) {
                await this.addColumn('feedings', 'details', 'TEXT');
                console.log('Добавлено поле details в таблицу feedings');
            }

            // Выполняем миграцию для поля timezone
            await this.addTimezoneMigration();
        } catch (error) {
            console.error('Ошибка выполнения миграций:', error);
            throw error;
        }
    }

    // Добавление миграции для поля timezone
    private async addTimezoneMigration(): Promise<void> {
        try {
            // Проверяем, есть ли поле timezone в таблице users
            const checkTimezoneColumn = await this.checkColumnExists(
                'users',
                'timezone'
            );

            if (!checkTimezoneColumn) {
                await this.addColumn('users', 'timezone', 'TEXT');
                console.log('Добавлено поле timezone в таблицу users');
            }
        } catch (error) {
            console.error('Ошибка выполнения миграции для timezone:', error);
            throw error;
        }
    }

    // Проверка существования колонки в таблице
    private checkColumnExists(
        tableName: string,
        columnName: string
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `PRAGMA table_info(${tableName})`,
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const columnExists = rows.some(
                            row => row.name === columnName
                        );
                        resolve(columnExists);
                    }
                }
            );
        });
    }

    // Добавление колонки в таблицу
    private addColumn(
        tableName: string,
        columnName: string,
        columnType: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const query = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`;
            this.db.run(query, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Инициализация настроек по умолчанию
    private async initializeDefaultSettings(): Promise<void> {
        try {
            // Устанавливаем значения по умолчанию только если они не существуют
            const defaultSettings = [
                { key: 'default_food_type', value: 'dry' },
                { key: 'default_food_amount', value: '12' },
            ];

            for (const setting of defaultSettings) {
                const existingSetting = await this.getSetting(setting.key);
                if (existingSetting === null) {
                    await this.setSetting(setting.key, setting.value);
                    console.log(
                        `Установлена настройка по умолчанию: ${setting.key} = ${setting.value}`
                    );
                }
            }
        } catch (error) {
            console.error('Ошибка инициализации настроек по умолчанию:', error);
            throw error;
        }
    }

    // Методы для работы с пользователями
    async createUser(
        telegramId: number,
        username?: string,
        timezone?: string
    ): Promise<DatabaseUser> {
        return new Promise((resolve, reject) => {
            const now = new Date();

            const stmt = this.db.prepare(`
        INSERT INTO users (telegram_id, username, notifications_enabled, feeding_interval, timezone, created_at)
        VALUES (?, ?, 1, 210, ?, ?)
      `);

            stmt.run(
                [telegramId, username, timezone, now.toISOString()],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            telegramId,
                            username,
                            notificationsEnabled: true,
                            feedingInterval: 210,
                            timezone, // Добавлено
                            createdAt: now,
                        });
                    }
                }
            );

            stmt.finalize();
        });
    }

    async getUserByTelegramId(
        telegramId: number
    ): Promise<DatabaseUser | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
        SELECT id, telegram_id, username, notifications_enabled, feeding_interval, timezone, created_at
        FROM users WHERE telegram_id = ?
      `,
                [telegramId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            id: row.id,
                            telegramId: row.telegram_id,
                            username: row.username,
                            notificationsEnabled: Boolean(
                                row.notifications_enabled
                            ),
                            feedingInterval: row.feeding_interval,
                            timezone: row.timezone, // Добавлено
                            createdAt: new Date(row.created_at),
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async getUserById(userId: number): Promise<DatabaseUser | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
        SELECT id, telegram_id, username, notifications_enabled, feeding_interval, timezone, created_at
        FROM users WHERE id = ?
      `,
                [userId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            id: row.id,
                            telegramId: row.telegram_id,
                            username: row.username,
                            notificationsEnabled: Boolean(
                                row.notifications_enabled
                            ),
                            feedingInterval: row.feeding_interval,
                            timezone: row.timezone, // Добавлено
                            createdAt: new Date(row.created_at),
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async updateUserInterval(
        telegramId: number,
        intervalMinutes: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        UPDATE users SET feeding_interval = ? WHERE telegram_id = ?
      `,
                [intervalMinutes, telegramId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async updateUserNotifications(
        userId: number,
        enabled: boolean
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        UPDATE users SET notifications_enabled = ? WHERE id = ?
      `,
                [enabled ? 1 : 0, userId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async updateUserTimezone(userId: number, timezone: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        UPDATE users SET timezone = ? WHERE id = ?
      `,
                [timezone, userId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getAllUsers(): Promise<DatabaseUser[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
        SELECT id, telegram_id, username, notifications_enabled, feeding_interval, timezone, created_at
        FROM users
      `,
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const users = rows.map(row => ({
                            id: row.id,
                            telegramId: row.telegram_id,
                            username: row.username,
                            notificationsEnabled: Boolean(
                                row.notifications_enabled
                            ),
                            feedingInterval: row.feeding_interval,
                            timezone: row.timezone, // Добавлено
                            createdAt: new Date(row.created_at),
                        }));
                        resolve(users);
                    }
                }
            );
        });
    }

    // Методы для работы с кормлениями
    async createFeeding(
        userId: number,
        foodType: string = 'dry',
        amount: number = 12
    ): Promise<DatabaseFeeding> {
        return new Promise((resolve, reject) => {
            const now = new Date();

            const stmt = this.db.prepare(`
        INSERT INTO feedings (user_id, timestamp, food_type, amount)
        VALUES (?, ?, ?, ?)
      `);

            stmt.run(
                [userId, now.toISOString(), foodType, amount],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            userId,
                            timestamp: now,
                            foodType,
                            amount,
                        });
                    }
                }
            );

            stmt.finalize();
        });
    }

    async getTodayFeedings(): Promise<DatabaseFeeding[]> {
        return new Promise((resolve, reject) => {
            // Получаем начало и конец сегодняшнего дня в UTC
            const now = new Date();
            const startOfDay = new Date(
                Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate()
                )
            );
            const endOfDay = new Date(startOfDay);
            endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

            this.db.all(
                `
        SELECT id, user_id, timestamp, food_type, amount, details
        FROM feedings
        WHERE timestamp >= ? AND timestamp < ?
        ORDER BY timestamp DESC
      `,
                [startOfDay.toISOString(), endOfDay.toISOString()],
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const feedings = rows.map(row => ({
                            id: row.id,
                            userId: row.user_id,
                            timestamp: new Date(row.timestamp),
                            foodType: row.food_type,
                            amount: row.amount,
                            details: row.details,
                        }));
                        resolve(feedings);
                    }
                }
            );
        });
    }

    async getLastFeeding(): Promise<DatabaseFeeding | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
        SELECT id, user_id, timestamp, food_type, amount
        FROM feedings 
        ORDER BY timestamp DESC 
        LIMIT 1
      `,
                (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            id: row.id,
                            userId: row.user_id,
                            timestamp: new Date(row.timestamp),
                            foodType: row.food_type,
                            amount: row.amount,
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async getAllFeedings(): Promise<DatabaseFeeding[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
        SELECT id, user_id, timestamp, food_type, amount
        FROM feedings 
        ORDER BY timestamp DESC
      `,
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const feedings = rows.map(row => ({
                            id: row.id,
                            userId: row.user_id,
                            timestamp: new Date(row.timestamp),
                            foodType: row.food_type,
                            amount: row.amount,
                        }));
                        resolve(feedings);
                    }
                }
            );
        });
    }

    // Обновление деталей кормления
    async updateFeedingDetails(
        feedingId: number,
        amount?: number,
        foodType?: string,
        details?: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            let query = 'UPDATE feedings SET ';
            const params: any[] = [];
            const updates: string[] = [];

            if (amount !== undefined) {
                updates.push('amount = ?');
                params.push(amount);
            }

            if (foodType !== undefined) {
                updates.push('food_type = ?');
                params.push(foodType);
            }

            if (details !== undefined) {
                updates.push('details = ?');
                params.push(details);
            }

            if (updates.length === 0) {
                resolve();
                return;
            }

            query += updates.join(', ') + ' WHERE id = ?';
            params.push(feedingId);

            this.db.run(query, params, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // Методы для работы с настройками
    async setSetting(key: string, value: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const now = new Date();

            this.db.run(
                `
        INSERT OR REPLACE INTO settings (key, value, updated_at)
        VALUES (?, ?, ?)
      `,
                [key, value, now.toISOString()],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getSetting(key: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
        SELECT value FROM settings WHERE key = ?
      `,
                [key],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row ? row.value : null);
                    }
                }
            );
        });
    }

    // Закрытие соединения с базой данных
    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Соединение с базой данных закрыто');
                    resolve();
                }
            });
        });
    }

    // Получение статистики
    async getStats(): Promise<{
        totalFeedings: number;
        todayFeedings: number;
        totalUsers: number;
    }> {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                let totalFeedings = 0;
                let todayFeedings = 0;
                let totalUsers = 0;
                let completed = 0;

                const checkComplete = () => {
                    completed++;
                    if (completed === 3) {
                        resolve({ totalFeedings, todayFeedings, totalUsers });
                    }
                };

                this.db.get(
                    'SELECT COUNT(*) as count FROM feedings',
                    (err, row: any) => {
                        if (err) reject(err);
                        else {
                            totalFeedings = row.count;
                            checkComplete();
                        }
                    }
                );

                // Получаем начало и конец сегодняшнего дня в UTC
                const now = new Date();
                const startOfDay = new Date(
                    Date.UTC(
                        now.getUTCFullYear(),
                        now.getUTCMonth(),
                        now.getUTCDate()
                    )
                );
                const endOfDay = new Date(startOfDay);
                endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

                this.db.get(
                    'SELECT COUNT(*) as count FROM feedings WHERE timestamp >= ? AND timestamp < ?',
                    [startOfDay.toISOString(), endOfDay.toISOString()],
                    (err, row: any) => {
                        if (err) reject(err);
                        else {
                            todayFeedings = row.count;
                            checkComplete();
                        }
                    }
                );

                this.db.get(
                    'SELECT COUNT(*) as count FROM users',
                    (err, row: any) => {
                        if (err) reject(err);
                        else {
                            totalUsers = row.count;
                            checkComplete();
                        }
                    }
                );
            });
        });
    }

    // Получение кормлений за период с пагинацией
    async getFeedingsForPeriod(
        startDate?: Date,
        endDate?: Date,
        limit?: number
    ): Promise<DatabaseFeeding[]> {
        return new Promise((resolve, reject) => {
            let query = `
        SELECT id, user_id, timestamp, food_type, amount, details
        FROM feedings 
      `;
            const params: any[] = [];
            const conditions: string[] = [];

            if (startDate) {
                conditions.push('timestamp >= ?');
                params.push(startDate.toISOString());
            }

            if (endDate) {
                conditions.push('timestamp <= ?');
                params.push(endDate.toISOString());
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY timestamp DESC';

            if (limit) {
                query += ' LIMIT ?';
                params.push(limit);
            }

            this.db.all(query, params, (err, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    const feedings = rows.map(row => ({
                        id: row.id,
                        userId: row.user_id,
                        timestamp: new Date(row.timestamp),
                        foodType: row.food_type,
                        amount: row.amount,
                        details: row.details,
                    }));
                    resolve(feedings);
                }
            });
        });
    }

    // Получение кормлений с пагинацией
    async getFeedingsWithPagination(
        page: number = 1,
        limit: number = 10
    ): Promise<DatabaseFeeding[]> {
        return new Promise((resolve, reject) => {
            const offset = (page - 1) * limit;

            this.db.all(
                `
        SELECT id, user_id, timestamp, food_type, amount, details
        FROM feedings 
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `,
                [limit, offset],
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const feedings = rows.map(row => ({
                            id: row.id,
                            userId: row.user_id,
                            timestamp: new Date(row.timestamp),
                            foodType: row.food_type,
                            amount: row.amount,
                            details: row.details,
                        }));
                        resolve(feedings);
                    }
                }
            );
        });
    }

    // Получение общего количества кормлений
    async getTotalFeedingsCount(
        startDate?: Date,
        endDate?: Date
    ): Promise<number> {
        return new Promise((resolve, reject) => {
            let query = 'SELECT COUNT(*) as count FROM feedings';
            const params: any[] = [];
            const conditions: string[] = [];

            if (startDate) {
                conditions.push('timestamp >= ?');
                params.push(startDate.toISOString());
            }

            if (endDate) {
                conditions.push('timestamp <= ?');
                params.push(endDate.toISOString());
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            this.db.get(query, params, (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row.count);
                }
            });
        });
    }

    // Методы для работы с запланированными кормлениями

    // Создание запланированного кормления
    async createScheduledFeeding(
        scheduledTime: Date,
        createdBy: number
    ): Promise<DatabaseScheduledFeeding> {
        return new Promise((resolve, reject) => {
            const now = new Date();

            const stmt = this.db.prepare(`
        INSERT INTO scheduled_feedings (scheduled_time, is_active, created_by, created_at)
        VALUES (?, 1, ?, ?)
      `);

            stmt.run(
                [scheduledTime.toISOString(), createdBy, now.toISOString()],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            id: this.lastID,
                            scheduledTime,
                            isActive: true,
                            createdBy,
                            createdAt: now,
                        });
                    }
                }
            );

            stmt.finalize();
        });
    }

    // Получение активных запланированных кормлений
    async getActiveScheduledFeedings(): Promise<DatabaseScheduledFeeding[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
        SELECT id, scheduled_time, is_active, created_by, created_at
        FROM scheduled_feedings 
        WHERE is_active = 1 
        ORDER BY scheduled_time ASC
      `,
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const scheduledFeedings = rows.map(row => ({
                            id: row.id,
                            scheduledTime: new Date(row.scheduled_time),
                            isActive: Boolean(row.is_active),
                            createdBy: row.created_by,
                            createdAt: new Date(row.created_at),
                        }));
                        resolve(scheduledFeedings);
                    }
                }
            );
        });
    }

    // Получение всех запланированных кормлений (включая неактивные)
    async getAllScheduledFeedings(): Promise<DatabaseScheduledFeeding[]> {
        return new Promise((resolve, reject) => {
            this.db.all(
                `
        SELECT id, scheduled_time, is_active, created_by, created_at
        FROM scheduled_feedings 
        ORDER BY scheduled_time DESC
      `,
                (err, rows: any[]) => {
                    if (err) {
                        reject(err);
                    } else {
                        const scheduledFeedings = rows.map(row => ({
                            id: row.id,
                            scheduledTime: new Date(row.scheduled_time),
                            isActive: Boolean(row.is_active),
                            createdBy: row.created_by,
                            createdAt: new Date(row.created_at),
                        }));
                        resolve(scheduledFeedings);
                    }
                }
            );
        });
    }

    // Деактивация запланированного кормления
    async deactivateScheduledFeeding(scheduleId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        UPDATE scheduled_feedings 
        SET is_active = 0 
        WHERE id = ?
      `,
                [scheduleId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Удаление запланированного кормления
    async deleteScheduledFeeding(scheduleId: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        DELETE FROM scheduled_feedings 
        WHERE id = ?
      `,
                [scheduleId],
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Получение запланированного кормления по ID
    async getScheduledFeedingById(
        scheduleId: number
    ): Promise<DatabaseScheduledFeeding | null> {
        return new Promise((resolve, reject) => {
            this.db.get(
                `
        SELECT id, scheduled_time, is_active, created_by, created_at
        FROM scheduled_feedings 
        WHERE id = ?
      `,
                [scheduleId],
                (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else if (row) {
                        resolve({
                            id: row.id,
                            scheduledTime: new Date(row.scheduled_time),
                            isActive: Boolean(row.is_active),
                            createdBy: row.created_by,
                            createdAt: new Date(row.created_at),
                        });
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    // Деактивация всех активных запланированных кормлений
    async deactivateAllScheduledFeedings(): Promise<number> {
        return new Promise((resolve, reject) => {
            this.db.run(
                `
        UPDATE scheduled_feedings 
        SET is_active = 0 
        WHERE is_active = 1
      `,
                [],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }

    // Очистка старых неактивных запланированных кормлений (старше 30 дней)
    async cleanupOldScheduledFeedings(): Promise<number> {
        return new Promise((resolve, reject) => {
            const now = new Date();
            const thirtyDaysAgo = new Date(
                now.getTime() - 30 * 24 * 60 * 60 * 1000
            );

            this.db.run(
                `
        DELETE FROM scheduled_feedings
        WHERE is_active = 0 AND created_at < ?
      `,
                [thirtyDaysAgo.toISOString()],
                function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.changes);
                    }
                }
            );
        });
    }
}
