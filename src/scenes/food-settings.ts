import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { DatabaseService } from '../services/database';
import { FeedingParser } from '../services/feeding-parser';
import { SCENES } from '../utils/constants';

export const foodSettingsScene = new Scenes.BaseScene<BotContext>(
    SCENES.FOOD_SETTINGS
);

// Глобальная переменная для доступа к базе данных
let globalDatabase: DatabaseService | null = null;

// Функция для установки глобальной базы данных
export function setGlobalDatabaseForFoodSettings(database: DatabaseService) {
    globalDatabase = database;
}

// Вход в сцену настроек корма
foodSettingsScene.enter(async ctx => {
    try {
        if (!globalDatabase) {
            ctx.reply(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );
            return;
        }

        // Получаем текущие настройки из БД
        const currentType =
            (await globalDatabase.getSetting('default_food_type')) || 'dry';
        const currentAmount =
            (await globalDatabase.getSetting('default_food_amount')) || '12';

        const typeText = currentType === 'dry' ? 'Сухой' : 'Влажный';

        const message =
            `🍽️ корм\n\n` +
            `Текущие настройки:\n` +
            `• Тип корма: ${typeText}\n` +
            `• Количество: ${currentAmount} граммов\n\n` +
            `Введите новые настройки корма:\n\n` +
            `Примеры форматов:\n` +
            FeedingParser.getExamples()
                .map(example => `• ${example}`)
                .join('\n');

        ctx.reply(message, Markup.keyboard([['🏠 На главную']]).resize());
    } catch (error) {
        console.error('Ошибка получения настроек корма:', error);
        ctx.reply(
            '❌ Ошибка получения настроек. Попробуйте еще раз.',
            Markup.keyboard([['🏠 На главную']]).resize()
        );
    }
});

// Обработка ввода настроек корма
foodSettingsScene.on('text', async ctx => {
    const text = ctx.message.text;

    // Проверка на кнопку "На главную"
    if (text.includes('🏠 На главную')) {
        ctx.scene.enter(SCENES.MAIN);
        return;
    }

    // Проверка на кнопку "Назад"
    if (text.includes('⬅️ Назад')) {
        ctx.scene.enter(SCENES.SETTINGS);
        return;
    }

    try {
        if (!globalDatabase) {
            ctx.reply(
                'Ошибка: база данных не инициализирована. Попробуйте перезапустить бота командой /start'
            );
            return;
        }

        // Парсинг введенных настроек
        const parsed = FeedingParser.parseDetails(text);

        if (!parsed.isValid) {
            ctx.reply(
                `❌ Ошибка: ${parsed.error}\n\n` +
                    `Попробуйте еще раз или используйте примеры выше.`,
                Markup.keyboard([['🏠 На главную']]).resize()
            );
            return;
        }

        // Сохранение новых настроек
        let updatedSettings = [];

        if (parsed.amount !== undefined) {
            await globalDatabase.setSetting(
                'default_food_amount',
                parsed.amount.toString()
            );
            updatedSettings.push(`количество: ${parsed.amount} граммов`);
        }

        if (parsed.foodType !== undefined) {
            await globalDatabase.setSetting(
                'default_food_type',
                parsed.foodType
            );
            const typeText = parsed.foodType === 'dry' ? 'сухой' : 'влажный';
            updatedSettings.push(`тип: ${typeText}`);
        }

        const user = await globalDatabase.getUserByTelegramId(ctx.from!.id);

        const message =
            `✅ Настройки корма обновлены!\n\n` +
            `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
            `Изменения вступят в силу после следующего кормления.\n` +
            `Инициатор: ${user?.username || 'Пользователь'}`;

        // Уведомление других пользователей об изменении
        const allUsers = await globalDatabase.getAllUsers();
        for (const u of allUsers) {
            // Не отправляем уведомление пользователю, который сделал изменения
            if (u.telegramId !== ctx.from!.id && u.notificationsEnabled) {
                try {
                    await ctx.telegram.sendMessage(
                        u.telegramId,
                        `🍽️ ${message}`
                    );
                } catch (error) {
                    console.error(
                        `Ошибка отправки уведомления пользователю ${u.telegramId}:`,
                        error
                    );
                }
            }
        }

        console.log(
            `Настройки корма изменены: ${updatedSettings.join(', ')} пользователем ${user?.username}`
        );

        // Отправляем подтверждение только текущему пользователю
        ctx.reply(
            `✅ Настройки корма обновлены!\n\n` +
                `Новые настройки: ${updatedSettings.join(', ')}\n\n` +
                `Изменения вступят в силу после следующего кормления.`,
            Markup.keyboard([['⬅️ Назад', '🏠 На главную']]).resize()
        );
    } catch (error) {
        console.error('Ошибка сохранения настроек корма:', error);
        ctx.reply(
            '❌ Ошибка сохранения настроек. Попробуйте еще раз.',
            Markup.keyboard([['🏠 На главную']]).resize()
        );
    }
});
