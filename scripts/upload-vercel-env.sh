#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Upload app environment variables to the linked Vercel project.

Usage:
  scripts/upload-vercel-env.sh
  scripts/upload-vercel-env.sh --all
  scripts/upload-vercel-env.sh --keys OPENAI_API_KEY,NEXT_PUBLIC_SUPABASE_URL

Options:
  --production     Upload to Production. This is the default.
  --preview        Upload to Preview.
  --development    Upload to Development.
  --all            Upload to Production, Preview, and Development.
  --keys CSV       Only upload the comma-separated env keys listed.
  --help           Show this help text.

Values are read from your shell environment first. Missing values are prompted
with hidden input and blank answers are skipped.
EOF
}

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

default_keys=(
  OPENAI_API_KEY
  OPENAI_ADMIN_KEY
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_SECRET_KEY
  DATABASE_URL
)

targets=()
keys=("${default_keys[@]}")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --production)
      targets+=("production")
      ;;
    --preview)
      targets+=("preview")
      ;;
    --development)
      targets+=("development")
      ;;
    --all)
      targets=("production" "preview" "development")
      ;;
    --keys)
      if [[ $# -lt 2 ]]; then
        echo "--keys requires a comma-separated value" >&2
        exit 2
      fi
      IFS=',' read -r -a keys <<<"$2"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

if [[ ${#targets[@]} -eq 0 ]]; then
  targets=("production")
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI is missing. Install it with: npm install -g vercel" >&2
  exit 1
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "This checkout is not linked to a Vercel project. Run: vercel link" >&2
  exit 1
fi

read_secret() {
  local key="$1"
  local value="${!key:-}"

  if [[ -n "$value" ]]; then
    printf '%s' "$value"
    return
  fi

  if [[ ! -r /dev/tty ]]; then
    printf ''
    return
  fi

  read -r -s -p "Paste $key, or leave blank to skip: " value </dev/tty
  printf '\n' >/dev/tty
  printf '%s' "$value"
}

for key in "${keys[@]}"; do
  key="$(printf '%s' "$key" | xargs)"
  if [[ -z "$key" ]]; then
    continue
  fi

  value="$(read_secret "$key")"
  if [[ -z "$value" ]]; then
    echo "Skipped $key"
    continue
  fi

  for target in "${targets[@]}"; do
    args=(env add "$key" "$target" --force --yes)
    if [[ "$target" == "production" || "$target" == "preview" ]]; then
      args+=(--sensitive)
    fi

    printf '%s' "$value" | vercel "${args[@]}"
  done

  unset value
done

echo "Done. Redeploy Vercel for existing deployments to pick up changed values."
