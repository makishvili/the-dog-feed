# Этап 5: История кормлений

## Цель этапа
Добавить SQLite базу данных для постоянного хранения данных и реализовать просмотр истории кормлений за сегодня.

## Результат этапа
Бот с функциональностью:
- SQLite база данных для хранения пользователей, кормлений и настроек
- Миграция данных из памяти в БД
- Экран "История кормлений" → "Сегодня" с отображением кормлений за день
- Показ следующего запланированного кормления
- Кнопки "Отменить следующее кормление" и "Создать следующее кормление" (заглушки)

## Новые/измененные файлы

### 1. Обновить `package.json` (добавить sqlite3)
```json
{
  "dependencies": {
    "telegraf": "^4.15.0",
    "dotenv": "^16.3.1",
    "sqlite3": "^5.1.6"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/sqlite3": "^3.1.8",
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0"
  }
}
```

### 2. `src/database/schema.sql` (новый)
```sql
-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    username TEXT,
    notifications_enabled BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица кормлений
CREATE TABLE IF NOT EXISTS feedings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    food_type TEXT DEFAULT 'dry',
    amount INTEGER DEFAULT 12,
    details TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Таблица настроек (глобальные настройки)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица запланированных кормлений
CREATE TABLE IF NOT EXISTS scheduled_feedings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheduled_time DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_feedings_timestamp ON feedings(timestamp);
CREATE INDEX IF NOT EXISTS idx_feedings_user_id ON feedings(user_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_feedings_time ON scheduled_feedings(scheduled_time);

-- Вставка настроек по умолчанию
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('feeding_interval_minutes', '210'),
    ('default_food_type', 'dry'),
    ('default_food_amount', '12');
```

### 3. `src/database/db.ts` (новый)
```typescript
import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { User, Feeding } from '../types';

export class Database {
  private db: sqlite3.Database;
  private dbPath: string;

  constructor(dbPath: string = './data/bot.db') {
    this.dbPath = dbPath;
    
    // Создаем директорию для БД если её нет
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Ошибка подключения к БД:', err);
      } else {
        console.log('Подключение к SQLite БД успешно');
      }
    });

    // Включаем поддержку внешних ключей
    this.db.run('PRAGMA foreign_keys = ON');
  }

  // Инициализация БД (создание таблиц)
  async initialize(): Promise<void> {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    return new Promise((resolve, reject) => {
      this.db.exec(schema, (err) => {
        if (err) {
          console.error('Ошибка инициализации БД:', err);
          reject(err);
        } else {
          console.log('БД инициализирована успешно');
          resolve();
        }
      });
    });
  }

  // === ПОЛЬЗОВАТЕЛИ ===

  // Получить пользователя по telegram_id
  async getUserByTelegramId(telegramId: number): Promise<User | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE telegram_id = ?',
        [telegramId],
        (err, row: any) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              id: row.id,
              telegramId: row.telegram_id,
              username: row.username,
              notificationsEnabled: Boolean(row.notifications_enabled)
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // Создать пользователя
  async createUser(telegramId: number, username?: string): Promise<User> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO users (telegram_id, username) VALUES (?, ?)',
        [telegramId, username || null],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              telegramId,
              username,
              notificationsEnabled: true
            });
          }
        }
      );
    });
  }

  // Получить всех пользователей
  async getAllUsers(): Promise<User[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM users',
        [],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            const users = rows.map(row => ({
              id: row.id,
              telegramId: row.telegram_id,
              username: row.username,
              notificationsEnabled: Boolean(row.notifications_enabled)
            }));
            resolve(users);
          }
        }
      );
    });
  }

  // === КОРМЛЕНИЯ ===

  // Создать запись о кормлении
  async createFeeding(userId: number, foodType: string = 'dry', amount: number = 12, details?: string): Promise<Feeding> {
    return new Promise((resolve, reject) => {
      const timestamp = new Date();
      this.db.run(
        'INSERT INTO feedings (user_id, timestamp, food_type, amount, details) VALUES (?, ?, ?, ?, ?)',
        [userId, timestamp.toISOString(), foodType, amount, details || null],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              userId,
              timestamp,
              foodType: foodType as 'dry' | 'wet',
              amount,
              details
            });
          }
        }
      );
    });
  }

  // Получить кормления за сегодня
  async getTodayFeedings(): Promise<Array<Feeding & { username?: string }>> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT f.*, u.username 
        FROM feedings f 
        LEFT JOIN users u ON f.user_id = u.id 
        WHERE f.timestamp >= ? AND f.timestamp < ? 
        ORDER BY f.timestamp DESC
      `, [startOfDay.toISOString(), endOfDay.toISOString()], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const feedings = rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            timestamp: new Date(row.timestamp),
            foodType: row.food_type as 'dry' | 'wet',
            amount: row.amount,
            details: row.details,
            username: row.username
          }));
          resolve(feedings);
        }
      });
    });
  }

  // === НАСТРОЙКИ ===

  // Получить настройку
  async getSetting(key: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT value FROM settings WHERE key = ?',
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

  // Установить настройку
  async setSetting(key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, value, new Date().toISOString()],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Закрытие соединения с БД
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Соединение с БД закрыто');
          resolve();
        }
      });
    });
  }
}
```

### 4. Обновить `src/bot.ts` (финальная версия с БД)
```typescript
import { Telegraf, Scenes, session } from 'telegraf';
import * as dotenv from 'dotenv';
import { Database } from './database/db';
import { TimerService } from './services/timer';
import { MainHandler } from './handlers/main';
import { mainScene } from './scenes/main';
import { feedingSuccessScene } from './scenes/feeding-success';
import { settingsScene } from './scenes/settings';
import { historyScene } from './scenes/history';
import { todayHistoryScene } from './scenes/today-history';
import { intervalSettingsScene } from './scenes/interval-settings';
import { SCENES } from './utils/constants';
import { TimeParser } from './services/parser';

// Загрузка переменных окружения
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

async function startBot() {
  try {
    // Создание бота
    const bot = new Telegraf(BOT_TOKEN);

    // Инициализация БД
    const database = new Database();
    await database.initialize();

    // Инициализация сервисов
    const timerService = new TimerService(bot, database);
    const mainHandler = new MainHandler(timerService, database);

    // Настройка сцен
    const stage = new Scenes.Stage([
      mainScene,
      feedingSuccessScene,
      settingsScene,
      historyScene,
      todayHistoryScene,
      intervalSettingsScene
    ]);

    // Middleware
    bot.use(session());
    bot.use(stage.middleware());

    // Добавляем сервисы в контекст для доступа из сцен
    bot.use((ctx, next) => {
      ctx.timerService = timerService;
      ctx.database = database;
      return next();
    });

    // Команда /start - переход к главной сцене
    bot.start(async (ctx) => {
      try {
        const user = await database.getUserByTelegramId(ctx.from.id);
        if (!user) {
          await database.createUser(ctx.from.id, ctx.from.username || ctx.from.first_name);
        }
        
        console.log(`Пользователь ${ctx.from.username || ctx.from.id} запустил бота`);
        ctx.scene.enter(SCENES.MAIN);
      } catch (error) {
        console.error('Ошибка при запуске бота:', error);
        ctx.reply('❌ Произошла ошибка. Попробуйте еще раз.');
      }
    });

    // Глобальные обработчики кнопок
    bot.hears(/🍽️ Я покормил/, async (ctx) => {
      await mainHandler.handleFeeding(ctx);
    });

    bot.hears(/⏹️ Завершить кормления на сегодня/, async (ctx) => {
      await mainHandler.handleStopFeedings(ctx);
      ctx.scene.enter(SCENES.MAIN);
    });

    // Команда для проверки статуса
    bot.command('status', async (ctx) => {
      try {
        const nextFeeding = timerService.getNextFeedingInfo();
        const todayFeedings = await database.getTodayFeedings();
        
        let message = '📊 Статус кормления:\n\n';
        
        message += `📅 Кормлений сегодня: ${todayFeedings.length}\n`;
        
        if (todayFeedings.length > 0) {
          const lastFeeding = todayFeedings[0]; // первый элемент - самый последний
          message += `🍽️ Последнее кормление:\n`;
          message += `   Время: ${lastFeeding.timestamp.toLocaleString('ru-RU')}\n`;
          message += `   Кто: ${lastFeeding.username || 'Неизвестно'}\n\n`;
        }
        
        message += `⏰ Интервал кормления: ${TimeParser.formatInterval(nextFeeding.intervalMinutes)}\n\n`;
        
        if (nextFeeding.isActive && nextFeeding.time) {
          message += `⏰ Следующее кормление: ${nextFeeding.time.toLocaleString('ru-RU')}`;
        } else {
          message += '⏹️ Кормления приостановлены';
        }
        
        ctx.reply(message);
      } catch (error) {
        console.error('Ошибка получения статуса:', error);
        ctx.reply('❌ Ошибка получения статуса');
      }
    });

    // Команда для возврата на главный экран
    bot.command('home', (ctx) => {
      ctx.scene.enter(SCENES.MAIN);
    });

    // Обработка ошибок
    bot.catch((err, ctx) => {
      console.error('Ошибка бота:', err);
      ctx.reply('Произошла ошибка. Попробуйте еще раз или используйте /start');
    });

    // Graceful shutdown
    process.once('SIGINT', async () => {
      console.log('Получен сигнал SIGINT, остановка бота...');
      timerService.stopAllTimers();
      await database.close();
      bot.stop('SIGINT');
    });

    process.once('SIGTERM', async () => {
      console.log('Получен сигнал SIGTERM, остановка бота...');
      timerService.stopAllTimers();
      await database.close();
      bot.stop('SIGTERM');
    });

    // Запуск бота
    console.log('Запуск бота...');
    await bot.launch();
    console.log('Бот запущен успешно!');

  } catch (error) {
    console.error('Ошибка запуска бота:', error);
    process.exit(1);
  }
}

// Запуск бота
startBot();
```

## Инструкции по тестированию

### Подготовка:
1. Установить зависимости: `npm install`
2. Создать `.env` файл с токеном бота
3. Запустить бота: `npm run dev`

### Тестовые сценарии:

1. **Инициализация БД**:
   - При первом запуске должна создаться папка `data/` с файлом `bot.db`
   - Проверить создание таблиц в SQLite

2. **Создание пользователей**:
   - Команда `/start` должна создать пользователя в БД
   - Повторный `/start` не должен создавать дубликаты

3. **Сохранение кормлений**:
   - Нажать "Я покормил" → проверить запись в таблице `feedings`
   - Данные должны сохраняться после перезапуска бота

4. **История за сегодня**:
   - Главный экран → История → Сегодня
   - Должны отображаться все кормления за текущий день
   - Показ следующего запланированного кормления

5. **Кнопки управления**:
   - "Отменить следующее кормление" → остановка таймеров
   - "Создать следующее кормление" → заглушка с информацией
   - "Обновить" → обновление данных на экране

6. **Команда /status**:
   - Должна показывать количество кормлений за сегодня
   - Информацию о последнем кормлении из БД
   - Текущий интервал и следующее кормление

### Проверка БД:
Можно использовать SQLite браузер для проверки данных:
```bash
sqlite3 data/bot.db
.tables
SELECT * FROM users;
SELECT * FROM feedings;
SELECT * FROM settings;
```

## Ограничения этапа
- Нет настроек корма (используются значения по умолчанию)
- Нет уточнения деталей кормления
- Нет экспорта истории
- Простая обработка ошибок БД

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 6: добавление настроек корма (тип и количество) с сохранением в БД.
