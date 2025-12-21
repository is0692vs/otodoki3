-- Schedule the refill-track-pool job
-- Schedule: '0 15 * * *' (UTC 15:00 = JST 00:00)
SELECT cron.schedule(
  'refill-track-pool',
  '0 15 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/refill-pool',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
      ),
      body := jsonb_build_object(
        'time', now(),
        'source', 'pg_cron'
      )
    ) as request_id;
  $$
);
