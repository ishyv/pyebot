type LogLevel = "info" | "warn" | "error" | "debug";

function timestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, context: string, message: string, meta?: unknown): void {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] [${context}]`;
  const out = level === "info" || level === "debug" ? console.log : console[level];
  if (meta !== undefined) {
    out(`${prefix} ${message}`, meta);
  } else {
    out(`${prefix} ${message}`);
  }
}

export function createLogger(context: string) {
  return {
    info: (message: string, meta?: unknown) => log("info", context, message, meta),
    warn: (message: string, meta?: unknown) => log("warn", context, message, meta),
    error: (message: string, meta?: unknown) => log("error", context, message, meta),
    debug: (message: string, meta?: unknown) => {
      if (process.env.DEBUG) log("debug", context, message, meta);
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
