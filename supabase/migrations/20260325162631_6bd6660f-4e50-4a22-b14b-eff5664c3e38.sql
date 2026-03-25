SELECT cron.schedule(
  'sync-b2b-catalog-periodic',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://fonvunyiaxcjkodrnpox.supabase.co/functions/v1/sync-b2b-catalog',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvbnZ1bnlpYXhjamtvZHJucG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzY3NTIsImV4cCI6MjA4NTAxMjc1Mn0.zFu-l9-G3WEeTAj_S7okBBAl4PkLGI3obQObTM7Lmgo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);