# Audit changes - operations notes

## Environment variables (all optional unless marked)
- MONGODB_URI, JWT_SECRET (required; use 32+ random chars), EMAIL_HOST/PORT/USER/PASS (existing)
- ALLOWED_ORIGINS  comma list of extra allowed browser origins (production domains + Azure hostname are already allowed)
- NODE_ENV=production (enables HSTS, hides stack traces)
- MONGO_MAX_POOL_SIZE (default 20), SESSION_TTL_STAFF (12h), SESSION_TTL_SELLER (24h), SESSION_TTL_CUSTOMER (7d)
- SINGLE_SESSION_ROLES (default admin,restrictedadmin,agent,seller), ENABLE_CRON=false on all but one instance if you prefer
- EMAIL_TLS_REJECT_UNAUTHORIZED=false only if your SMTP certificate genuinely cannot be validated
- UV_THREADPOOL_SIZE=8 (Azure app setting) - lets bcrypt use more threads for logins

## Azure settings to check
- Health check path: /ready (Settings > Health check). Always On: enabled. ARR affinity: off. Scale out to 2+ instances for uptime.
- Alerts: HTTP 5xx, response time, health-check failures; Application Insights for log search.

## One-time effects of deploying
- Everyone is logged out once (old tokens have no server-side session).
- Agents who completed first-login setup before this fix have an unusable password hash (double-hashed). They must use "Forgot password".
- Optional room capacity: set singleRoomsAvailable / sharedRoomsAvailable on a Landlord document to enforce a hard limit; leave unset to use only the manual "full" switch.
