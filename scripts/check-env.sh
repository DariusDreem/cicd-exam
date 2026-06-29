#!/bin/bash
set -e

required=("DATABASE_URL" "API_PASSWORD" "NODE_ENV")

for var in "${required[@]}"; do
  if [ -z "${!var}" ]; then
    echo "ERREUR : variable manquante -> $var"
    exit 1
  fi
done

echo "OK : toutes les variables sont definies"
