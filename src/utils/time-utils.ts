// Вспомогательная функция для конвертации времени в московское
export function toMoscowTime(date: Date): Date {
  // Московское время UTC+3
  // Проверяем, находится ли сервер уже в московской временной зоне
  const serverOffset = date.getTimezoneOffset();
  
  // Московский часовой пояс это UTC+3, что равно -180 минут
  if (serverOffset === -180) {
    // Если сервер уже в московской временной зоне, возвращаем дату как есть
    return date;
  } else {
    // Если сервер в другой временной зоне, конвертируем из UTC в московское время
    // Московское время UTC+3, поэтому добавляем 3 часа к UTC времени
    return new Date(date.getTime() + (3 * 60 * 60 * 1000));
  }
}

// Вспомогательная функция для форматирования даты в формате "26 июля, 04:23"
export function formatDateTime(date: Date): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day} ${month} в ${hours}:${minutes}`;
}
