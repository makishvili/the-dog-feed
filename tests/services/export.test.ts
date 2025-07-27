import { ExportService } from '../../src/services/export';
import { DatabaseService } from '../../src/services/database';
import * as fs from 'fs';
import * as path from 'path';

// Mock для DatabaseService
const mockDatabase = {
    getFeedingsForPeriod: jest.fn(),
    getUserById: jest.fn(),
} as unknown as DatabaseService;

// Mock для fs
jest.mock('fs');

describe('ExportService', () => {
    let exportService: ExportService;
    const mockExportDir = '/tmp/test_exports';

    beforeEach(() => {
        exportService = new ExportService(mockDatabase, mockExportDir);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('exportFeedings', () => {
        it('should throw error if no data to export', async () => {
            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce([]);

            const options = { format: 'csv' as const };

            await expect(exportService.exportFeedings(options)).rejects.toThrow(
                'Нет данных для экспорта'
            );
        });

        it('should export data in CSV format', async () => {
            const mockFeedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'dry',
                    amount: 12,
                    details: 'Обычное кормление',
                },
            ];

            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce(mockFeedings);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 100 });

            const options = { format: 'csv' as const };
            const result = await exportService.exportFeedings(options);

            expect(result.recordCount).toBe(1);
            expect(result.fileSize).toBe(100);
            expect(result.fileName).toMatch(/feedings_csv_.*\.csv/);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should export data in HTML format', async () => {
            const mockFeedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'wet',
                    amount: 63,
                    details: 'Влажный корм',
                },
            ];

            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce(mockFeedings);
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
            (fs.statSync as jest.Mock).mockReturnValue({ size: 200 });

            const options = { format: 'html' as const };
            const result = await exportService.exportFeedings(options);

            expect(result.recordCount).toBe(1);
            expect(result.fileSize).toBe(200);
            expect(result.fileName).toMatch(/feedings_html_.*\.html/);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('getFeedingsForExport', () => {
        it('should get feedings for week period', async () => {
            const mockFeedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'dry',
                    amount: 12,
                },
            ];

            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce(mockFeedings);
            mockDatabase.getUserById = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            // Вызовем приватный метод getFeedingsForExport через any
            const options = { format: 'csv' as const, period: 'week' as const };
            const result = await (exportService as any).getFeedingsForExport(
                options
            );

            expect(result).toHaveLength(1);
            expect(result[0].username).toBe('Пользователь 123456789');
        });

        it('should get feedings for month period', async () => {
            const mockFeedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'dry',
                    amount: 12,
                },
            ];

            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce(mockFeedings);
            mockDatabase.getUserById = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            // Вызовем приватный метод getFeedingsForExport через any
            const options = {
                format: 'csv' as const,
                period: 'month' as const,
            };
            const result = await (exportService as any).getFeedingsForExport(
                options
            );

            expect(result).toHaveLength(1);
            expect(result[0].username).toBe('Пользователь 123456789');
        });

        it('should get feedings for all period', async () => {
            const mockFeedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'dry',
                    amount: 12,
                },
            ];

            mockDatabase.getFeedingsForPeriod = jest
                .fn()
                .mockResolvedValueOnce(mockFeedings);
            mockDatabase.getUserById = jest.fn().mockResolvedValueOnce({
                id: 1,
                telegramId: 123456789,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            });

            // Вызовем приватный метод getFeedingsForExport через any
            const options = { format: 'csv' as const };
            const result = await (exportService as any).getFeedingsForExport(
                options
            );

            expect(result).toHaveLength(1);
            expect(result[0].username).toBe('Пользователь 123456789');
        });
    });

    describe('generateCSV', () => {
        it('should generate correct CSV content', () => {
            const feedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'dry',
                    amount: 12,
                    details: 'Обычное кормление',
                    username: '@testuser',
                },
            ];

            // Вызовем приватный метод generateCSV через any
            const csvContent = (exportService as any).generateCSV(feedings);

            expect(csvContent).toContain(
                'Дата,Время,Пользователь,Тип корма,Количество (г),Детали'
            );
            expect(csvContent).toContain('26.07.2023');
            expect(csvContent).toContain('Сухой');
            expect(csvContent).toContain('12');
            expect(csvContent).toContain('Обычное кормление');
        });
    });

    describe('generateHTML', () => {
        it('should generate correct HTML content', () => {
            const feedings = [
                {
                    id: 1,
                    userId: 1,
                    timestamp: new Date('2023-07-26T10:00:00Z'),
                    foodType: 'wet',
                    amount: 63,
                    details: 'Влажный корм',
                    username: '@testuser',
                },
            ];

            // Вызовем приватный метод generateHTML через any
            const htmlContent = (exportService as any).generateHTML(feedings);

            expect(htmlContent).toContain(
                '<title>История кормлений собаки</title>'
            );
            expect(htmlContent).toContain('📊 Статистика');
            expect(htmlContent).toContain(
                '<strong>Всего кормлений:</strong> 1'
            );
            expect(htmlContent).toContain(
                '<strong>Влажный корм:</strong> 1 раз'
            );
            expect(htmlContent).toContain('26.07.2023');
            expect(htmlContent).toContain('🥫 Влажный');
            expect(htmlContent).toContain('63г');
            expect(htmlContent).toContain('Влажный корм');
        });
    });
});
