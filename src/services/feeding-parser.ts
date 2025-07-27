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
                error: 'Пустое значение',
            };
        }

        // Если начинается с "не кормим" - это причина отказа
        if (trimmed.toLowerCase().startsWith('не кормим')) {
            return {
                details: trimmed,
                isValid: true,
            };
        }

        // Попытка парсинга количества и типа
        const parsers = [
            this.parseAmountOnly,
            this.parseAmountWithType,
            this.parseTypeWithAmount,
            this.parseComplexFormat,
        ];

        for (const parser of parsers) {
            const result = parser(trimmed);
            if (result.isValid) {
                return result;
            }
            // Если парсер вернул ошибку валидации, возвращаем её
            if (result.error) {
                return result;
            }
        }

        // Если не удалось распарсить как количество/тип, сохраняем как текст
        return {
            details: trimmed,
            isValid: true,
        };
    }

    // Парсинг только количества: "12", "25 гр", "30 грамм"
    private static parseAmountOnly(input: string): ParsedFeedingDetails {
        const patterns = [
            /^(\d+)\s*$/, // "12"
            /^(\d+)\s*(г|гр|грамм|граммов)$/i, // "12 гр", "25 грамм"
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                const amount = parseInt(match[1]);
                const validation = FeedingParser.validateAmount(amount);
                if (validation.isValid) {
                    return {
                        amount,
                        details: `${amount} граммов`,
                        isValid: true,
                    };
                } else {
                    return {
                        details: input,
                        isValid: false,
                        error: validation.error,
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
            /^(\d+)\s*(г|гр|грамм|граммов)?\s+(влажного|влажный|мокрого|мокрый|wet)$/i,
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                const amount = parseInt(match[1]);
                const typeText = match[3].toLowerCase();

                const validation = FeedingParser.validateAmount(amount);
                if (validation.isValid) {
                    const foodType =
                        typeText.includes('сух') || typeText === 'dry'
                            ? 'dry'
                            : 'wet';
                    const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';

                    return {
                        amount,
                        foodType,
                        details: `${amount} граммов ${typeRu} корма`,
                        isValid: true,
                    };
                } else {
                    return {
                        details: input,
                        isValid: false,
                        error: validation.error,
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
            /^(влажного|влажный|мокрого|мокрый|wet)\s+(\d+)\s*(г|гр|грамм|граммов)?$/i,
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                const typeText = match[1].toLowerCase();
                const amount = parseInt(match[2]);

                const validation = FeedingParser.validateAmount(amount);
                if (validation.isValid) {
                    const foodType =
                        typeText.includes('сух') || typeText === 'dry'
                            ? 'dry'
                            : 'wet';
                    const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';

                    return {
                        amount,
                        foodType,
                        details: `${amount} граммов ${typeRu} корма`,
                        isValid: true,
                    };
                } else {
                    return {
                        details: input,
                        isValid: false,
                        error: validation.error,
                    };
                }
            }
        }

        return { details: input, isValid: false };
    }

    // Парсинг сложных форматов: "63 влажного", "12г сухого корма"
    private static parseComplexFormat(input: string): ParsedFeedingDetails {
        const patterns = [
            /^(\d+)\s+(влажного|мокрого|сухого)$/i, // "63 влажного"
            /^(\d+)\s*(г|гр|грамм)?\s+(сухого|влажного|мокрого)\s+корма$/i, // "12г сухого корма"
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                const amount = parseInt(match[1]);
                const typeText = match[match.length - 1].toLowerCase(); // последняя группа - тип

                const validation = FeedingParser.validateAmount(amount);
                if (validation.isValid) {
                    const foodType = typeText.includes('сух') ? 'dry' : 'wet';
                    const typeRu = foodType === 'dry' ? 'сухого' : 'влажного';

                    return {
                        amount,
                        foodType,
                        details: `${amount} граммов ${typeRu} корма`,
                        isValid: true,
                    };
                } else {
                    return {
                        details: input,
                        isValid: false,
                        error: validation.error,
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
            '33 мокрого - 33 грамма влажного корма',
            'сухого 25 - 25 граммов сухого корма',
            'влажного 30г - 30 граммов влажного корма',
            'не кормим, потому что спит - причина отказа',
        ];
    }

    // Валидация количества
    static validateAmount(amount: number): {
        isValid: boolean;
        error?: string;
    } {
        if (amount < 1) {
            return { isValid: false, error: 'Минимальное количество: 1 грамм' };
        }

        if (amount > 500) {
            return {
                isValid: false,
                error: 'Максимальное количество: 500 граммов',
            };
        }

        return { isValid: true };
    }
}
