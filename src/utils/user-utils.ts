import { DatabaseUser } from '../services/database';

/**
 * Нормализует username, добавляя @ если нужно
 */
function normalizeUsername(username: string): string {
    return username.startsWith('@') ? username : `@${username}`;
}

/**
 * Создает кликабельную ссылку на пользователя Telegram
 * @param user Объект пользователя из базы данных
 * @param fallbackText Текст по умолчанию для null пользователя
 * @returns Строка с Markdown-ссылкой на пользователя или его имя
 */
export function createUserLink(
    user: DatabaseUser | null,
    fallbackText = 'Какой-то хороший человек'
): string {
    if (!user) return fallbackText;

    return user.username
        ? normalizeUsername(user.username)
        : `[Пользователь ${user.telegramId}](tg://user?id=${user.telegramId})`;
}

/**
 * Создает текстовое представление пользователя без ссылки
 * @param user Объект пользователя из базы данных
 * @param fallbackText Текст по умолчанию для null пользователя
 * @returns Строка с именем пользователя или его ID
 */
export function createUserText(
    user: DatabaseUser | null,
    fallbackText = 'Какой-то хороший человек'
): string {
    if (!user) return fallbackText;

    return user.username
        ? normalizeUsername(user.username)
        : `Пользователь ${user.telegramId}`;
}
