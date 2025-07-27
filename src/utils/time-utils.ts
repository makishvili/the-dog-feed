// Вспомогательная функция для форматирования даты в формате "26 июля, 04:23"
// Если передан timezone, форматирует с учетом часового пояса
export function formatDateTime(date: Date, timezone?: string): string {
    // Если передан часовой пояс, используем Intl.DateTimeFormat
    if (timezone) {
        try {
            const formatter = new Intl.DateTimeFormat('ru-RU', {
                day: 'numeric',
                month: 'long',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone,
            });

            // Получаем части даты
            const parts = formatter.formatToParts(date);
            const day = parts.find(p => p.type === 'day')?.value || '';
            const month = parts.find(p => p.type === 'month')?.value || '';
            const hour = parts.find(p => p.type === 'hour')?.value || '';
            const minute = parts.find(p => p.type === 'minute')?.value || '';

            // Корректируем окончание месяца
            const monthWithEnding = getMonthWithEnding(month);

            return `${day} ${monthWithEnding} в ${hour}:${minute}`;
        } catch (error) {
            console.error(
                'Ошибка форматирования даты с часовым поясом:',
                error
            );
            // В случае ошибки используем стандартное форматирование
            return formatDateTimeLocal(date);
        }
    } else {
        // Если часовой пояс не передан, используем стандартное форматирование
        return formatDateTimeLocal(date);
    }
}

// Вспомогательная функция для стандартного форматирования даты
function formatDateTimeLocal(date: Date): string {
    const months = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря',
    ];

    const day = date.getDate();
    const month = months[date.getMonth()];
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day} ${month} в ${hours}:${minutes}`;
}

// Вспомогательная функция для коррекции окончания месяца
function getMonthWithEnding(month: string): string {
    // Словарь для коррекции окончаний месяцев
    const monthEndings: Record<string, string> = {
        январь: 'января',
        февраль: 'февраля',
        март: 'марта',
        апрель: 'апреля',
        май: 'мая',
        июнь: 'июня',
        июль: 'июля',
        август: 'августа',
        сентябрь: 'сентября',
        октябрь: 'октября',
        ноябрь: 'ноября',
        декабрь: 'декабря',
    };

    return monthEndings[month] || month;
}
