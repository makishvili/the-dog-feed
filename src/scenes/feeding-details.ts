import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { FeedingParser } from '../services/feeding-parser';
import { TimeParser } from '../services/time-parser';
import { SCENES } from '../utils/constants';
import { getTimeOffsetInMinutes } from '../utils/timezone-utils';
import { formatDateTime } from '../utils/time-utils';

export const feedingDetailsScene = new Scenes.BaseScene<BotContext>(
    SCENES.FEEDING_DETAILS
);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFeedingDetails(database: DatabaseService) {
    globalDatabase = database;
}

// Вход в сцену уточнения деталей
feedingDetailsScene.enter(async ctx => {
    // Получаем ID последнего кормления из сессии
    const lastFeedingId = ctx.session?.lastFeedingId;

    if (!lastFeedingId) {
        ctx.reply(
            '❌ А вы не покормили собачку только что? Странно. А что же вы хотите тогда отредактировать? :)',
            Markup.keyboard([['🏠 Главный экран']]).resize()
        );
        return;
    }

    const message =
        `📝 *Отредактируйте последнее кормление*\n\n` +
        `Если надо, поменяйте тип и количество корма:\n` +
        `• 50г сухого\n` +
        `• 60 влажного\n` +
        `• сухого 40г\n\n` +
        `Или запишите другое время кормления:\n` +
        `• 14:30\n` +
        `• 9:15\n\n` +
        `Или просто запишите хорошую мысль про нашу собачку, и она (мысль) привяжется к этому кормлению :)`;

    ctx.reply(message, Markup.keyboard([['🏠 На главную']]).resize());
});

// Обработка ввода деталей
feedingDetailsScene.on('text', async ctx => {
    const text = ctx.message.text;

    // Проверка на кнопку "На главную"
    if (text.includes('🏠 На главную')) {
        ctx.scene.enter(SCENES.MAIN);
        return;
    }

    const lastFeedingId = ctx.session?.lastFeedingId;
    if (!lastFeedingId) {
        ctx.reply('❌ Ошибка: не найдено кормление для обновления');
        return;
    }

    if (!globalDatabase) {
        ctx.reply('❌ Ошибка: база данных не инициализирована');
        return;
    }

    try {
        const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);
        
        let feedingTime: Date | undefined = undefined;
        let detailsText = text;
        
        // Ищем время в формате HH:mm в любом месте текста
        const timeRegex = /(\d{1,2}):(\d{2})/;
        const timeMatch = text.match(timeRegex);
        
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                if (user?.timezone) {
                    try {
                        const now = new Date();
                        const year = now.getFullYear();
                        const month = now.getMonth();
                        const day = now.getDate();
                        
                        const feedingTimeStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
                        // Создаем дату в UTC
                        feedingTime = new Date(feedingTimeStr + 'Z');
                        // Для часового пояса пользователя получаем смещение времени
                        const offsetMinutes = getTimeOffsetInMinutes(now, now.getTime() / 1000);
                        // Корректируем время: если пользователь в UTC+3, то UTC время должно быть на 3 часа меньше
                        feedingTime = new Date(feedingTime.getTime() - offsetMinutes * 60 * 1000);
                    } catch (error) {
                        console.error('Ошибка при создании даты с учетом часового пояса:', error);
                        // В случае ошибки используем стандартное создание даты
                        const now = new Date();
                        feedingTime = new Date(now);
                        feedingTime.setHours(hours, minutes, 0, 0);
                    }
                } else {
                    // Если часовой пояс не установлен, используем стандартное создание даты
                    const now = new Date();
                    feedingTime = new Date(now);
                    feedingTime.setHours(hours, minutes, 0, 0);
                    
                    // Время распаршено без учета часового пояса
                }
                
                // Убираем найденное время из текста деталей
                detailsText = text.replace(timeRegex, '').trim();
                
                // Если после удаления времени не осталось текста, используем оригинальный текст
                if (detailsText === '') {
                    detailsText = text;
                }
            }
        }

        // Парсинг введенных деталей
        const parsed = FeedingParser.parseDetails(detailsText);

        if (!parsed.isValid && parsed.error) {
            ctx.reply(
                `❌ Ошибка: ${parsed.error}\n\nПопробуйте еще раз или используйте примеры выше.`,
                Markup.keyboard([['🏠 На главную']]).resize()
            );
            return;
        }

        // Обновляем запись о кормлении в БД
        
        await globalDatabase.updateFeedingDetails(
            lastFeedingId,
            parsed.amount,
            parsed.foodType,
            parsed.details,
            feedingTime
        );
        
        // Детали кормления успешно обновлены

        // Формируем сообщение об обновлении
        let updateMessage = `✅ Детали кормления обновлены!\n\n`;
        if (feedingTime) {
            updateMessage += `⏰ Время: ${formatDateTime(feedingTime, user?.timezone)}\n`;
        }
        updateMessage += `📝 Детали: ${parsed.details}\n`;
        updateMessage += `👤 Кто: ${user?.username || 'Пользователь'}`;

        // Уведомляем всех пользователей об обновлении
        const allUsers = await globalDatabase.getAllUsers();
        for (const u of allUsers) {
            if (u.notificationsEnabled) {
                try {
                    await ctx.telegram.sendMessage(
                        u.telegramId,
                        `📝 ${updateMessage}`
                    );
                } catch (error) {
                    console.error(
                        `Ошибка отправки уведомления пользователю ${u.telegramId}:`,
                        error
                    );
                }
            }
        }

        // Детали кормления обновлены успешно

        // Очищаем ID кормления из сессии
        if (ctx.session) {
            delete ctx.session.lastFeedingId;
        }

        // Возврат на главный экран
        setTimeout(() => {
            ctx.scene.enter(SCENES.MAIN);
        }, 2000);
    } catch (error) {
        console.error('Ошибка обновления деталей кормления:', error);
        ctx.reply(
            '❌ Произошла ошибка при сохранении деталей. Попробуйте еще раз.',
            Markup.keyboard([['🏠 На главную']]).resize()
        );
    }
});
