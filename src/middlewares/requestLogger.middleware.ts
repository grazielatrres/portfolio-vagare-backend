import { NextFunction, Request, Response } from 'express';
import { log } from '../config/observability';

// Loga método, rota, status e duração de cada requisição ao terminar a resposta.
// Usa o path sem query string para não vazar tokens (ex.: ?token= do reset de senha).
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    log(level, 'http_request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
