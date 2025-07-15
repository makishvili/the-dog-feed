// Временные интервалы
export const FEEDING_INTERVAL_HOURS = 3.5;
export const REMINDER_INTERVAL_MINUTES = 10;
export const DEFAULT_FEEDING_INTERVAL_MINUTES = 210; // 3.5 часа

// Сообщения
export const MESSAGES = {
  FEEDING_REMINDER: '🔔 Пора покормить собаку!',
  REPEATED_REMINDER: '🔔 Напоминание: собаку все еще нужно покормить!',
  FEEDING_COMPLETED: '🍽️ Собаку покормили!',
  FEEDINGS_STOPPED: '⏹️ Кормления на сегодня завершены',
  FEEDINGS_RESUMED: '▶️ Кормления возобновлены',
  WELCOME: 'Привет! 🐕\n\nЭтот бот поможет координировать кормление собаки.\nВыберите действие:',
  FEEDING_SUCCESS: '✅ Кормление записано успешно!\n\nЧто дальше?',
  SETTINGS_PLACEHOLDER: '⚙️ Настройки\n\nВыберите что настроить:',
  HISTORY_PLACEHOLDER: '📋 История кормлений\n\n(Функция будет добавлена в следующих этапах)',
  UNKNOWN_COMMAND: 'Я не понимаю эту команду. Используйте кнопки меню.',
  INTERVAL_UPDATED: '✅ Интервал кормления обновлен!',
  FULL_HISTORY_HEADER: '📋 Полная история кормлений',
  EXPORT_MENU: '📤 Экспорт истории кормлений\n\nВыберите формат и период:',
  EXPORT_SUCCESS: '✅ Экспорт завершен успешно!',
  EXPORT_ERROR: '❌ Ошибка при экспорте данных',
  NO_FEEDINGS_FOUND: '🔍 Кормления не найдены для выбранного периода',
  LOADING_HISTORY: '⏳ Загрузка истории...',
  STATISTICS_HEADER: '📊 Статистика кормлений',
  SCHEDULE_FEEDING_HEADER: '📅 Создать кормление на точное время',
  SCHEDULE_FEEDING_PROMPT: 'Введите время кормления в формате:\n\n• HH:MM (сегодня)\n• DD.MM HH:MM (конкретная дата)\n• DD.MM.YYYY HH:MM (полная дата)\n\nПримеры:\n• 19:30\n• 15.07 09:00\n• 15.07.2024 19:30',
  SCHEDULE_FEEDING_SUCCESS: '✅ Кормление запланировано!',
  SCHEDULE_FEEDING_ERROR: '❌ Ошибка при планировании кормления',
  SCHEDULED_LIST_HEADER: '📋 Запланированные кормления',
  SCHEDULED_LIST_EMPTY: '📋 Нет запланированных кормлений',
  SCHEDULED_FEEDING_NOTIFICATION: '🔔 Запланированное кормление!\n\nПора покормить собаку!',
  SCHEDULED_FEEDING_CANCELLED: '❌ Кормление отменено',
  SCHEDULED_FEEDING_INVALID_TIME: '❌ Время должно быть в будущем',
  SCHEDULED_FEEDING_MAX_PERIOD: '❌ Максимальный период планирования: 7 дней',
  ALL_SCHEDULED_CANCELLED: '❌ Все запланированные кормления отменены'
};

// Эмодзи для кнопок
export const EMOJIS = {
  FEED: '🍽️',
  STOP: '⏹️',
  SETTINGS: '⚙️',
  HISTORY: '📋',
  HOME: '🏠',
  DETAILS: '📝',
  INTERVAL: '⏰',
  EXPORT: '📤',
  FILTER: '🔍',
  PREV: '◀️',
  NEXT: '▶️',
  STATS: '📊',
  SCHEDULE: '📅',
  CANCEL: '❌',
  LIST: '📋',
  CLOCK: '🕐'
};

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  FEEDING_DETAILS: 'feeding_details',
  SETTINGS: 'settings',
  HISTORY: 'history',
  INTERVAL_SETTINGS: 'interval_settings',
  TODAY_HISTORY: 'today_history',
  FOOD_SETTINGS: 'food_settings',
  FOOD_TYPE_SETTINGS: 'food_type_settings',
  FOOD_AMOUNT_SETTINGS: 'food_amount_settings',
  NOTIFICATION_SETTINGS: 'notification_settings',
  FULL_HISTORY: 'full_history',
  EXPORT: 'export',
  SCHEDULE_FEEDING: 'schedule_feeding',
  SCHEDULED_LIST: 'scheduled_list'
};

// Настройки экспорта
export const EXPORT_SETTINGS = {
  RECORDS_PER_PAGE: 10,
  EXPORT_DIR: './exports',
  PERIODS: {
    WEEK: 'week',
    MONTH: 'month',
    ALL: 'all'
  },
  FORMATS: {
    CSV: 'csv',
    HTML: 'html'
  }
};

// Настройки планировщика
export const SCHEDULER_SETTINGS = {
  MAX_SCHEDULE_DAYS: 7, // Максимум 7 дней для планирования
  MAX_SCHEDULED_FEEDINGS: 10, // Максимум 10 одновременных запланированных кормлений
  MIN_SCHEDULE_MINUTES: 5 // Минимум 5 минут от текущего времени
};

