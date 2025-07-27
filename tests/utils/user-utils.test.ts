import { createUserLink, createUserText } from '../../src/utils/user-utils';
import { DatabaseUser } from '../../src/services/database';

describe('user-utils', () => {
    describe('createUserLink', () => {
        it('should return fallback text when user is null', () => {
            const result = createUserLink(null);
            expect(result).toBe('Какой-то хороший человек');
        });

        it('should return fallback text with custom text when user is null', () => {
            const result = createUserLink(null, 'Anonymous');
            expect(result).toBe('Anonymous');
        });

        it('should return username with @ when user has username', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: 'testuser',
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserLink(user);
            expect(result).toBe('@testuser');
        });

        it('should add @ to username when user has username without @', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: 'testuser',
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserLink(user);
            expect(result).toBe('@testuser');
        });

        it('should return Telegram link when user has no username', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: undefined,
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserLink(user);
            expect(result).toBe(
                '[Пользователь 123456789](tg://user?id=123456789)'
            );
        });
    });

    describe('createUserText', () => {
        it('should return fallback text when user is null', () => {
            const result = createUserText(null);
            expect(result).toBe('Какой-то хороший человек');
        });

        it('should return fallback text with custom text when user is null', () => {
            const result = createUserText(null, 'Anonymous');
            expect(result).toBe('Anonymous');
        });

        it('should return username with @ when user has username', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: 'testuser',
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserText(user);
            expect(result).toBe('@testuser');
        });

        it('should add @ to username when user has username without @', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: 'testuser',
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserText(user);
            expect(result).toBe('@testuser');
        });

        it('should return user ID when user has no username', () => {
            const user: DatabaseUser = {
                telegramId: 123456789,
                username: undefined,
                id: 1,
                notificationsEnabled: true,
                feedingInterval: 210,
                createdAt: new Date(),
            };

            const result = createUserText(user);
            expect(result).toBe('Пользователь 123456789');
        });
    });
});
