import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './database';
import { EXPORT_SETTINGS } from '../utils/constants';
import { createUserText } from '../utils/user-utils';

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

export interface FeedingWithUser {
    id: number;
    userId: number;
    timestamp: Date;
    foodType: string;
    amount: number;
    details?: string;
    username?: string;
}

export class ExportService {
    private database: DatabaseService;
    private exportDir: string;

    constructor(
        database: DatabaseService,
        exportDir: string = EXPORT_SETTINGS.EXPORT_DIR
    ) {
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
            fileSize: stats.size,
        };
    }

    // Получение кормлений для экспорта с учетом периода
    private async getFeedingsForExport(
        options: ExportOptions
    ): Promise<FeedingWithUser[]> {
        let startDate: Date | undefined;

        if (options.period === 'week') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else if (options.period === 'month') {
            startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
        }

        // Получаем кормления из базы данных
        const feedings = await this.database.getFeedingsForPeriod(
            startDate,
            undefined,
            options.limit
        );

        // Обогащаем данные пользователей
        const enrichedFeedings: FeedingWithUser[] = [];

        for (const feeding of feedings) {
            const user = await this.database.getUserById(feeding.userId);
            enrichedFeedings.push({
                ...feeding,
                username: createUserText(user),
            });
        }

        return enrichedFeedings;
    }

    // Генерация CSV файла
    private generateCSV(feedings: FeedingWithUser[]): string {
        const headers = [
            'Дата',
            'Время',
            'Пользователь',
            'Тип корма',
            'Количество (г)',
            'Детали',
        ];
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
    private generateHTML(feedings: FeedingWithUser[]): string {
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

        const tableRows = feedings
            .map(feeding => {
                const date = feeding.timestamp.toLocaleDateString('ru-RU');
                const time = feeding.timestamp.toLocaleTimeString('ru-RU');
                const username = feeding.username || 'Неизвестно';
                const foodType =
                    feeding.foodType === 'dry' ? 'Сухой' : 'Влажный';
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
            })
            .join('');

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
            <p>Экспорт создан: ${new Date().toLocaleString('ru-RU')}</p>
        </div>
    </div>
</body>
</html>
    `;
    }
}
