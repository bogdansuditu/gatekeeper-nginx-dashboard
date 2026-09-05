#!/bin/sh
set -e

# Ensure data directories exist and have proper ownership for the unprivileged node user (UID 1000)
mkdir -p /data/cache/favicons /data/avatars
chown -R node:node /data

# Drop root privileges and execute application as user node
exec su-exec node "$@"
