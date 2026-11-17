import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const LOGIN_RATE_LIMIT_MAX_FAILURES = 10;
export const API_RATE_LIMIT_MAX = 300;

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em instantes.' },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente mais tarde.' },
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_RATE_LIMIT_MAX_FAILURES,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const rawEmail: unknown = req.body?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
  },
  message: { error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' },
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas solicitações. Tente novamente mais tarde.' },
});
