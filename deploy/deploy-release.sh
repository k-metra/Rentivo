#!/usr/bin/env bash
set -Eeuo pipefail

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
SHARED_DIR="$DEPLOY_ROOT/shared"
CURRENT_LINK="$DEPLOY_ROOT/current"

test -d "$BACKEND_DIR"
test -d "$RELEASE_DIR/frontend"
test -f "$SHARED_DIR/.env" || {
    echo "Missing production environment file: $SHARED_DIR/.env" >&2
    exit 1
}

mkdir -p \
    "$SHARED_DIR/storage/app/public" \
    "$SHARED_DIR/storage/app/private" \
    "$SHARED_DIR/storage/framework/cache/data" \
    "$SHARED_DIR/storage/framework/sessions" \
    "$SHARED_DIR/storage/framework/views" \
    "$SHARED_DIR/storage/logs" \
    "$BACKEND_DIR/bootstrap/cache"

ln -sfn "$SHARED_DIR/.env" "$BACKEND_DIR/.env"
rm -rf "$BACKEND_DIR/storage"
ln -s "$SHARED_DIR/storage" "$BACKEND_DIR/storage"

cd "$BACKEND_DIR"
composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader
php artisan optimize:clear
php artisan storage:link
php artisan migrate --force
php artisan config:cache
php artisan view:cache

PREVIOUS_RELEASE=""
if [[ -L "$CURRENT_LINK" ]]; then
    PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" || true)"
elif [[ -e "$CURRENT_LINK" ]]; then
    echo "Refusing to replace non-symlink deployment path: $CURRENT_LINK" >&2
    exit 1
fi

NEXT_LINK="$DEPLOY_ROOT/.current-$RELEASE_ID"
ln -sfn "$RELEASE_DIR" "$NEXT_LINK"
mv -Tf "$NEXT_LINK" "$CURRENT_LINK"

php artisan queue:restart

if ! curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 \
    https://api.rentivo.ph/up >/dev/null; then
    echo "API health check failed; restoring the previous release." >&2
    if [[ -n "$PREVIOUS_RELEASE" ]]; then
        ln -sfn "$PREVIOUS_RELEASE" "$NEXT_LINK"
        mv -Tf "$NEXT_LINK" "$CURRENT_LINK"
    else
        rm -f "$CURRENT_LINK"
    fi
    exit 1
fi

echo "Activated release $RELEASE_ID."
