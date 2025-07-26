import { Markup } from 'telegraf';
import { EMOJIS } from './constants';

// Главная клавиатура
export function getMainKeyboard(showFeedingDetailsButton = false) {
  const keyboard = [];
  
  // Добавляем кнопку "Уточнить детали кормления" если нужно
  if (showFeedingDetailsButton) {
    keyboard.push(['📝 Уточнить детали кормления']);
  }
  
  // Основные кнопки
  // Если показываем кнопку уточнения деталей, то кнопка "Я покормил" не нужна
  if (!showFeedingDetailsButton) {
    keyboard.push([`${EMOJIS.FEED} Я покормил`]);
  }
  
  keyboard.push([`${EMOJIS.SCHEDULE} Внеплановые кормления`, `${EMOJIS.STOP} Сегодня больше не даем`]);
  keyboard.push([`${EMOJIS.HISTORY} История`, `${EMOJIS.SETTINGS} Настройки`]);
  
  return Markup.keyboard(keyboard).resize();
}

// Клавиатура настроек
export function getSettingsKeyboard() {
  return Markup.keyboard([
    ['🍽️ Корм', '⏰ Время между кормлениями', '🔔 Вкл/выкл уведомления'],
    ['🏠 Назад']
  ]).resize();
}

// Клавиатура истории
export function getHistoryKeyboard() {
  return Markup.keyboard([
    ['📅 Сегодня', '📋 Все время'],
    ['🏠 Назад']
  ]).resize();
}

// Универсальная кнопка "Назад"
export function getBackKeyboard() {
  return Markup.keyboard([
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для управления расписанием
export function getScheduleManagementKeyboard() {
  return Markup.keyboard([
    ['📅 Запланировать кормление на время'],
    ['📋 Все запланированные', '❌ Отменить все запланированные'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для создания кормления
export function getScheduleFeedingKeyboard() {
  return Markup.keyboard([
    ['❌ Отменить ввод'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для списка запланированных кормлений
export function getScheduledListKeyboard() {
  return Markup.keyboard([
    ['📅 Создать новое кормление'],
    ['❌ Отменить все'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для отдельного запланированного кормления
export function getScheduledItemKeyboard(scheduleId: number) {
  return Markup.keyboard([
    [`❌ Отменить кормление ${scheduleId}`],
    ['📋 Назад к списку'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для полной истории
export function getFullHistoryKeyboard() {
  return Markup.keyboard([
    ['📤 Экспорт истории', '🔍 Фильтры'],
    ['◀️ Назад', '▶️ Далее'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для экспорта
export function getExportKeyboard() {
  return Markup.keyboard([
    ['📋 CSV', '🌐 HTML'],
    ['📅 неделя', '🗓️ месяц', '📊 все время'],
    ['🏠 На главный экран']
  ]).resize();
}

// Клавиатура для пагинации
export function getPaginationKeyboard(currentPage: number, totalPages: number, hasNext: boolean, hasPrev: boolean) {
  const buttons = [];
  
  // Кнопки навигации
  if (hasPrev && hasNext) {
    buttons.push(['◀️ Предыдущая', '▶️ Следующая']);
  } else if (hasPrev) {
    buttons.push(['◀️ Предыдущая']);
  } else if (hasNext) {
    buttons.push(['▶️ Следующая']);
  }
  
  // Информация о странице
  if (totalPages > 1) {
    buttons.push([`📄 Страница ${currentPage} из ${totalPages}`]);
  }
  
  // Дополнительные действия
  buttons.push(['📤 Экспорт истории']);
  buttons.push(['🏠 На главный экран']);
  
  return Markup.keyboard(buttons).resize();
}
