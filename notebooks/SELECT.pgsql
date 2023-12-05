SELECT
                            --path,
                            --language,
                            --title,
                            content,
                            query,
                            ts_headline(content, query)
                            --content_complement,
                            --metadata,
                            --ts_rank_cd(to_tsvector('english', content), query) AS keyword_search_score
                            FROM "23e560fc94734e2cbae575a98b53f468", 
                            plainto_tsquery('english', 'are maternity treatments covered') query 
                            WHERE ts @@ query 
                            --ORDER BY keyword_search_score DESC


ALTER TABLE "23e560fc94734e2cbae575a98b53f468" ADD COLUMN ts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED

CREATE INDEX ts_idx ON "23e560fc94734e2cbae575a98b53f468" USING GIN (ts)

SELECT 'a fat cat sat on a mat and ate a fat rat'::tsvector @@ 'cat & rat'::tsquery