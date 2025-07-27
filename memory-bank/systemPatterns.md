# Системные паттерны

## Архитектурные подходы

- **Модульная структура**: разделение на сцены (handlers/scenes) и сервисы (services)
- **Finite State Machine (FSM)**: использование Telegraf Scenes для управления диалогами
- **Сервисный слой**: бизнес-логика инкапсулирована в сервисах (DatabaseService, TimerService)
- **Dependency Injection**: передача зависимостей через конструкторы

## Шаблоны проектирования

1. **Фасад** (DatabaseService):

```typescript
class DatabaseService {
    async getLastFeeding() {
        // Реализация запроса к БД
    }
}
```

2. **Наблюдатель** (TimerService):

```typescript
timerService.on('feeding_time', () => {
    notificationService.notifyAllUsers();
});
```

3. **Состояние** (Scenes):

```typescript
const mainScene = new Scenes.BaseScene('main');
mainScene.enter(ctx => ctx.reply('Главное меню'));
```

4. **Стратегия** (ParserService):

```typescript
class TimeParser {
    parse(input: string) {
        // Разные стратегии парсинга
    }
}
```

## Примеры реализации

### Инициализация сервисов

```typescript
const database = new DatabaseService();
const timerService = new TimerService(bot, database);
```

### Работа с базой данных

```typescript
// Создание пользователя
await database.createUser(telegramId, username);

// Получение последнего кормления
const lastFeeding = await database.getLastFeeding();
```

### Обработка сцен

```typescript
bot.command('start', ctx => ctx.scene.enter('main'));
```

## Принципы обработки ошибок

- Глобальный обработчик в `bot.catch()`
- Локальные обработчики в сценах
- Повторные попытки для сетевых операций
- Информирование пользователя об ошибках
