import { LogLevel } from '../slices/logging/Logger';

class CentralizedLogger {
    private enabled: boolean = false;
    private level: LogLevel = LogLevel.INFO;

    enable(level: LogLevel = LogLevel.DEBUG): void {
        this.enabled = true;
        this.level = level;
    }

    disable(): void {
        this.enabled = false;
        this.level = LogLevel.NONE;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    getLevel(): LogLevel {
        return this.level;
    }

    shouldLog(level: LogLevel): boolean {
        return this.enabled && level <= this.level;
    }
}

export const centralizedLogger = new CentralizedLogger();
