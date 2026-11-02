process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234567890';
process.env.SKIP_DB_GUARD = process.env.SKIP_DB_GUARD || '1';
process.env.BCRYPT_COST = '8';
process.env.SESSION_CACHE_MS = '0';
process.env.RL_APPLY_PER_EMAIL = process.env.RL_APPLY_PER_EMAIL || '1000';
