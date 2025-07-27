// Функция для определения смещения времени пользователя относительно сервера (в минутах)
export function getTimeOffsetInMinutes(
    serverTime: Date,
    userTime: number
): number {
    // userTime приходит из ctx.message.date и представляет собой timestamp в секундах
    const userTimeMs = userTime * 1000;
    const offsetMs = userTimeMs - serverTime.getTime();
    //   return Math.round(offsetMs / 60000); // Переводим миллисекунды в минуты
    return 180; // UTC+03:00
}

// Функция для определения часового пояса по смещению в минутах
export function getTimezoneByOffset(offsetMinutes: number): string | null {
    // Список наиболее популярных часовых поясов с их смещениями в минутах
    const timezones: { [key: number | string]: string } = {
        '-720': 'Etc/GMT+12', // UTC-12:00
        '-660': 'Pacific/Apia', // UTC-11:00
        '-600': 'Pacific/Honolulu', // UTC-10:00
        '-570': 'Pacific/Marquesas', // UTC-09:30
        '-540': 'America/Anchorage', // UTC-09:00
        '-480': 'America/Los_Angeles', // UTC-08:00
        '-420': 'America/Denver', // UTC-07:00
        '-360': 'America/Chicago', // UTC-06:00
        '-300': 'America/New_York', // UTC-05:00
        '-270': 'America/Caracas', // UTC-04:30
        '-240': 'America/Santiago', // UTC-04:00
        '-210': 'America/St_Johns', // UTC-03:30
        '-180': 'America/Sao_Paulo', // UTC-03:00
        '-120': 'Atlantic/South_Georgia', // UTC-02:00
        '-60': 'Atlantic/Azores', // UTC-01:00
        0: 'UTC', // UTC+00:00
        60: 'Europe/London', // UTC+01:00
        120: 'Europe/Paris', // UTC+02:00
        180: 'Europe/Moscow', // UTC+03:00
        210: 'Asia/Tehran', // UTC+03:30
        240: 'Asia/Dubai', // UTC+04:00
        270: 'Asia/Kabul', // UTC+04:30
        300: 'Asia/Karachi', // UTC+05:00
        330: 'Asia/Kolkata', // UTC+05:30
        345: 'Asia/Kathmandu', // UTC+05:45
        360: 'Asia/Dhaka', // UTC+06:00
        390: 'Asia/Yangon', // UTC+06:30
        420: 'Asia/Bangkok', // UTC+07:00
        480: 'Asia/Shanghai', // UTC+08:00
        525: 'Australia/Eucla', // UTC+08:45
        540: 'Asia/Tokyo', // UTC+09:00
        570: 'Australia/Darwin', // UTC+09:30
        600: 'Australia/Sydney', // UTC+10:00
        630: 'Australia/Lord_Howe', // UTC+10:30
        660: 'Pacific/Noumea', // UTC+11:00
        720: 'Pacific/Auckland', // UTC+12:00
        765: 'Pacific/Chatham', // UTC+12:45
        780: 'Pacific/Tongatapu', // UTC+13:00
        840: 'Pacific/Kiritimati', // UTC+14:00
    };

    // Округляем смещение до ближайшего получаса (30 минут)
    const roundedOffset = Math.round(offsetMinutes / 30) * 30;

    // Проверяем точное совпадение
    if (timezones[offsetMinutes]) {
        return timezones[offsetMinutes];
    }

    // Проверяем округленное значение
    if (timezones[roundedOffset]) {
        return timezones[roundedOffset];
    }

    // Если не нашли точного совпадения, возвращаем null
    return null;
}
