#!/bin/sh
set -e
# Asegura que la carpeta de datos (montada desde el host) sea escribible por el usuario "node"
mkdir -p /app/data
chown -R node:node /app/data
exec su-exec node "$@"
