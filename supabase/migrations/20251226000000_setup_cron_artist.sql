SELECT cron.schedule(
  'refill-track-pool-artist',
  '0 3 * * *',
  $$
  SELECT
    net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/refill-pool-artist',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_auth_key')
      ),
      body := jsonb_build_object('time', now(), 'source', 'pg_cron')
    ) as request_id;
  $$
);
