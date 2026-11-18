-- contract: the snippets (nav labels, empty-state lines, meta text, dataset summaries) moved into the code; nothing reads kind='snippet' rows.
DELETE FROM content_blocks WHERE kind = 'snippet';
