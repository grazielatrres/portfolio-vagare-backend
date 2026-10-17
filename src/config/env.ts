import dotenv from 'dotenv';

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '24h',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  gmailUser: process.env.GMAIL_USER ?? '',
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD ?? '',
  mailFromName: process.env.MAIL_FROM_NAME ?? 'Vagare',
  resetPasswordUrl: process.env.RESET_PASSWORD_URL ?? 'vagareapp://reset-password',
};

export function assertServerEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET'] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(', ')}`);
  }
}
