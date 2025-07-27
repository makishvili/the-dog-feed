#!/usr/bin/env ts-node

/**
 * 🧹 Скрипт безопасной очистки базы данных
 * 
 * Очищает все таблицы в базе данных, сохраняя структуру таблиц.
 * Не нарушает работу бота, так как:
 * - Сохраняет структуру таблиц
 * - Пересоздает необходимые индексы
 * - Инициализирует стандартные настройки
 * 
 * Использование:
 * npm run clear-db
 * 
 * ⚠️  ВНИМАНИЕ: Все данные будут удалены безвозвратно!
 */

import { DatabaseService } from '../../src/services/database';
import * as path from 'path';

async function clearDatabase() {
    console.log('🧹 Начинаю очистку базы данных...');
    
    // Определяем путь к базе данных (такой же, как в боте)
    const dbPath = path.resolve('dog_feeding.db');
    console.log(`📂 Путь к базе данных: ${dbPath}`);
    
    // Создаем экземпляр сервиса базы данных
    const database = new DatabaseService(dbPath);
    
    try {
        // Инициализируем соединение с базой данных
        console.log('🔗 Подключение к базе данных...');
        // Note: We don't call initialize() here as it would create tables,
        // but we want to work with existing tables
        
        // Получаем прямой доступ к базе данных
        const db = (database as any).db;
        
        // Отключаем проверку внешних ключей для безопасного удаления данных
        console.log('🔓 Отключение проверки внешних ключей...');
        db.run('PRAGMA foreign_keys = OFF');
        
        // Очищаем таблицы в правильном порядке для соблюдения ограничений внешних ключей
        console.log('🗑️  Очистка таблиц...');
        
        // Используем метод clearAllData из сервиса базы данных
        await database.clearAllData();
        console.log('✅ Все таблицы успешно очищены');
        
        console.log('🎉 База данных успешно очищена!');
        console.log('📊 Статистика после очистки:');
        
        // Показываем статистику после очистки
        const userCount = await new Promise<number>((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`👥 Пользователей: ${userCount}`);
        
        const feedingsCount = await new Promise<number>((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM feedings', (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`🍽️  Кормлений: ${feedingsCount}`);
        
        const scheduledFeedingsCount = await new Promise<number>((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM scheduled_feedings', (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`📅 Запланированных кормлений: ${scheduledFeedingsCount}`);
        
        const settingsCount = await new Promise<number>((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM settings', (err: any, row: any) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`⚙️  Настроек: ${settingsCount}`);
        
        
        // Закрываем соединение с базой данных
        try {
            await database.close();
            console.log('🔌 Соединение с базой данных закрыто');
        } catch (closeError) {
            console.error('⚠️  Ошибка при закрытии соединения:', closeError);
        }
        
    } catch (error) {
        console.error('❌ Ошибка при очистке базы данных:', error);
        process.exit(1);
    }
    
    console.log('✅ Очистка базы данных завершена успешно!');
}

// Запускаем скрипт
if (require.main === module) {
    clearDatabase().catch(error => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
}

export default clearDatabase;
