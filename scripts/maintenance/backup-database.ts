#!/usr/bin/env ts-node

/**
 * 💾 Скрипт резервного копирования базы данных
 * 
 * Создает резервную копию файла базы данных с временной меткой.
 * Резервные копии сохраняются в той же директории, что и основной файл базы данных.
 * 
 * Использование:
 * npm run backup-db
 * 
 * 📝 Резервные копии создаются в формате: dog_feeding_backup_YYYYMMDD_HHMMSS.db
 */

import { DatabaseService } from '../../src/services/database';
import * as path from 'path';
import * as fs from 'fs';

async function backupDatabase() {
    console.log('💾 Начинаю создание резервной копии базы данных...');
    
    // Определяем путь к базе данных (такой же, как в боте)
    const dbPath = path.resolve('dog_feeding.db');
    console.log(`📂 Путь к базе данных: ${dbPath}`);
    
    // Проверяем существование файла базы данных
    if (!fs.existsSync(dbPath)) {
        console.error('❌ Файл базы данных не найден!');
        process.exit(1);
    }
    
    // Создаем имя файла резервной копии с временной меткой
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
    const backupFileName = `dog_feeding_backup_${timestamp}.db`;
    const backupPath = path.resolve(backupFileName);
    
    console.log(`🆕 Имя файла резервной копии: ${backupFileName}`);
    
    try {
        // Копируем файл базы данных
        console.log('🔄 Копирование файла базы данных...');
        fs.copyFileSync(dbPath, backupPath);
        
        // Проверяем, что резервная копия создана успешно
        if (fs.existsSync(backupPath)) {
            const stats = fs.statSync(backupPath);
            console.log(`✅ Резервная копия успешно создана!`);
            console.log(`📊 Размер резервной копии: ${stats.size} байт`);
            console.log(`📂 Путь к резервной копии: ${backupPath}`);
        } else {
            throw new Error('Резервная копия не была создана');
        }
        
        // Показываем информацию о последних резервных копиях
        console.log('\n📋 Последние резервные копии:');
        const dirPath = path.dirname(dbPath);
        const files = fs.readdirSync(dirPath);
        const backupFiles = files
            .filter(file => file.startsWith('dog_feeding_backup_') && file.endsWith('.db'))
            .sort()
            .reverse()
            .slice(0, 5); // Показываем только последние 5 резервных копий
        
        if (backupFiles.length === 0) {
            console.log('📭 Резервные копии не найдены');
        } else {
            backupFiles.forEach(file => {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                const fileDate = new Date(stats.mtime);
                console.log(`  📄 ${file} (${stats.size} байт) - ${fileDate.toLocaleString('ru-RU')}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Ошибка при создании резервной копии:', error);
        process.exit(1);
    }
    
    console.log('\n🎉 Резервное копирование завершено успешно!');
}

// Запускаем скрипт
if (require.main === module) {
    backupDatabase().catch(error => {
        console.error('❌ Критическая ошибка:', error);
        process.exit(1);
    });
}

export default backupDatabase;
