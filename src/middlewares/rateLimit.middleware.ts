import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const LOGIN_RATE_LIMIT_MAX_FAILURES = 10;

// Conta só tentativas que falharam e usa IP + e-mail como chave: em redes móveis
// muitos usuários compartilham o mesmo IP (CGNAT), e limitar só por IP faria os
// erros de uma pessoa bloquearem as outras.
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
