-- The dash rule is site-runtime's WRITING_RULES' own, so ai.prompt.style no longer repeats it (area 11, W5) and keeps
-- no germomics addition. Rewritten only if it was not edited live. Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
UPDATE settings SET value = ''
  WHERE key = 'ai.prompt.style' AND value = 'Germomics house rule, on top of the writing rules above: no em dashes (the long dash character) anywhere; use commas, periods, parentheses, or colons instead.';
