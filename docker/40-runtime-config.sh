#!/bin/sh
set -eu

envsubst '${VITE_SUPABASE_URL} ${VITE_SUPABASE_ANON_KEY}' \
  < /etc/nginx/templates/runtime-config.js.template \
  > /usr/share/nginx/html/runtime-config.js
