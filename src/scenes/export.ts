import { Scenes } from 'telegraf';
import { BotContext } from '../types';
import { getExportKeyboard } from '../utils/keyboards';
import { MESSAGES, SCENES, EXPORT_SETTINGS } from '../utils/constants';
import { ExportService } from '../services/export';

export const exportScene = new Scenes.BaseScene<BotContext>(SCENES.EXPORT);

// Вход в сцену экспорта
exportScene.enter((ctx) => {
  // Инициализируем данные сессии для экспорта
  ctx.session.export = {
    format: null,
    period: null,
    step: 'format' // format -> period -> process
  };
  
  ctx.reply(MESSAGES.EXPORT_MENU, getExportKeyboard());
});

// Обработка выбора формата CSV
exportScene.hears(/📋 CSV формат/, (ctx) => {
  ctx.session.export.format = 'csv';
  ctx.reply(
    '📋 Выбран CSV формат\n\n' +
    'Теперь выберите период для экспорта:',
    getExportKeyboard()
  );
});

// Обработка выбора формата HTML
exportScene.hears(/🌐 HTML формат/, (ctx) => {
  ctx.session.export.format = 'html';
  ctx.reply(
    '🌐 Выбран HTML формат\n\n' +
    'Теперь выберите период для экспорта:',
    getExportKeyboard()
  );
});

// Обработка выбора периода "За неделю"
exportScene.hears(/📅 За неделю/, async (ctx) => {
  if (!ctx.session.export.format) {
    ctx.reply(
      '❌ Сначала выберите формат файла.',
      getExportKeyboard()
    );
    return;
  }
  
  await processExport(ctx, 'week');
});

// Обработка выбора периода "За месяц"
exportScene.hears(/🗓️ За месяц/, async (ctx) => {
  if (!ctx.session.export.format) {
    ctx.reply(
      '❌ Сначала выберите формат файла.',
      getExportKeyboard()
    );
    return;
  }
  
  await processExport(ctx, 'month');
});

// Обработка выбора периода "Все время"
exportScene.hears(/📊 Все время/, async (ctx) => {
  if (!ctx.session.export.format) {
    ctx.reply(
      '❌ Сначала выберите формат файла.',
      getExportKeyboard()
    );
    return;
  }
  
  await processExport(ctx, 'all');
});

// Функция для обработки экспорта
async function processExport(ctx: BotContext, period: 'week' | 'month' | 'all') {
  try {
    const format = ctx.session.export.format as 'csv' | 'html';
    
    // Показываем сообщение о начале экспорта
    const periodText = period === 'week' ? 'неделю' : period === 'month' ? 'месяц' : 'все время';
    const formatText = format === 'csv' ? 'CSV' : 'HTML';
    
    ctx.reply(`⏳ Экспорт данных в ${formatText} формат за ${periodText}...`);
    
    // Создаем сервис экспорта
    const exportService = new ExportService(ctx.database);
    
    // Выполняем экспорт
    const result = await exportService.exportFeedings({
      format,
      period
    });
    
    // Отправляем файл пользователю
    await ctx.replyWithDocument({
      source: result.filePath,
      filename: result.fileName
    });
    
    // Показываем информацию об экспорте
    const fileSizeKB = Math.round(result.fileSize / 1024);
    ctx.reply(
      `${MESSAGES.EXPORT_SUCCESS}\n\n` +
      `📄 Файл: ${result.fileName}\n` +
      `📊 Записей: ${result.recordCount}\n` +
      `📁 Размер: ${fileSizeKB} КБ\n\n` +
      `Файл отправлен выше.`,
      getExportKeyboard()
    );
    
  } catch (error) {
    console.error('Ошибка при экспорте:', error);
    
    let errorMessage = MESSAGES.EXPORT_ERROR;
    
    if (error instanceof Error) {
      if (error.message === 'Нет данных для экспорта') {
        errorMessage = MESSAGES.NO_FEEDINGS_FOUND;
      } else {
        errorMessage += `\n\nОшибка: ${error.message}`;
      }
    }
    
    ctx.reply(errorMessage, getExportKeyboard());
  }
}

// Обработка кнопки "На главную"
exportScene.hears(/🏠 На главную/, (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка команды /home
exportScene.command('home', (ctx) => {
  ctx.scene.enter(SCENES.MAIN);
});

// Обработка неизвестных команд
exportScene.on('text', (ctx) => {
  const text = ctx.message.text;
  
  // Пропускаем команды, начинающиеся с /
  if (text.startsWith('/')) {
    return;
  }
  
  let message = 'Выберите формат файла и период для экспорта.';
  
  if (!ctx.session.export.format) {
    message = '📋 Сначала выберите формат файла (CSV или HTML).';
  } else {
    message = `📋 Формат ${ctx.session.export.format.toUpperCase()} выбран.\n\n` +
              '📅 Теперь выберите период для экспорта.';
  }
  
  ctx.reply(message, getExportKeyboard());
}); 
