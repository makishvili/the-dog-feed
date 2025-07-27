import { TimeParser } from '../../src/services/parser';

describe('TimeParser', () => {
    describe('parseInterval', () => {
        it('should parse minutes only format', () => {
            const result = TimeParser.parseInterval('15');
            expect(result.isValid).toBe(true);
            expect(result.minutes).toBe(15);
        });

        it('should parse hours and minutes colon format', () => {
            const result = TimeParser.parseInterval('2:30');
            expect(result.isValid).toBe(true);
            expect(result.minutes).toBe(150); // 2 hours 30 minutes
        });

        it('should parse minutes with text format', () => {
            const result = TimeParser.parseInterval('30 минут');
            expect(result.isValid).toBe(true);
            expect(result.minutes).toBe(30);
        });

        it('should parse hours with text format', () => {
            const result = TimeParser.parseInterval('2 часа');
            expect(result.isValid).toBe(true);
            expect(result.minutes).toBe(120); // 2 hours
        });

        it('should parse complex format', () => {
            const result = TimeParser.parseInterval('2 часа 30 минут');
            expect(result.isValid).toBe(true);
            expect(result.minutes).toBe(150); // 2 hours 30 minutes
        });

        it('should return error for invalid format', () => {
            const result = TimeParser.parseInterval('invalid');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe(
                'Неверный формат. Примеры: "1", "1мин", "2ч", "2:15", "2 часа 15 мин"'
            );
        });

        it('should return error for empty input', () => {
            const result = TimeParser.parseInterval('');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Пустое значение');
        });

        it('should validate minimum interval', () => {
            const result = TimeParser.parseInterval('0');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Минимальный интервал: 1 минута');
        });

        it('should validate maximum interval', () => {
            const result = TimeParser.parseInterval('25 часов');
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Максимальный интервал: 24 часа');
        });
    });

    describe('formatInterval', () => {
        it('should format minutes only', () => {
            const result = TimeParser.formatInterval(30);
            expect(result).toBe('30 мин');
        });

        it('should format hours only', () => {
            const result = TimeParser.formatInterval(120); // 2 hours
            expect(result).toBe('2 ч');
        });

        it('should format hours and minutes', () => {
            const result = TimeParser.formatInterval(150); // 2 hours 30 minutes
            expect(result).toBe('2 ч 30 мин');
        });
    });

    describe('getExamples', () => {
        it('should return examples array', () => {
            const examples = TimeParser.getExamples();
            expect(Array.isArray(examples)).toBe(true);
            expect(examples.length).toBeGreaterThan(0);
        });
    });
});
