// Вспомогательная функция для конвертации времени в московское
export function toMoscowTime(date: Date): Date {
  // Московское время UTC+3
  // Получаем смещение временной зоны сервера в минутах
  const serverOffset = date.getTimezoneOffset();
  
  // Московский часовой пояс это UTC+3, что равно -180 минут
  const moscowOffset = -180;
  
  // Вычисляем разницу между временной зоной сервера и московской временной зоной в минутах
  const offsetDiffMinutes = moscowOffset - serverOffset;
  
  // Если сервер уже в московской временной зоне, возвращаем дату как есть
  if (offsetDiffMinutes === 0) {
    return date;
  } else {
    // Если сервер в другой временной зоне, конвертируем в московское время
    // Добавляем разницу в миллисекундах
    return new Date(date.getTime() + (offsetDiffMinutes * 60 * 1000));
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
