#!/usr/bin/env bash
# Deploy PartyJAM services to Clever Cloud.
#
# This script creates or links two Docker apps in this git repository:
#   - API app, built from apps/api/Dockerfile
#   - Essentia app, built from apps/essentia/Dockerfile
#
# Usage:
#   bash ./scripts/deploy-clever-cloud.sh
#
# Optional environment variables:
#   LOAD_DOTENV=0
#   CLEVER_ORG=my-org
#   CLEVER_REGION=par
#   API_APP_NAME=app-partyjam-api
#   ESSENTIA_APP_NAME=app-partyjam-essentia
#   API_ALIAS=api
#   ESSENTIA_ALIAS=essentia
#   API_PUBLIC_URL=https://your-real-api-domain.cleverapps.io
#   ESSENTIA_PUBLIC_URL=https://your-real-essentia-domain.cleverapps.io
#
# Required application secrets:
#   SUPABASE_URL
#   SUPABASE_ANON_KEY
#
# Optional application secrets:
#   OPENAI_API_KEY
#   LASTFM_API_KEY
#   SUPABASE_SERVICE_ROLE_KEY
#   PARTYJAM_MEDIA_ROOT
#   STREAM_BASE_URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

LOAD_DOTENV="${LOAD_DOTENV:-1}"
CLEVER_ORG="${CLEVER_ORG:-}"
CLEVER_REGION="${CLEVER_REGION:-par}"

API_APP_NAME="${API_APP_NAME:-app-partyjam-api}"
ESSENTIA_APP_NAME="${ESSENTIA_APP_NAME:-app-partyjam-essentia}"
API_ALIAS="${API_ALIAS:-api}"
ESSENTIA_ALIAS="${ESSENTIA_ALIAS:-essentia}"

API_PUBLIC_URL="${API_PUBLIC_URL:-}"
ESSENTIA_PUBLIC_URL="${ESSENTIA_PUBLIC_URL:-}"

OWNER_ARGS=()
if [[ -n "$CLEVER_ORG" ]]; then
  OWNER_ARGS=(--org "$CLEVER_ORG")
fi

log() {
  printf '==> %s\n' "$*"
}

note() {
  printf '    %s\n' "$*"
}

warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

load_dotenv() {
  if [[ "$LOAD_DOTENV" != "1" ]]; then
    return
  fi

  if [[ -f "$REPO_ROOT/.env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%$'\r'}"

      if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
        continue
      fi

      if [[ "$line" != *=* ]]; then
        continue
      fi

      local key="${line%%=*}"
      local value="${line#*=}"

      key="${key#export }"
      key="${key#"${key%%[![:space:]]*}"}"
      key="${key%"${key##*[![:space:]]}"}"
      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
        continue
      fi

      if [[ "$value" =~ ^\".*\"$ || "$value" =~ ^\'.*\'$ ]]; then
        value="${value:1:${#value}-2}"
      fi

      if [[ -z "${!key+x}" ]]; then
        export "$key=$value"
      fi
    done < "$REPO_ROOT/.env"

    note "Loaded variables from $REPO_ROOT/.env"
  fi
}

require_env() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Missing required environment variable: $name"
}

check_git_state() {
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "This script must run inside the git repository."
  git rev-parse --verify HEAD >/dev/null 2>&1 || die "This repository has no commit yet. Clever Cloud deploys git commits, so create one first."

  if [[ -n "$(git status --porcelain)" ]]; then
    warn "The git working tree has uncommitted changes."
    warn "Clever Cloud deploys the current commit, not your unstaged or uncommitted files."
  fi
}

alias_is_linked() {
  clever applications --only-aliases | tr -d '\r' | grep -Fxq "$1"
}

ensure_linked_app() {
  local alias="$1"
  local app_name="$2"
  local app_type="$3"

  if alias_is_linked "$alias"; then
    note "Alias '$alias' is already linked."
    return
  fi

  if clever link "$app_name" --alias "$alias" "${OWNER_ARGS[@]}" >/dev/null 2>&1; then
    note "Linked existing Clever Cloud app '$app_name' as alias '$alias'."
    return
  fi

  clever create --type "$app_type" --alias "$alias" --region "$CLEVER_REGION" "${OWNER_ARGS[@]}" "$app_name"
  note "Created Clever Cloud app '$app_name' and linked alias '$alias'."
}

resolve_app_url() {
  local app_name="$1"
  local domain

  domain="$(
    clever domain --app "$app_name" 2>/dev/null \
      | tr -d '\r' \
      | grep 'cleverapps.io' \
      | head -n 1 \
      | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s#/$##'
  )"

  [[ -n "$domain" ]] || die "Could not resolve a public cleverapps.io domain for app '$app_name'."

  if [[ "$domain" =~ ^https?:// ]]; then
    printf '%s\n' "$domain"
    return
  fi

  printf 'https://%s\n' "$domain"
}

set_env_var() {
  local app_name="$1"
  local name="$2"
  local value="$3"
  clever env set --app "$app_name" "$name" "$value"
}

set_optional_env_var() {
  local app_name="$1"
  local name="$2"
  if [[ -n "${!name:-}" ]]; then
    clever env set --app "$app_name" "$name" "${!name}"
  fi
}

configure_essentia_app() {
  log "Configuring Essentia app"
  set_env_var "$ESSENTIA_APP_NAME" CC_DOCKERFILE apps/essentia/Dockerfile
  set_env_var "$ESSENTIA_APP_NAME" CC_DOCKER_EXPOSED_HTTP_PORT 8000
  set_env_var "$ESSENTIA_APP_NAME" CC_HEALTH_CHECK_PATH /health
  set_env_var "$ESSENTIA_APP_NAME" PORT 8000
}

configure_api_app() {
  local effective_stream_base_url="${STREAM_BASE_URL:-$API_PUBLIC_URL}"
  local effective_vite_supabase_url="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
  local effective_vite_supabase_anon_key="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}"

  log "Configuring API app"
  set_env_var "$API_APP_NAME" CC_DOCKERFILE apps/api/Dockerfile
  set_env_var "$API_APP_NAME" CC_DOCKER_EXPOSED_HTTP_PORT 3000
  set_env_var "$API_APP_NAME" CC_HEALTH_CHECK_PATH /health
  set_env_var "$API_APP_NAME" PORT 3000
  set_env_var "$API_APP_NAME" NODE_ENV production
  set_env_var "$API_APP_NAME" BASE_URL "$API_PUBLIC_URL"
  set_env_var "$API_APP_NAME" STREAM_BASE_URL "$effective_stream_base_url"
  set_env_var "$API_APP_NAME" ESSENTIA_URL "$ESSENTIA_PUBLIC_URL"
  set_env_var "$API_APP_NAME" SUPABASE_URL "$SUPABASE_URL"
  set_env_var "$API_APP_NAME" SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
  set_env_var "$API_APP_NAME" VITE_API_URL "$API_PUBLIC_URL"
  set_env_var "$API_APP_NAME" VITE_SUPABASE_URL "$effective_vite_supabase_url"
  set_env_var "$API_APP_NAME" VITE_SUPABASE_ANON_KEY "$effective_vite_supabase_anon_key"

  set_optional_env_var "$API_APP_NAME" OPENAI_API_KEY
  set_optional_env_var "$API_APP_NAME" LASTFM_API_KEY
  set_optional_env_var "$API_APP_NAME" SUPABASE_SERVICE_ROLE_KEY
  set_optional_env_var "$API_APP_NAME" PARTYJAM_MEDIA_ROOT
}

deploy_alias() {
  local alias="$1"
  clever deploy --alias "$alias" --force --same-commit-policy rebuild
}

wait_for_health() {
  local name="$1"
  local base_url="$2"
  local attempts="${3:-20}"
  local sleep_seconds="${4:-15}"
  local url="${base_url%/}/health"

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      note "$name is healthy at $url"
      return
    fi

    note "Waiting for $name health check ($attempt/$attempts): $url"
    sleep "$sleep_seconds"
  done

  die "$name did not become healthy in time: $url"
}

main() {
  log "PartyJAM Clever Cloud deployment"

  require_command clever
  require_command git
  require_command curl

  load_dotenv
  check_git_state

  require_env SUPABASE_URL
  require_env SUPABASE_ANON_KEY

  ensure_linked_app "$ESSENTIA_ALIAS" "$ESSENTIA_APP_NAME" docker
  ensure_linked_app "$API_ALIAS" "$API_APP_NAME" docker

  if [[ -z "$ESSENTIA_PUBLIC_URL" ]]; then
    ESSENTIA_PUBLIC_URL="$(resolve_app_url "$ESSENTIA_APP_NAME")"
  fi
  if [[ -z "$API_PUBLIC_URL" ]]; then
    API_PUBLIC_URL="$(resolve_app_url "$API_APP_NAME")"
  fi

  note "Resolved API URL: $API_PUBLIC_URL"
  note "Resolved Essentia URL: $ESSENTIA_PUBLIC_URL"

  configure_essentia_app

  log "Deploying Essentia"
  deploy_alias "$ESSENTIA_ALIAS"
  wait_for_health "Essentia" "$ESSENTIA_PUBLIC_URL"

  configure_api_app

  log "Deploying API"
  deploy_alias "$API_ALIAS"
  wait_for_health "API" "$API_PUBLIC_URL"

  printf '\n'
  log "Deployment complete"
  note "API URL: $API_PUBLIC_URL"
  note "Essentia URL: $ESSENTIA_PUBLIC_URL"
  note "E2E check: API_BASE=$API_PUBLIC_URL ./scripts/e2e-test.sh"
}

main "$@"
