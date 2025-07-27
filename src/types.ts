import { DatabaseService } from './services/database';

export interface User {
    id: number;
    telegramId: number;
    username?: string;
    notificationsEnabled: boolean;
    feedingInterval?: number; // добавлено для совместимости с базой данных
    timezone?: string; // Добавлено для поддержки часовых поясов
}

export interface Feeding {
    id: number;
    userId: number;
    timestamp: Date;
    foodType: string; // изменено с 'dry' | 'wet' на string для гибкости
    amount: number; // граммы
    details?: string;
}

// Устаревший интерфейс для обратной совместимости
export interface BotState {
    users: Map<number, User>;
    feedings: Feeding[];
    nextFeedingId: number;
    nextUserId: number;
}

// Новый интерфейс для работы с базой данных
export interface DatabaseBotState {
    database: DatabaseService;
    defaultFeedingInterval: number;
}

// Расширенный контекст с поддержкой базы данных
export interface ExtendedBotContext {
    session?: {
        feedingInterval?: number;
        [key: string]: any;
    };
    scene: {
        enter: (sceneId: string) => void;
        leave: () => void;
        [key: string]: any;
    };
    reply: (text: string, extra?: any) => Promise<any>;
    telegram: any;
    from?: {
        id: number;
        username?: string;
        first_name?: string;
    };
    message?: {
        text: string;
    };
    database?: DatabaseService;
    [key: string]: any;
}

// Используем any для упрощения типизации, но предоставляем расширенный интерфейс
export type BotContext = any;
