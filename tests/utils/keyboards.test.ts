import * as keyboards from '../../src/utils/keyboards';
import { EMOJIS } from '../../src/utils/constants';

describe('keyboards', () => {
    describe('getMainKeyboard', () => {
        it('should return keyboard with feeding details button when showFeedingDetailsButton is true', () => {
            const keyboard = keyboards.getMainKeyboard(true);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual(['📝 Уточнить детали кормления']);
            expect(buttons[1]).toEqual([
                'Когда следующее кормление?',
                'Другие действия',
            ]);
        });

        it('should return keyboard without feeding details button when showFeedingDetailsButton is false', () => {
            const keyboard = keyboards.getMainKeyboard(false);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual([`${EMOJIS.FEED} Собачка поел`]);
            expect(buttons[1]).toEqual([
                'Когда следующее кормление?',
                'Другие действия',
            ]);
        });
    });

    describe('getSettingsKeyboard', () => {
        it('should return settings keyboard with correct buttons', () => {
            const keyboard = keyboards.getSettingsKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual([
                '🍽️ корм',
                '⏰ интервал',
                '🔔 уведомления',
            ]);
            expect(buttons[1]).toEqual(['🏠 На главную']);
        });
    });

    describe('getHistoryKeyboard', () => {
        it('should return history keyboard with correct buttons', () => {
            const keyboard = keyboards.getHistoryKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual(['📅 сегодня', '📋 всё время']);
            expect(buttons[1]).toEqual(['🏠 На главную']);
        });
    });

    describe('getBackKeyboard', () => {
        it('should return back keyboard with correct buttons', () => {
            const keyboard = keyboards.getBackKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(1);
            expect(buttons[0]).toEqual(['🏠 На главную']);
        });
    });

    describe('getScheduleManagementKeyboard', () => {
        it('should return schedule management keyboard with correct buttons', () => {
            const keyboard = keyboards.getScheduleManagementKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual(['📅 Запланировать кормление']);
            expect(buttons[1]).toEqual([
                '📋 Просмотреть запланированные',
                '❌ Отменить запланированные',
            ]);
            expect(buttons[2]).toEqual(['🏠 На главную']);
        });
    });

    describe('getScheduleFeedingKeyboard', () => {
        it('should return schedule feeding keyboard with correct buttons', () => {
            const keyboard = keyboards.getScheduleFeedingKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual(['❌ Отменить ввод']);
            expect(buttons[1]).toEqual(['🏠 На главную']);
        });
    });

    describe('getScheduledListKeyboard', () => {
        it('should return scheduled list keyboard with correct buttons', () => {
            const keyboard = keyboards.getScheduledListKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual(['📅 Создать новое кормление']);
            expect(buttons[1]).toEqual(['❌ Отменить все']);
            expect(buttons[2]).toEqual(['🏠 На главную']);
        });
    });

    describe('getScheduledItemKeyboard', () => {
        it('should return scheduled item keyboard with correct buttons', () => {
            const scheduleId = 123;
            const keyboard = keyboards.getScheduledItemKeyboard(scheduleId);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual([`❌ Отменить кормление ${scheduleId}`]);
            expect(buttons[1]).toEqual(['📋 На главную к списку']);
            expect(buttons[2]).toEqual(['🏠 На главную']);
        });
    });

    describe('getFullHistoryKeyboard', () => {
        it('should return full history keyboard with correct buttons', () => {
            const keyboard = keyboards.getFullHistoryKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual(['📤 Экспорт истории', '🔍 Фильтры']);
            expect(buttons[1]).toEqual(['▶️ Далее']);
            expect(buttons[2]).toEqual(['⬅️ Назад', '🏠 На главную']);
        });
    });

    describe('getExportKeyboard', () => {
        it('should return export keyboard with correct buttons', () => {
            const keyboard = keyboards.getExportKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual(['📋 CSV формат', '🌐 HTML формат']);
            expect(buttons[1]).toEqual([
                '📅 За неделю',
                '🗓️ За месяц',
                '📊 Все время',
            ]);
            expect(buttons[2]).toEqual(['🏠 На главную']);
        });
    });

    describe('getPaginationKeyboard', () => {
        it('should return pagination keyboard with both navigation buttons when hasPrev and hasNext are true', () => {
            const keyboard = keyboards.getPaginationKeyboard(2, 5, true, true);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(4);
            expect(buttons[0]).toEqual(['◀️ Предыдущая', '▶️ Следующая']);
            expect(buttons[1]).toEqual(['📄 Страница 2 из 5']);
            expect(buttons[2]).toEqual(['📤 Экспорт истории']);
            expect(buttons[3]).toEqual(['⬅️ Назад', '🏠 На главную']);
        });

        it('should return pagination keyboard with only previous button when hasPrev is true and hasNext is false', () => {
            const keyboard = keyboards.getPaginationKeyboard(5, 5, false, true);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(4);
            expect(buttons[0]).toEqual(['◀️ Предыдущая']);
            expect(buttons[1]).toEqual(['📄 Страница 5 из 5']);
            expect(buttons[2]).toEqual(['📤 Экспорт истории']);
            expect(buttons[3]).toEqual(['⬅️ Назад', '🏠 На главную']);
        });

        it('should return pagination keyboard with only next button when hasPrev is false and hasNext is true', () => {
            const keyboard = keyboards.getPaginationKeyboard(1, 5, true, false);
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(4);
            expect(buttons[0]).toEqual(['▶️ Следующая']);
            expect(buttons[1]).toEqual(['📄 Страница 1 из 5']);
            expect(buttons[2]).toEqual(['📤 Экспорт истории']);
            expect(buttons[3]).toEqual(['⬅️ Назад', '🏠 На главную']);
        });

        it('should return pagination keyboard without page info when totalPages is 1', () => {
            const keyboard = keyboards.getPaginationKeyboard(
                1,
                1,
                false,
                false
            );
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(2);
            expect(buttons[0]).toEqual(['📤 Экспорт истории']);
            expect(buttons[1]).toEqual(['⬅️ Назад', '🏠 На главную']);
        });
    });

    describe('getOtherActionsKeyboard', () => {
        it('should return other actions keyboard with correct buttons', () => {
            const keyboard = keyboards.getOtherActionsKeyboard();
            const buttons = keyboard.reply_markup.keyboard;

            expect(buttons).toHaveLength(3);
            expect(buttons[0]).toEqual(['⏹️ Завершить кормления на сегодня']);
            expect(buttons[1]).toEqual([
                '📋 История кормлений',
                '⚙️ Настройки',
            ]);
            expect(buttons[2]).toEqual(['🏠 На главную']);
        });
    });
});
