import request from 'supertest';
import { createApp } from '../src/app';
import { API_RATE_LIMIT_MAX } from '../src/middlewares/rateLimit.middleware';

describe('Rate limit geral da API', () => {
  const app = createApp();

  it('não conta os health checks', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['ratelimit-limit']).toBeUndefined();
  });

  it('informa o limite nos headers das rotas da API', async () => {
    const response = await request(app).get('/trips').set('X-Forwarded-For', '198.51.100.1');

    expect(response.headers['ratelimit-limit']).toBe(String(API_RATE_LIMIT_MAX));
  });

  it(`retorna 429 depois de ${API_RATE_LIMIT_MAX} requisições do mesmo IP`, async () => {
    const ip = '198.51.100.2';

    for (let i = 0; i < API_RATE_LIMIT_MAX; i++) {
      await request(app).get('/trips').set('X-Forwarded-For', ip);
    }

    const blocked = await request(app).get('/trips').set('X-Forwarded-For', ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Muitas requisições. Tente novamente em instantes.' });

    const otherClient = await request(app).get('/trips').set('X-Forwarded-For', '198.51.100.3');
    expect(otherClient.status).toBe(401);
  });
});
