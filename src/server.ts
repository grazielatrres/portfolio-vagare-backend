import { createApp } from './app';
import { assertServerEnv, env } from './config/env';
import { prisma } from './config/prisma';

async function bootstrap() {
  assertServerEnv();
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`Vagare API rodando em http://localhost:${env.port}`);
  });
}

bootstrap().catch(async (error) => {
  console.error('Falha ao iniciar o servidor:', error);
  await prisma.$disconnect();
  process.exit(1);
});
