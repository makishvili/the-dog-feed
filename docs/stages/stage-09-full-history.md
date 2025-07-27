# Этап 9: Полная история

## Цель этапа
Добавить просмотр всей истории кормлений с пагинацией и экспорт данных в CSV и HTML форматы.

## Результат этапа
Бот с функциональностью:
- Экран "Все кормления" с отображением полной истории
- Пагинация для больших списков (по 10 записей на страницу)
- Экспорт истории в CSV формат
- Экспорт истории в HTML формат
- Фильтрация по периодам (неделя, месяц, все время)
- Статистика кормлений

## Новые/измененные файлы

### 1. `src/services/export.ts` (новый)
```typescript
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../database/db';
import { Feeding, User } from '../types';

export interface ExportOptions {
  format: 'csv' | 'html';
  period?: 'week' | 'month' | 'all';
  limit?: number;
}

export interface ExportResult {
  filePath: string;
  fileName: string;
  recordCount: number;
  fileSize: number;
}

export class ExportService {
  private database: Database;
  private exportDir: string;

  constructor(database: Database, exportDir: string = './exports') {
    this.database = database;
    this.exportDir = exportDir;
    
    // Создаем директорию для экспорта если её нет
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
  }

  // Экспорт истории кормлений
  async exportFeedings(options: ExportOptions): Promise<ExportResult> {
    const feedings = await this.getFeedingsForExport(options);
    
    if (feedings.length === 0) {
      throw new Error('Нет данных для экспорта');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `feedings_${options.format}_${timestamp}.${options.format}`;
    const filePath = path.join(this.exportDir, fileName);

    let content: string;
    
    if (options.format === 'csv') {
      content = this.generateCSV(feedings);
    } else {
      content = this.generateHTML(feedings);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    
    const stats = fs.statSync(filePath);
    
    return {
      filePath,
      fileName,
      recordCount: feedings.length,
      fileSize: stats.size
    };
  }

  // Получение кормлений для экспорта с учетом периода
  private async getFeedingsForExport(options: ExportOptions): Promise<Array<Feeding & { username?: string }>> {
    let startDate: Date | undefined;
    
    if (options.period === 'week') {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (options.period === 'month') {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    return await this.database.getFeedingsForPeriod(startDate, undefined, options.limit);
  }

  // Генерация CSV файла
  private generateCSV(feedings: Array<Feeding & { username?: string }>): string {
    const headers = ['Дата', 'Время', 'Пользователь', 'Тип корма', 'Количество (г)', 'Детали'];
    const csvLines = [headers.join(',')];

    feedings.forEach(feeding => {
      const date = feeding.timestamp.toLocaleDateString('ru-RU');
      const time = feeding.timestamp.toLocaleTimeString('ru-RU');
      const username = feeding.username || 'Неизвестно';
      const foodType = feeding.foodType === 'dry' ? 'Сухой' : 'Влажный';
      const amount = feeding.amount.toString();
      const details = (feeding.details || '').replace(/,/g, ';'); // Экранируем запятые

      const row = [date, time, username, foodType, amount, details];
      csvLines.push(row.map(field => `"${field}"`).join(','));
    });

    return csvLines.join('\n');
  }

  // Генерация HTML файла
  private generateHTML(feedings: Array<Feeding & { username?: string }>): string {
    const totalFeedings = feedings.length;
    const dryCount = feedings.filter(f => f.foodType === 'dry').length;
    const wetCount = feedings.filter(f => f.foodType === 'wet').length;
    const totalAmount = feedings.reduce((sum, f) => sum + f.amount, 0);

    const statsHtml = `
      <div class="stats">
        <h2>📊 Статистика</h2>
        <p><strong>Всего кормлений:</strong> ${totalFeedings}</p>
        <p><strong>Сухой корм:</strong> ${dryCount} раз</p>
        <p><strong>Влажный корм:</strong> ${wetCount} раз</p>
        <p><strong>Общее количество:</strong> ${totalAmount} граммов</p>
      </div>
    `;

    const tableRows = feedings.map(feeding => {
      const date = feeding.timestamp.toLocaleDateString('ru-RU');
      const time = feeding.timestamp.toLocaleTimeString('ru-RU');
      const username = feeding.username || 'Неизвестно';
      const foodType = feeding.foodType === 'dry' ? 'Сухой' : 'Влажный';
      const foodIcon = feeding.foodType === 'dry' ? '🌾' : '🥫';
      const details = feeding.details || '-';

      return `
        <tr>
          <td>${date}</td>
          <td>${time}</td>
          <td>${username}</td>
          <td>${foodIcon} ${foodType}</td>
          <td>${feeding.amount}г</td>
          <td>${details}</td>
        </tr>
      `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>История кормлений собаки</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
            margin-bottom: 30px;
        }
        .stats {
            background: #e8f4fd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .stats h2 {
            margin-top: 0;
            color: #2c5aa0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #495057;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        tr:hover {
            background-color: #e8f4fd;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 14px;
        }
        @media (max-width: 768px) {
            .container {
                margin: 10px;
                padding: 15px;
            }
            table {
                font-size: 14px;
            }
            th, td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🐕 История кормлений собаки</h1>
        
        ${statsHtml}
        
        <table>
            <thead>
                <tr>
                    <th>📅 Дата</th>
                    <th>🕐 Время</th>
                    <th>👤 Пользователь</th>
                    <th>🍽️ Тип корма</th>
                    <th>⚖️ Количество</th>
                    <th>📝 Детали</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>
        
        <div class="footer">
            <p>Отчет сгенерирован: ${new Date().toLocaleString('ru-RU')}</p>
            <p>Телеграм-бот для кормления собаки</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Очистка старых файлов экспорта
  async cleanupOldExports(maxAgeHours: number = 24): Promise<number> {
    const files = fs.readdirSync(this.exportDir);
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.exportDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime.getTime() < cutoffTime) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Удален старый файл экспорта: ${file}`);
      }
    }

    return deletedCount;
  }
}
```

### 2. `src/database/db.ts` (добавить методы для экспорта)
```typescript
// ... предыдущий код ...

// Получить кормления за период
async getFeedingsForPeriod(
  startDate?: Date, 
  endDate?: Date, 
  limit?: number
): Promise<Array<Feeding & { username?: string }>> {
  let query = `
    SELECT f.*, u.username 
    FROM feedings f 
    LEFT JOIN users u ON f.user_id = u.id 
  `;
  
  const params: any[] = [];
  const conditions: string[] = [];

  if (startDate) {
    conditions.push('f.timestamp >= ?');
    params.push(startDate.toISOString());
  }

  if (endDate) {
    conditions.push('f.timestamp <= ?');
    params.push(endDate.toISOString());
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY f.timestamp DESC';

  if (limit) {
    query += ` LIMIT ${limit}`;
  }

  return new Promise((resolve, reject) => {
    this.db.all(query, params, (err, rows: any[]) => {
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

// Получить статистику кормлений
async getFeedingStats(period?: 'week' | 'month' | 'all'): Promise<{
  totalFeedings: number;
  dryCount: number;
  wetCount: number;
  totalAmount: number;
  avgAmount: number;
  uniqueUsers: number;
}> {
  let whereClause = '';
  const params: any[] = [];

  if (period === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    whereClause = 'WHERE f.timestamp >= ?';
    params.push(weekAgo.toISOString());
  } else if (period === 'month') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    whereClause = 'WHERE f.timestamp >= ?';
    params.push(monthAgo.toISOString());
  }

  const query = `
    SELECT 
      COUNT(*) as total_feedings,
      SUM(CASE WHEN food_type = 'dry' THEN 1 ELSE 0 END) as dry_count,
      SUM(CASE WHEN food_type = 'wet' THEN 1 ELSE 0 END) as wet_count,
      SUM(amount) as total_amount,
      AVG(amount) as avg_amount,
      COUNT(DISTINCT user_id) as unique_users
    FROM feedings f 
    ${whereClause}
  `;

  return new Promise((resolve, reject) => {
    this.db.get(query, params, (err, row: any) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          totalFeedings: row.total_feedings || 0,
          dryCount: row.dry_count || 0,
          wetCount: row.wet_count || 0,
          totalAmount: row.total_amount || 0,
          avgAmount: Math.round(row.avg_amount || 0),
          uniqueUsers: row.unique_users || 0
        });
      }
    });
  });
}

// ... остальной код ...
```

### 3. `src/scenes/all-history.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { ExportService } from '../services/export';
import { SCENES } from '../utils/constants';

export const allHistoryScene = new Scenes.BaseScene<BotContext>(SCENES.ALL_HISTORY);

// Вход в сцену полной истории
allHistoryScene.enter(async (ctx) => {
  try {
    // Получаем статистику
    const stats = await ctx.database.getFeedingStats('all');
    
    let message = '📋 Вся история кормлений\n\n';
    message += `📊 Общая статистика:\n`;
    message += `• Всего кормлений: ${stats.totalFeedings}\n`;
    message += `• Сухой корм: ${stats.dryCount} раз\n`;
    message += `• Влажный корм: ${stats.wetCount} раз\n`;
    message += `• Общий объем: ${stats.totalAmount}г\n`;
    message += `• Среднее количество: ${stats.avgAmount}г\n`;
    message += `• Активных пользователей: ${stats.uniqueUsers}\n\n`;
    message += `Выберите действие:`;

    ctx.reply(message, Markup.keyboard([
      ['📄 Показать последние 20'],
      ['📊 Статистика по периодам'],
      ['💾 Экспорт в CSV', '🌐 Экспорт в HTML'],
      ['📋 История кормлений', '🏠 Главный экран']
    ]).resize());

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    ctx.reply(
      '❌ Ошибка получения данных. Попробуйте еще раз.',
      Markup.keyboard([['🏠 Главный экран']]).resize()
    );
  }
});

// Показать последние записи
allHistoryScene.hears(/📄 Показать последние 20/, async (ctx) => {
  try {
    const feedings = await ctx.database.getFeedingsForPeriod(undefined, undefined, 20);
    
    if (feedings.length === 0) {
      ctx.reply('📄 История кормлений пуста');
      return;
    }

    let message = '📄 Последние 20 кормлений:\n\n';
    
    feedings.forEach((feeding, index) => {
      const date = feeding.timestamp.toLocaleDateString('ru-RU');
      const time = feeding.timestamp.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const foodIcon = feeding.foodType === 'dry' ? '🌾' : '🥫';
      const who = feeding.username || 'Неизвестно';
      
      message += `${index + 1}. ${date} ${time}\n`;
      message += `   ${foodIcon} ${feeding.amount}г, ${who}\n`;
      if (feeding.details) {
        message += `   💬 ${feeding.details}\n`;
      }
      message += '\n';
    });

    // Разбиваем длинное сообщение на части если нужно
    if (message.length > 4000) {
      const parts = message.match(/.{1,4000}/g) || [message];
      for (const part of parts) {
        await ctx.reply(part);
      }
    } else {
      ctx.reply(message);
    }

  } catch (error) {
    console.error('Ошибка получения истории:', error);
    ctx.reply('❌ Ошибка получения истории');
  }
});

// Статистика по периодам
allHistoryScene.hears(/📊 Статистика по периодам/, async (ctx) => {
  try {
    const weekStats = await ctx.database.getFeedingStats('week');
    const monthStats = await ctx.database.getFeedingStats('month');
    const allStats = await ctx.database.getFeedingStats('all');

    const message = `📊 Статистика по периодам:\n\n` +
      `📅 За неделю:\n` +
      `• Кормлений: ${weekStats.totalFeedings}\n` +
      `• Объем: ${weekStats.totalAmount}г\n` +
      `• Среднее: ${weekStats.avgAmount}г\n\n` +
      
      `📅 За месяц:\n` +
      `• Кормлений: ${monthStats.totalFeedings}\n` +
      `• Объем: ${monthStats.totalAmount}г\n` +
      `• Среднее: ${monthStats.avgAmount}г\n\n` +
      
      `📅 За все время:\n` +
      `• Кормлений: ${allStats.totalFeedings}\n` +
      `• Объем: ${allStats.totalAmount}г\n` +
      `• Среднее: ${allStats.avgAmount}г`;

    ctx.reply(message);

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    ctx.reply('❌ Ошибка получения статистики');
  }
});

// Экспорт в CSV
allHistoryScene.hears(/💾 Экспорт в CSV/, async (ctx) => {
  try {
    ctx.reply('⏳ Генерация CSV файла...');
    
    const exportService = new ExportService(ctx.database);
    const result = await exportService.exportFeedings({ format: 'csv', period: 'all' });
    
    const message = `✅ CSV файл создан!\n\n` +
      `📄 Файл: ${result.fileName}\n` +
      `📊 Записей: ${result.recordCount}\n` +
      `💾 Размер: ${Math.round(result.fileSize / 1024)}KB`;

    // Отправляем файл
    await ctx.replyWithDocument({ source: result.filePath, filename: result.fileName });
    ctx.reply(message);

  } catch (error) {
    console.error('Ошибка экспорта CSV:', error);
    ctx.reply('❌ Ошибка создания CSV файла');
  }
});

// Экспорт в HTML
allHistoryScene.hears(/🌐 Экспорт в HTML/, async (ctx) => {
  try {
    ctx.reply('⏳ Генерация HTML отчета...');
    
    const exportService = new ExportService(ctx.database);
    const result = await exportService.exportFeedings({ format: 'html', period: 'all' });
    
    const message = `✅ HTML отчет создан!\n\n` +
      `📄 Файл: ${result.fileName}\n` +
      `📊 Записей: ${result.recordCount}\n` +
      `💾 Размер: ${Math.round(result.fileSize / 1024)}KB`;

    // Отправляем файл
    await ctx.replyWithDocument({ source: result.filePath, filename: result.fileName });
    ctx.reply(message);

  } catch (error) {
    console.error('Ошибка экспорта HTML:', error);
    ctx.reply('❌ Ошибка создания HTML отчета');
  }
});

// Обработка кнопки "История кормлений"
allHistoryScene.hears(/📋 История кормлений/, (ctx) => {
  ctx.scene.enter(SCENES.HISTORY);
});

// Обработка кнопки "Главный экран"
allHistoryScene.hears(/🏠 Главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
allHistoryScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    Markup.keyboard([
      ['📄 Показать последние 20'],
      ['💾 Экспорт в CSV', '🌐 Экспорт в HTML'],
      ['📋 История кормлений', '🏠 Главный экран']
    ]).resize()
  );
});
```

### 4. Обновить `src/scenes/history.ts`
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getHistoryKeyboard } from '../utils/keyboards';
import { SCENES } from '../utils/constants';

export const historyScene = new Scenes.BaseScene<BotContext>(SCENES.HISTORY);

// Вход в сцену истории
historyScene.enter((ctx) => {
  const message = '📋 История кормлений\n\nВыберите период:';
  ctx.reply(message, getHistoryKeyboard());
});

// Обработка кнопки "Сегодня"
historyScene.hears(/📅 Сегодня/, (ctx) => {
  ctx.scene.enter(SCENES.TODAY_HISTORY);
});

// Обработка кнопки "Все кормления"
historyScene.hears(/📋 Все кормления/, (ctx) => {
  ctx.scene.enter(SCENES.ALL_HISTORY);
});

// Обработка кнопки "Выйти на главный экран"
historyScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
historyScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки меню для навигации.',
    getHistoryKeyboard()
  );
});
```

### 5. Обновить `src/utils/constants.ts`
```typescript
// ... предыдущий код ...

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  FEEDING_DETAILS: 'feeding_details',
  SETTINGS: 'settings',
  HISTORY: 'history',
  TODAY_HISTORY: 'today_history',
  ALL_HISTORY: 'all_history',
  INTERVAL_SETTINGS: 'interval_settings',
  FOOD_SETTINGS: 'food_settings',
  NOTIFICATION_SETTINGS: 'notification_settings'
};
```

### 6. Обновить `src/bot.ts` (добавить новую сцену и очистку файлов)
```typescript
// ... импорты ...
import { allHistoryScene } from './scenes/all-history';
import { ExportService } from './services/export';

// ... остальной код ...

// Настройка сцен
const stage = new Scenes.Stage([
  mainScene,
  feedingSuccessScene,
  feedingDetailsScene,
  settingsScene,
  historyScene,
  todayHistoryScene,
  allHistoryScene,
  intervalSettingsScene,
  foodSettingsScene,
  foodTypeSettingsScene,
  foodAmountSettingsScene,
  notificationSettingsScene
]);

// ... остальной код ...

// Периодическая очистка старых файлов экспорта (каждые 6 часов)
setInterval(async () => {
  try {
    const exportService = new ExportService(database);
    const deletedCount = await exportService.cleanupOldExports(24);
    if (deletedCount > 0) {
      console.log(`Очищено ${deletedCount} старых файлов экспорта`);
    }
  } catch (error) {
    console.error('Ошибка очистки файлов экспорта:', error);
  }
}, 6 * 60 * 60 * 1000); // 6 часов

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Просмотр полной истории**:
   - История → Все кормления
   - Проверить отображение статистики
   - Нажать "Показать последние 20"

2. **Статистика по периодам**:
   - Нажать "Статистика по периодам"
   - Проверить данные за неделю, месяц, все время

3. **Экспорт в CSV**:
   - Нажать "Экспорт в CSV"
   - Проверить создание и отправку файла
   - Открыть файл в Excel/LibreOffice

4. **Экспорт в HTML**:
   - Нажать "Экспорт в HTML"
   - Проверить создание и отправку файла
   - Открыть файл в браузере

5. **Большие объемы данных**:
   - Создать много записей кормлений
   - Проверить пагинацию и производительность
   - Проверить размер экспортируемых файлов

6. **Очистка файлов**:
   - Проверить автоматическую очистку старых файлов экспорта

### Проверка файлов экспорта:
- CSV файл должен корректно открываться в Excel
- HTML файл должен корректно отображаться в браузере
- Файлы должны содержать все необходимые данные
- Статистика должна быть точной

## Ограничения этапа
- Нет создания кормлений на точное время
- Нет фильтрации по пользователям
- Нет экспорта в другие форматы (JSON, XML)
- Простая обработка больших объемов данных

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 10: добавление управления кормлениями (отмена и создание кормлений на точное время).
