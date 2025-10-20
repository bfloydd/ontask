export interface Command {
    execute(): Promise<void>;
}

export interface EventListener {
    (data?: any): void;
}

export interface EventSubscription {
    unsubscribe(): void;
}
