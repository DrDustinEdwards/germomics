-- contract: the four AI drafting error messages (seeded by 0005 and reworded by 0011) belong to the retired draft buttons; nothing reads them.
DELETE FROM content_blocks WHERE key IN (
  'snippet:ai.error.not_configured',
  'snippet:ai.error.rate_limit',
  'snippet:ai.error.no_transcript',
  'snippet:ai.error.daily_cap'
);
