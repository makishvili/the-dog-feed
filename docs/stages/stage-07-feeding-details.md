# Этап 7: Детали кормления

## Цель этапа
Добавить возможность уточнения деталей кормления после нажатия "Я покормил" с парсингом различных форматов ввода.

## Результат этапа
Бот с функциональностью:
- Экран успешного кормления с кнопкой "Уточнить детали кормления"
- Парсинг деталей кормления: "12 гр", "12 грамм сухого", "63 влажного", "не кормим, потому что..."
- Обновление записи о кормлении в БД с деталями
- Валидация и нормализация введенных данных
- Отображение деталей в истории кормлений

## Новые/измененные файлы

### 1. `src/services/feeding-parser.ts` (новый)
```typescript
export interface ParsedFeedingDetails {
  amount?: number;
  foodType?: 'dry' | 'wet';
  details: string;
  isValid: boolean;
  error?: string;
}

export class FeedingParser {
  // Парсинг деталей кормления
  static parseDetails(input: string): ParsedFeedingDetails {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return {
        details: '',
        isValid: false,
        error: 'Пустое значение'
      };
    }

    // Если начинается с "не кормим" - это причина отказа
    if (trimmed.toLowerCase().startsWith('не кормим')) {
      return {
        details: trimmed,
        isValid: true
      };
    }

    // Попытка парсинга количества и типа
    const parsers = [
      this.parseAmountOnly,
      this.parseAmountWithType,
      this.parseTypeWithAmount,
      this.parseComplexFormat
    ];

    for (const parser of parsers) {
      const result = parser(trimmed);
      if (result.isValid) {
        return result;
      }
    }

    // Если не удалось распарсить как количество/тип, сохраняем как текст
    return {
      details: trimmed,
      isValid: true
    };
  }

  // Парсинг только количества: "12", "25 гр", "30 грамм"
  private static parseAmountOnly(input: string): ParsedFeedingDetails {
    const patterns = [
      /^(\d+)\s*$/,                           // "12"
      /^(\d+)\s*(г|гр|грамм|граммов)$/i,      // "12 гр", "25 грамм"
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const amount = parseInt(match[1]);
        if (amount > 0 && amount <= 500) {
          return {
            amount,
            details: `${amount} граммов`,
            isValid: true
          };
        }
      }
    }

    return { details: input, isValid: false };
  }

  // Парсинг количества с типом: "12 грамм сухого", "25г влажного"
  private static parseAmountWithType(input: string): ParsedFeedingDetails {
    const patterns = [
      /^(\d+)\s*(г|гр|грамм|граммов)?\s+(сухого|сухой|dry)$/i,
      /^(\d+)\s*(г|гр|грамм|граммов)?\s+(влажного|влажный|wet)$/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const amount = parseInt(match[1]);
        const typeText = match[3].toLowerCase();
        
        if (amount > 0 && amount <= 500) {
          const foodType = (typeText.includes('сух') || typeText === 'dry') ? 'dry' : 'wet';
          const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';
          
          return {
            amount,
            foodType,
            details: `${amount} граммов ${typeRu} корма`,
            isValid: true
          };
        }
      }
    }

    return { details: input, isValid: false };
  }

  // Парсинг типа с количеством: "сухого 25", "влажного 30г"
  private static parseTypeWithAmount(input: string): ParsedFeedingDetails {
    const patterns = [
      /^(сухого|сухой|dry)\s+(\d+)\s*(г|гр|грамм|граммов)?$/i,
      /^(влажного|влажный|wet)\s+(\d+)\s*(г|гр|грамм|граммов)?$/i,
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const typeText = match[1].toLowerCase();
        const amount = parseInt(match[2]);
        
        if (amount > 0 && amount <= 500) {
          const foodType = (typeText.includes('сух') || typeText === 'dry') ? 'dry' : 'wet';
          const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';
          
          return {
            amount,
            foodType,
            details: `${amount} граммов ${typeRu} корма`,
            isValid: true
          };
        }
      }
    }

    return { details: input, isValid: false };
  }

  // Парсинг сложных форматов: "63 влажного", "12г сухого корма"
  private static parseComplexFormat(input: string): ParsedFeedingDetails {
    const patterns = [
      /^(\d+)\s+(влажного|сухого)$/i,                    // "63 влажного"
      /^(\d+)\s*(г|гр|грамм)?\s+(сухого|влажного)\s+корма$/i, // "12г сухого корма"
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match) {
        const amount = parseInt(match[1]);
        const typeText = match[match.length - 1].toLowerCase(); // последняя группа - тип
        
        if (amount > 0 && amount <= 500) {
          const foodType = typeText.includes('сух') ? 'dry' : 'wet';
          const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';
          
          return {
            amount,
            foodType,
            details: `${amount} граммов ${typeRu} корма`,
            isValid: true
          };
        }
      }
    }

    return { details: input, isValid: false };
  }

  // Примеры валидных форматов
  static getExamples(): string[] {
    return [
      '12 - 12 граммов',
      '12 гр - 12 граммов',
      '12 грамм сухого - 12 граммов сухого корма',
      '63 влажного - 63 грамма влажного корма',
      'сухого 25 - 25 граммов сухого корма',
      'влажного 30г - 30 граммов влажного корма',
      'не кормим, потому что спит - причина отказа'
    ];
  }

  // Валидация количества
  static validateAmount(amount: number): { isValid: boolean; error?: string } {
    if (amount < 1) {
      return { isValid: false, error: 'Минимальное количество: 1 грамм' };
    }
    
    if (amount > 500) {
      return { isValid: false, error: 'Максимальное количество: 500 граммов' };
    }
    
    return { isValid: true };
  }
}
```

### 2. `src/scenes/feeding-details.ts` (новый)
```typescript
import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types';
import { FeedingParser } from '../services/feeding-parser';
import { SCENES } from '../utils/constants';

export const feedingDetailsScene = new Scenes.BaseScene<BotContext>(SCENES.FEEDING_DETAILS);

// Вход в сцену уточнения деталей
feedingDetailsScene.enter(async (ctx) => {
  // Получаем ID последнего кормления из сессии
  const lastFeedingId = ctx.session?.lastFeedingId;
  
  if (!lastFeedingId) {
    ctx.reply(
      '❌ Не найдено кормление для уточнения деталей.',
      Markup.keyboard([['🏠 Главный экран']]).resize()
    );
    return;
  }

  const message = `📝 Уточнение деталей кормления\n\n` +
    `Введите детали кормления в любом удобном формате:\n\n` +
    `Примеры:\n` +
    FeedingParser.getExamples().map(example => `• ${example}`).join('\n') + '\n\n' +
    `Или опишите причину, если не кормили.`;

  ctx.reply(message, Markup.keyboard([
    ['🏠 Выйти на главный экран']
  ]).resize());
});

// Обработка ввода деталей
feedingDetailsScene.on('text', async (ctx) => {
  const text = ctx.message.text;

  // Проверка на кнопку "Выйти на главный экран"
  if (text.includes('🏠 Выйти на главный экран')) {
    ctx.scene.enter(SCENES.MAIN);
    return;
  }

  const lastFeedingId = ctx.session?.lastFeedingId;
  if (!lastFeedingId) {
    ctx.reply('❌ Ошибка: не найдено кормление для обновления');
    return;
  }

  try {
    // Парсинг введенных деталей
    const parsed = FeedingParser.parseDetails(text);

    if (!parsed.isValid && parsed.error) {
      ctx.reply(
        `❌ Ошибка: ${parsed.error}\n\nПопробуйте еще раз или используйте примеры выше.`,
        Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
      );
      return;
    }

    // Обновляем запись о кормлении в БД
    await ctx.database.updateFeedingDetails(
      lastFeedingId,
      parsed.amount,
      parsed.foodType,
      parsed.details
    );

    const user = await ctx.database.getUserByTelegramId(ctx.from!.id);

    // Формируем сообщение об обновлении
    let updateMessage = `✅ Детали кормления обновлены!\n\n`;
    updateMessage += `📝 Детали: ${parsed.details}\n`;
    updateMessage += `👤 Кто: ${user?.username || 'Пользователь'}`;

    // Уведомляем всех пользователей об обновлении
    const allUsers = await ctx.database.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, `📝 ${updateMessage}`);
        } catch (error) {
          console.error(`Ошибка отправки уведомления пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Детали кормления обновлены: ${parsed.details} пользователем ${user?.username}`);

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
      Markup.keyboard([['🏠 Выйти на главный экран']]).resize()
    );
  }
});
```

### 3. Обновить `src/database/db.ts` (добавить метод обновления)
```typescript
// ... предыдущий код ...

// Обновить детали кормления
async updateFeedingDetails(feedingId: number, amount?: number, foodType?: string, details?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let query = 'UPDATE feedings SET ';
    const params: any[] = [];
    const updates: string[] = [];

    if (amount !== undefined) {
      updates.push('amount = ?');
      params.push(amount);
    }

    if (foodType !== undefined) {
      updates.push('food_type = ?');
      params.push(foodType);
    }

    if (details !== undefined) {
      updates.push('details = ?');
      params.push(details);
    }

    if (updates.length === 0) {
      resolve();
      return;
    }

    query += updates.join(', ') + ' WHERE id = ?';
    params.push(feedingId);

    this.db.run(query, params, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// ... остальной код ...
```

### 4. Обновить `src/scenes/feeding-success.ts`
```typescript
import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getFeedingSuccessKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES } from '../utils/constants';

export const feedingSuccessScene = new Scenes.BaseScene<BotContext>(SCENES.FEEDING_SUCCESS);

// Вход в сцену успешного кормления
feedingSuccessScene.enter((ctx) => {
  ctx.reply(MESSAGES.FEEDING_SUCCESS, getFeedingSuccessKeyboard());
});

// Обработка кнопки "Уточнить детали кормления"
feedingSuccessScene.hears(/📝 Уточнить детали кормления/, (ctx) => {
  ctx.scene.enter(SCENES.FEEDING_DETAILS);
});

// Обработка кнопки "Выйти на главный экран"
feedingSuccessScene.hears(/🏠 Выйти на главный экран/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
feedingSuccessScene.on('text', (ctx) => {
  ctx.reply(
    'Используйте кнопки ниже для навигации.',
    getFeedingSuccessKeyboard()
  );
});
```

### 5. Обновить `src/handlers/main.ts`
```typescript
// ... предыдущий код ...

// Обработка кнопки "Я покормил"
async handleFeeding(ctx: Context): Promise<void> {
  try {
    const user = await this.getOrCreateUser(
      ctx.from!.id,
      ctx.from!.username || ctx.from!.first_name
    );

    // Получаем текущие настройки корма из БД
    const foodType = await this.database.getSetting('default_food_type') || 'dry';
    const foodAmount = parseInt(await this.database.getSetting('default_food_amount') || '12');

    // Создание записи о кормлении в БД с текущими настройками
    const feeding = await this.database.createFeeding(user.id, foodType, foodAmount);

    // Сохраняем ID кормления в сессии для возможности уточнения деталей
    if (!ctx.session) {
      ctx.session = {};
    }
    ctx.session.lastFeedingId = feeding.id;

    // Запуск таймера на следующее кормление
    this.timerService.startFeedingTimer();

    // Форматирование информации о корме
    const foodInfo = `${foodAmount}г ${foodType === 'dry' ? 'сухого' : 'влажного'} корма`;

    // Уведомление всех пользователей
    const message = `${MESSAGES.FEEDING_COMPLETED}\n` +
      `Время: ${feeding.timestamp.toLocaleString('ru-RU')}\n` +
      `Кто: ${user.username || 'Пользователь'}\n` +
      `Корм: ${foodInfo}\n\n` +
      `⏰ Следующее кормление через ${Math.round(this.timerService.getCurrentInterval() / 60)} часов`;

    // Отправка уведомления всем пользователям
    const allUsers = await this.database.getAllUsers();
    for (const u of allUsers) {
      if (u.notificationsEnabled) {
        try {
          await ctx.telegram.sendMessage(u.telegramId, message);
        } catch (error) {
          console.error(`Ошибка отправки сообщения пользователю ${u.telegramId}:`, error);
        }
      }
    }

    console.log(`Кормление записано: ${user.username} в ${feeding.timestamp}, ${foodInfo}`);

    // Переход к сцене успешного кормления
    await ctx.scene.enter(SCENES.FEEDING_SUCCESS);

  } catch (error) {
    console.error('Ошибка обработки кормления:', error);
    ctx.reply('❌ Произошла ошибка при записи кормления. Попробуйте еще раз.');
  }
}

// ... остальной код остается тем же ...
```

### 6. Обновить `src/utils/constants.ts`
```typescript
// ... предыдущий код ...

// Названия сцен
export const SCENES = {
  MAIN: 'main',
  FEEDING_SUCCESS: 'feeding_success',
  FEEDING_DETAILS: 'feeding_details',
  SETTINGS: 'settings',
  HISTORY: 'history',
  TODAY_HISTORY: 'today_history',
  INTERVAL_SETTINGS: 'interval_settings',
  FOOD_SETTINGS: 'food_settings'
};
```

### 7. Обновить `src/types.ts`
```typescript
// ... предыдущий код ...

// Расширение контекста Telegraf
declare module 'telegraf' {
  interface Context {
    session?: {
      feedingInterval?: number; // интервал в минутах
      lastFeedingId?: number;   // ID последнего кормления для уточнения деталей
    };
    timerService?: TimerService;
    database?: Database;
  }
}
```

### 8. Обновить `src/bot.ts` (добавить новую сцену)
```typescript
// ... импорты ...
import { feedingDetailsScene } from './scenes/feeding-details';

// ... остальной код ...

// Настройка сцен
const stage = new Scenes.Stage([
  mainScene,
  feedingSuccessScene,
  feedingDetailsScene,
  settingsScene,
  historyScene,
  todayHistoryScene,
  intervalSettingsScene,
  foodSettingsScene,
  foodTypeSettingsScene,
  foodAmountSettingsScene
]);

// ... остальной код остается тем же ...
```

## Инструкции по тестированию

### Тестовые сценарии:

1. **Базовый поток уточнения деталей**:
   - Нажать "Я покормил"
   - На экране успешного кормления нажать "Уточнить детали кормления"
   - Ввести детали и проверить обновление

2. **Парсинг различных форматов**:
   - Ввести "25" → должно стать "25 граммов"
   - Ввести "12 грамм сухого" → должно стать "12 граммов сухого корма"
   - Ввести "63 влажного" → должно стать "63 грамма влажного корма"
   - Ввести "сухого 30г" → должно стать "30 граммов сухого корма"

3. **Причины отказа**:
   - Ввести "не кормим, потому что спит" → должно сохраниться как есть
   - Проверить отображение в истории

4. **Валидация**:
   - Ввести количество больше 500 → должна быть ошибка
   - Ввести 0 → должна быть ошибка

5. **Уведомления**:
   - После уточнения деталей все пользователи должны получить уведомление
   - Проверить формат уведомления

6. **История с деталями**:
   - Перейти в История → Сегодня
   - Проверить отображение деталей кормления

### Проверка БД:
```sql
SELECT f.*, u.username 
FROM feedings f 
LEFT JOIN users u ON f.user_id = u.id 
WHERE f.details IS NOT NULL 
ORDER BY f.timestamp DESC;
```

## Ограничения этапа
- Нет персональных настроек уведомлений
- Нет экспорта истории
- Нет создания кормлений на точное время
- Простая обработка ошибок

## Переход к следующему этапу
После успешного тестирования можно переходить к Этапу 8: добавление персональных настроек уведомлений для каждого пользователя.
