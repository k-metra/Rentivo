#!/usr/bin/env bash

set -Eeuo pipefail

# --------------------------------------------------
# Configuration
# --------------------------------------------------

DEPLOY_ROOT="${1:?Deployment root is required}"
RELEASE_ID="${2:?Release ID is required}"

if [[ ! "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ || "$DEPLOY_ROOT" == "/" ]]; then
    echo "DEPLOY_ROOT must be an absolute path without spaces." >&2
    exit 2
fi

if [[ ! "$RELEASE_ID" =~ ^[a-f0-9]{40}$ ]]; then
    echo "Release ID must be a full Git commit SHA." >&2
    exit 2
fi

RELEASE_DIR="$DEPLOY_ROOT/releases/$RELEASE_ID"
BACKEND_DIR="$RELEASE_DIR/backend"
FRONTEND_DIR="$RELEASE_DIR/frontend"

SHARED_DIR="$DEPLOY_ROOT/shared"
SHARED_STORAGE="$SHARED_DIR/storage"
CURRENT_LINK="$DEPLOY_ROOT/current"
NEXT_LINK="$DEPLOY_ROOT/.current-$RELEASE_ID"

HEALTH_URL="https://api.rentivo.ph/up"

# --------------------------------------------------
# Prevent concurrent deployments
# --------------------------------------------------

exec 9>"$DEPLOY_ROOT/.deploy.lock"

if ! flock -n 9; then
    echo "Another Rentivo deployment is already running." >&2
    exit 1
fi

# --------------------------------------------------
# Validate release
# --------------------------------------------------

if [[ ! -d "$BACKEND_DIR" ]]; then
    echo "Backend release directory does not exist: $BACKEND_DIR" >&2
    exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
    echo "Frontend release directory does not exist: $FRONTEND_DIR" >&2
    exit 1
fi

if [[ ! -f "$SHARED_DIR/.env" ]]; then
    echo "Missing production environment file: $SHARED_DIR/.env" >&2
    exit 1
fi

# --------------------------------------------------
# Prepare shared storage
# --------------------------------------------------

mkdir -p \
    "$SHARED_STORAGE/app/public" \
    "$SHARED_STORAGE/app/private" \
    "$SHARED_STORAGE/framework/cache/data" \
    "$SHARED_STORAGE/framework/sessions" \
    "$SHARED_STORAGE/framework/views" \
    "$SHARED_STORAGE/logs" \
    "$BACKEND_DIR/bootstrap/cache"

# Connect this release to the persistent environment and storage.
ln -sfn "$SHARED_DIR/.env" "$BACKEND_DIR/.env"

rm -rf "$BACKEND_DIR/storage"
ln -s "$SHARED_STORAGE" "$BACKEND_DIR/storage"

# Point public storage directly to persistent storage so it remains valid
# even after older release directories are removed.
ln -sfn "$SHARED_STORAGE/app/public" "$BACKEND_DIR/public/storage"

# --------------------------------------------------
# Install production dependencies
# --------------------------------------------------

cd "$BACKEND_DIR"

echo "Installing production Composer dependencies..."

composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader

# --------------------------------------------------
# Run database migrations
# --------------------------------------------------

# Database-backed cache/session/queue tables may be created by migrations.
# Run migrations before clearing the configured cache store.
echo "Running database migrations..."
php artisan migrate --force

# --------------------------------------------------
# Prepare Laravel caches
# --------------------------------------------------

echo "Clearing Laravel caches..."
php artisan optimize:clear

echo "Caching application configuration..."
php artisan config:cache

echo "Caching application views..."
php artisan view:cache

# --------------------------------------------------
# Identify previous release
# --------------------------------------------------

PREVIOUS_RELEASE=""

if [[ -L "$CURRENT_LINK" ]]; then
    PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"
elif [[ -e "$CURRENT_LINK" ]]; then
    echo "Refusing to replace non-symlink deployment path: $CURRENT_LINK" >&2
    exit 1
fi

# --------------------------------------------------
# Activate new release
# --------------------------------------------------

echo "Activating release $RELEASE_ID..."

ln -sfn "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

# --------------------------------------------------
# Health check (bypass Cloudflare and test the VPS origin)
# --------------------------------------------------

echo "Checking API health directly against the VPS..."

if ! curl \
    --resolve api.rentivo.ph:443:127.0.0.1 \
    --fail \
    --silent \
    --show-error \
    --retry 5 \
    --retry-connrefused \
    --retry-delay 2 \
    --max-time 10 \
    "$HEALTH_URL" >/dev/null; then

    echo "API health check failed." >&2
    echo "Attempting to restore the previous release..." >&2

    if [[ -n "$PREVIOUS_RELEASE" ]]; then
        ln -sfn "$PREVIOUS_RELEASE" "$NEXT_LINK"
        mv -Tf "$NEXT_LINK" "$CURRENT_LINK"
        echo "Previous release restored: $PREVIOUS_RELEASE"
    else
        rm -f "$CURRENT_LINK"
        echo "No previous release was available. Current link removed." >&2
    fi

    exit 1
fi

echo "API health check passed."

# --------------------------------------------------
# Restart queue workers
# --------------------------------------------------

echo "Requesting queue worker restart..."

if ! php artisan queue:restart; then
    echo "WARNING: Queue restart command failed." >&2
    echo "The deployment remains active, but queue workers may need attention." >&2
fi

# --------------------------------------------------
# Deployment complete
# --------------------------------------------------

echo "------------------------------------------"
echo "Rentivo deployment successful!"
echo "Release: $RELEASE_ID"
echo "Path:    $RELEASE_DIR"
echo "------------------------------------------"