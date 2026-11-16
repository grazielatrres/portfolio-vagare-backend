// Tem que vir antes de qualquer outro import (ver src/instrument.ts).
import './instrument';
import { assertServerEnv, env } from './config/env';
import { captureError, flushObservability, isSentryEnabled, log } from './config/observability';
import { createApp } from './app';
import { prisma } from './config/prisma';

async function bootstrap() {
  assertServerEnv();
  const app = createApp();

  app.listen(env.port, () => {
    log('info', 'server_started', {
      port: env.port,
      env: env.nodeEnv,
      release: env.release ?? 'local',
      sentry: isSentryEnabled(),
    });
  });
}

process.on('unhandledRejection', (reason) => {
  captureError(reason, { source: 'unhandledRejection' });
});

bootstrap().catch(async (error) => {
  captureError(error, { source: 'bootstrap' });
  await flushObservability();
  await prisma.$disconnect();
  process.exit(1);
});
