-- 0010_retire_better_auth.sql - drop the Better Auth tables. NOT additive: a deliberate retirement.
-- Cloudflare Access (application germomics-login) replaced the Better Auth admin sign-in in
-- PR #41 (job_7e3fefd2f0db), and no code reads or writes these tables any more. Dependents first
-- (session and account reference user), then user. IF EXISTS so a database that never had them
-- applies cleanly. 0000-0009 untouched.
-- The nightly backup excludes only the credential tables that exist at run time, so it passes
-- whether the deploy or this migration lands first (app/lib/backup.server.ts).

DROP INDEX IF EXISTS verification_identifier_idx;
DROP TABLE IF EXISTS verification;

DROP INDEX IF EXISTS session_userId_idx;
DROP TABLE IF EXISTS session;

DROP INDEX IF EXISTS account_userId_idx;
DROP TABLE IF EXISTS account;

DROP TABLE IF EXISTS user;
