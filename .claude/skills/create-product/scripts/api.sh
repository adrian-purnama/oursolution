#!/usr/bin/env bash
# Calls the Fedier admin API as the admin whose token is in admin.env.local.
#
#   scripts/api.sh GET    /admin/products
#   scripts/api.sh POST   /admin/products/deployment/check  draft.json
#   scripts/api.sh POST   /admin/products                   product.json
#   scripts/api.sh PATCH  /admin/products/<id>              patch.json
#   scripts/api.sh UPLOAD /admin/products/<id>/images       cover.png
#
# Prints the JSON response ({ success, message, data }) and exits 1 when
# success is not true.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
config="$here/admin.env.local"
if [[ -f "$config" ]]; then
  # shellcheck disable=SC1090
  source "$config"
fi

: "${FEDIER_API_URL:?Set FEDIER_API_URL in $config (e.g. http://localhost:8000)}"
: "${FEDIER_ADMIN_JWT:?Set FEDIER_ADMIN_JWT in $config (the auth_token of an admin session)}"

method="${1:?method}"
path="${2:?path}"
body="${3:-}"
url="${FEDIER_API_URL%/}$path"
auth="Authorization: Bearer $FEDIER_ADMIN_JWT"

if [[ "$method" == "UPLOAD" ]]; then
  [[ -f "$body" ]] || { echo "No such file: $body" >&2; exit 2; }
  response="$(curl -sS -X POST "$url" -H "$auth" -F "file=@$body")"
elif [[ -n "$body" ]]; then
  [[ -f "$body" ]] || { echo "No such file: $body" >&2; exit 2; }
  response="$(curl -sS -X "$method" "$url" -H "$auth" \
    -H "Content-Type: application/json" --data-binary "@$body")"
else
  response="$(curl -sS -X "$method" "$url" -H "$auth")"
fi

echo "$response"
case "$response" in
  *'"success":true'*) exit 0 ;;
  *) exit 1 ;;
esac
