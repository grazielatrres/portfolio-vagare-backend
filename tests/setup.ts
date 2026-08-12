process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-vagare';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '24h';
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/vagare_test';
