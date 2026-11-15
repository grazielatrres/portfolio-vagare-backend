import * as Sentry from '@sentry/node';
import { env } from './env';

type LogLevel = 'info' | 'warn' | 'error';

let sentryEnabled = false;

// Sem SENTRY_DSN (dev local, testes) o Sentry fica desligado e só os logs
// estruturados no stdout seguem valendo. Em produção o DSN vem do .env da EC2.
export function initObservability(): void {
  if (!env.sentryDsn) {
    sentryEnabled = false;
    return;
  }

  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    release: env.release,
    tracesSampleRate: env.sentryTracesSampleRate,
    // Não envia usuário, cookies, headers, query nem corpos de requisição:
    // o app trafega dados pessoais e senhas (LGPD).
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
  });
  sentryEnabled = true;
}

export function isSentryEnabled(): boolean {
  return sentryEnabled;
}

// Uma linha JSON por evento: o `docker compose logs` da EC2 (e qualquer coletor
// que ler o stdout do container) consegue filtrar por level, path, status etc.
export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  if (env.nodeEnv === 'test') return;

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...fields,
  });

  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

// Garante o envio dos eventos pendentes antes de o processo encerrar.
export async function flushObservability(timeoutMs = 2000): Promise<void> {
  if (sentryEnabled) {
    await Sentry.flush(timeoutMs);
  }
}

export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));

  log('error', err.message, { ...context, stack: err.stack });

  if (sentryEnabled) {
    Sentry.captureException(err, { extra: context });
  }
}
