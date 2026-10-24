-- AI drafts now run on a Claude Code routine (app/lib/ai.server.ts): the model is the routine's,
-- and the site holds no Anthropic key. Drops the unused model setting and the overloaded
-- message, and rewrites the two messages that named the API, unless they were edited live.
DELETE FROM settings WHERE key = 'ai.model';
DELETE FROM content_blocks WHERE key = 'snippet:ai.error.overloaded';
UPDATE content_blocks SET value = 'AI drafting is not set up. Set the AI_ROUTINE_URL and AI_ROUTINE_TOKEN worker secrets.'
  WHERE key = 'snippet:ai.error.not_configured' AND value = 'AI is not configured. Set the ANTHROPIC_API_KEY worker secret.';
UPDATE content_blocks SET value = 'Too many drafting sessions this hour. Try again later.'
  WHERE key = 'snippet:ai.error.rate_limit' AND value = 'AI rate limit hit. Wait a moment and try again.';
UPDATE settings SET description = 'Max drafting sessions started per day across the admin.' WHERE key = 'ai.daily_cap';
