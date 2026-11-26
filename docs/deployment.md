# Production deployment

Rentivo uses three HTTPS hostnames on the Hostinger VPS:

- `rentivo.ph` serves marketing pages, public vehicle pages, bookings, and customer booking access.
- `app.rentivo.ph` serves the staff dashboard and account flows.
- `api.rentivo.ph` serves the Laravel API.

The public and dashboard hostnames use the same React build. The frontend routes account/authentication traffic to `app.rentivo.ph` and customer-facing routes to `rentivo.ph`.

## GitHub Actions

`.github/workflows/ci-cd.yml` runs:

- PHP 8.4 backend tests against MySQL 8.
- Frontend lint, tests, and a production build configured for the three production hosts.
- Deployment on `master` only after both test jobs pass, and only after `DEPLOY_ENABLED` is set to `true`.

Create a GitHub Actions environment named `production`. Add the following **environment variables**:

| Variable | Example/value |
| --- | --- |
| `VPS_HOST` | VPS IP address or SSH hostname |
| `VPS_PORT` | SSH port, commonly `22` |
| `VPS_USER` | Dedicated non-root deployment user |
| `DEPLOY_ROOT` | `/var/www/rentivo` |
| `VPS_KNOWN_HOSTS` | Verified SSH host-key line(s) for the VPS |

Add `VPS_SSH_KEY` as an **environment secret** containing the private key for the deployment user. Verify the VPS host-key fingerprint through a trusted channel before adding its `known_hosts` entry. Do not put private keys, `.env`, or database credentials in the repository or workflow file.

Configure required reviewers for the `production` environment if deployments should require approval. Keep the repository variable `DEPLOY_ENABLED` unset or false while preparing the VPS; set it to `true` only after the setup and first backup below are complete.

## VPS layout and first-time preparation

Use a dedicated deployment user with SSH access, PHP 8.4.1 or later and Laravel-required extensions, Composer, `rsync`, `curl`, `flock` (provided by `util-linux`), and access to the MySQL database. Node.js is not required on the VPS. The deployment user must be able to run Composer and Artisan commands and write to `shared/storage`. PHP-FPM must also be able to write to that storage directory; use a shared group/permissions rather than making it world-writable.

Before enabling deploys:

1. Create `$DEPLOY_ROOT/shared/.env` on the VPS. Set at least:
   - `APP_ENV=production`, `APP_DEBUG=false`, a securely generated `APP_KEY`.
   - `APP_URL=https://api.rentivo.ph`.
   - `FRONTEND_URL=https://rentivo.ph` and `DASHBOARD_URL=https://app.rentivo.ph`.
   - MySQL connection values and `FILESYSTEM_DISK=local` (public uploads use Laravel's public disk while booking documents remain private).
   - After Resend verifies `rentivo.ph`, set `MAIL_MAILER=resend`, `RESEND_API_KEY` to a sending key, `MAIL_FROM_ADDRESS=notifications@rentivo.ph`, and `MAIL_FROM_NAME=Rentivo`. Keep the API key only in this VPS `.env`; it is not needed by GitHub Actions.
2. Keep the `.env` readable by the deployment user and PHP-FPM, but not publicly accessible. Back it up securely.
3. Configure DNS A/AAAA records for all three hostnames to the VPS and install valid TLS certificates.
4. Configure Nginx document roots and PHP handling as below. Both frontend hostnames should point to the same `$DEPLOY_ROOT/current/frontend` directory; the API root is `$DEPLOY_ROOT/current/backend/public`.
5. Ensure `$DEPLOY_ROOT` and `$DEPLOY_ROOT/shared` are on the VPS and reachable by the deployment user. The workflow creates release directories and shared storage directories.
6. Take a database backup before the first deployment. The deploy script runs `php artisan migrate --force`; migrations are not automatically reversed if a later deployment step fails.
7. Set up Laravel's scheduler using a cron entry for the deployment user:

   ```cron
   * * * * * cd /var/www/rentivo/current/backend && php artisan schedule:run >> /dev/null 2>&1
   ```

### Nginx site roots

Use separate server blocks with the correct TLS certificates. These are the essential routing directives; adapt the PHP-FPM socket and certificate paths to the VPS:

```nginx
# rentivo.ph and app.rentivo.ph: both use this frontend root
root /var/www/rentivo/current/frontend;
index index.html;
location / {
    try_files $uri $uri/ /index.html;
}
```

```nginx
# api.rentivo.ph
root /var/www/rentivo/current/backend/public;
index index.php;
client_max_body_size 10m;
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
location ~ \.php$ {
    include snippets/fastcgi-php.conf;
    fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
}
location ~ /\.(?!well-known).* {
    deny all;
}
```

Set PHP upload limits to match the booking form checks (`upload_max_filesize=2M`, `post_max_size=8M`) and reload PHP-FPM/Nginx after configuration changes. The Nginx request limit must be larger than PHP's POST limit to allow multipart overhead.

## Release behavior and rollback

After CI succeeds, Actions uploads a new release under `$DEPLOY_ROOT/releases/<commit-sha>`, preserves the VPS `.env` and shared storage, installs production Composer dependencies, runs migrations and cache commands, then atomically switches `$DEPLOY_ROOT/current`. It checks `https://api.rentivo.ph/up`; if that fails after the switch, it restores the prior code symlink. Database migrations are retained and are not rolled back automatically, so use backward-compatible migrations and restore from backup if a schema migration itself needs reversal.

Review the Actions run and test the public site, dashboard sign-in, API, mail delivery, uploads, customer document privacy, and scheduled cleanup after the first deployment.
