process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-integration';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
