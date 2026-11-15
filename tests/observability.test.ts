// observability.test.ts — monitoramento: Sentry, logs estruturados e health checks

import * as Sentry from '@sentry/node';
import request from 'supertest';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { prisma } from '../src/config/prisma';
import {
  captureError,
  flushObservability,
  initObservability,
  isSentryEnabled,
  log,
} from '../src/config/observability';

const sentry = Sentry as unknown as {
  init: jest.Mock;
  captureException: jest.Mock;
  flush: jest.Mock;
};
const queryRaw = (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw;

describe('observability', () => {
  const original = { dsn: env.sentryDsn, nodeEnv: env.nodeEnv };

  afterEach(() => {
    env.sentryDsn = original.dsn;
    env.nodeEnv = original.nodeEnv;
    initObservability();
    jest.restoreAllMocks();
  });

  describe('initObservability', () => {
    it('não inicializa o Sentry sem SENTRY_DSN', () => {
      env.sentryDsn = '';
      initObservability();

      expect(sentry.init).not.toHaveBeenCalled();
      expect(isSentryEnabled()).toBe(false);
    });

    it('inicializa o Sentry sem enviar dados pessoais quando há DSN', () => {
      env.sentryDsn = 'https://key@o0.ingest.sentry.io/1';
      initObservability();

      expect(isSentryEnabled()).toBe(true);
      expect(sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://key@o0.ingest.sentry.io/1',
          dataCollection: expect.objectContaining({
            userInfo: false,
            httpHeaders: false,
            httpBodies: [],
          }),
        }),
      );
    });
  });

  describe('captureError', () => {
    it('envia ao Sentry quando habilitado', () => {
      env.sentryDsn = 'https://key@o0.ingest.sentry.io/1';
      initObservability();

      captureError(new Error('boom'), { path: '/trips' });

      expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
        extra: { path: '/trips' },
      });
    });

    it('converte valores que não são Error', () => {
      env.sentryDsn = 'https://key@o0.ingest.sentry.io/1';
      initObservability();

      captureError('texto');

      const [sent] = sentry.captureException.mock.calls[0];
      expect(sent).toBeInstanceOf(Error);
      expect(sent.message).toBe('texto');
    });

    it('não chama o Sentry quando desabilitado', () => {
      env.sentryDsn = '';
      initObservability();

      captureError(new Error('boom'));

      expect(sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe('flushObservability', () => {
    it('só faz flush quando o Sentry está habilitado', async () => {
      env.sentryDsn = '';
      initObservability();
      await flushObservability();
      expect(sentry.flush).not.toHaveBeenCalled();

      env.sentryDsn = 'https://key@o0.ingest.sentry.io/1';
      initObservability();
      await flushObservability(500);
      expect(sentry.flush).toHaveBeenCalledWith(500);
    });
  });

  describe('log', () => {
    it('não escreve nada em ambiente de teste', () => {
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      log('info', 'mensagem');
      expect(out).not.toHaveBeenCalled();
    });

    it('escreve uma linha JSON no stdout para info e no stderr para error', () => {
      env.nodeEnv = 'production';
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      log('info', 'ok', { status: 200 });
      log('error', 'falhou');

      const info = JSON.parse(out.mock.calls[0][0]);
      expect(info).toEqual(expect.objectContaining({ level: 'info', message: 'ok', status: 200 }));
      expect(JSON.parse(err.mock.calls[0][0])).toEqual(
        expect.objectContaining({ level: 'error', message: 'falhou' }),
      );
    });
  });

  describe('requestLogger', () => {
    it('registra método, path sem query, status e duração', async () => {
      env.nodeEnv = 'production';
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);

      await request(createApp()).get('/health?token=segredo');

      const entry = JSON.parse(out.mock.calls[0][0]);
      expect(entry).toEqual(
        expect.objectContaining({
          message: 'http_request',
          method: 'GET',
          path: '/health',
          status: 200,
        }),
      );
      expect(typeof entry.durationMs).toBe('number');
    });

    it('usa level warn para 4xx e error para 5xx', async () => {
      env.nodeEnv = 'production';
      const out = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      const err = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      queryRaw.mockRejectedValueOnce(new Error('db down'));

      await request(createApp()).get('/trips');
      await request(createApp()).get('/health/ready');

      const levels = [...out.mock.calls, ...err.mock.calls].map(([line]) => JSON.parse(line).level);
      expect(levels).toEqual(expect.arrayContaining(['warn', 'error']));
    });
  });

  describe('GET /health/ready', () => {
    it('retorna 200 quando o banco responde', async () => {
      queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const response = await request(createApp()).get('/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({ status: 'ok', database: 'up' }));
    });

    it('retorna 503 e captura o erro quando o banco não responde', async () => {
      env.sentryDsn = 'https://key@o0.ingest.sentry.io/1';
      initObservability();
      queryRaw.mockRejectedValueOnce(new Error('connection refused'));

      const response = await request(createApp()).get('/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'error', database: 'down' });
      expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
        extra: { check: 'database' },
      });
    });
  });
});
