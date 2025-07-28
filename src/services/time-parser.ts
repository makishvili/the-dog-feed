export interface ParsedInterval {
    minutes: number;
    isValid: boolean;
    error?: string;
}

export class TimeParser {
    // Парсинг интервала времени
    static parseInterval(input: string): ParsedInterval {
        const trimmed = input.trim().toLowerCase();

        if (!trimmed) {
            return { minutes: 0, isValid: false, error: 'Пустое значение' };
        }

        // Попытка парсинга различных форматов
        const parsers = [
            this.parseMinutesOnly,
            this.parseHoursMinutesColon,
            this.parseHoursMinutesText,
            this.parseHoursOnly,
            this.parseComplexFormat,
        ];

        for (const parser of parsers) {
            const result = parser(trimmed);
            if (result.isValid) {
                return this.validateInterval(result.minutes);
            }
        }

        return {
            minutes: 0,
            isValid: false,
            error: 'Неверный формат. Примеры: "1", "1мин", "2ч", "2:15", "2 часа 15 мин"',
        };
    }

    // Парсинг только минут: "1", "15", "30"
    private static parseMinutesOnly(input: string): ParsedInterval {
        const match = input.match(/^(\d+)$/);
        if (match) {
            const minutes = parseInt(match[1]);
            return { minutes, isValid: true };
        }
        return { minutes: 0, isValid: false };
    }

    // Парсинг формата "2:15", "1:30"
    private static parseHoursMinutesColon(input: string): ParsedInterval {
        const match = input.match(/^(\d+):(\d+)$/);
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            if (minutes < 60) {
                return { minutes: hours * 60 + minutes, isValid: true };
            }
        }
        return { minutes: 0, isValid: false };
    }

    // Парсинг "1мин", "15мин", "1 минута", "15 минут"
    private static parseHoursMinutesText(input: string): ParsedInterval {
        // Минуты
        const minMatch = input.match(/^(\d+)\s*(мин|минута|минуты|минут)$/);
        if (minMatch) {
            const minutes = parseInt(minMatch[1]);
            return { minutes, isValid: true };
        }

        // Часы
        const hourMatch = input.match(/^(\d+)\s*(ч|час|часа|часов)$/);
        if (hourMatch) {
            const hours = parseInt(hourMatch[1]);
            return { minutes: hours * 60, isValid: true };
        }

        return { minutes: 0, isValid: false };
    }

    // Парсинг только часов: "2ч", "1 час"
    private static parseHoursOnly(input: string): ParsedInterval {
        const match = input.match(/^(\d+)\s*(ч|час|часа|часов)$/);
        if (match) {
            const hours = parseInt(match[1]);
            return { minutes: hours * 60, isValid: true };
        }
        return { minutes: 0, isValid: false };
    }

    // Парсинг сложных форматов: "2 часа 15 мин", "1ч 30м"
    private static parseComplexFormat(input: string): ParsedInterval {
        // "2 часа 15 мин", "2ч 15м", "2 ч 15 мин"
        const match = input.match(
            /^(\d+)\s*(ч|час|часа|часов)\s*(\d+)\s*(м|мин|минута|минуты|минут)$/
        );
        if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[3]);
            if (minutes < 60) {
                return { minutes: hours * 60 + minutes, isValid: true };
            }
        }

        // "15 мин", "30 минут" (уже обработано выше, но для полноты)
        const minOnlyMatch = input.match(/^(\d+)\s*(мин|минута|минуты|минут)$/);
        if (minOnlyMatch) {
            const minutes = parseInt(minOnlyMatch[1]);
            return { minutes, isValid: true };
        }

        return { minutes: 0, isValid: false };
    }

    // Валидация интервала (1 минута - 24 часа)
    private static validateInterval(minutes: number): ParsedInterval {
        if (minutes < 1) {
            return {
                minutes: 0,
                isValid: false,
                error: 'Минимальный интервал: 1 минута',
            };
        }

        if (minutes > 24 * 60) {
            return {
                minutes: 0,
                isValid: false,
                error: 'Максимальный интервал: 24 часа',
            };
        }

        return { minutes, isValid: true };
    }

    // Форматирование интервала для отображения
    static formatInterval(minutes: number): string {
        if (minutes < 60) {
            return `${minutes} мин`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours} ч`;
        }

        return `${hours} ч ${remainingMinutes} мин`;
    }

    // Примеры валидных форматов
    static getExamples(): string[] {
        return [
            '1 - 1 минута',
            '15 - 15 минут',
            '1мин - 1 минута',
            '30 минут - 30 минут',
            '2ч - 2 часа',
            '1 час - 1 час',
            '2:15 - 2 часа 15 минут',
            '1ч 30м - 1 час 30 минут',
            '2 часа 15 мин - 2 часа 15 минут',
        ];
    }
}
