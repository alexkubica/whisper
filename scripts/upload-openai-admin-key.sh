#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Upload OPENAI_ADMIN_KEY to the linked Vercel project without putting it in shell history.

Usage:
  scripts/upload-openai-admin-key.sh
  scripts/upload-openai-admin-key.sh --preview
  scripts/upload-openai-admin-key.sh --all
  OPENAI_ADMIN_KEY="sk-admin-..." scripts/upload-openai-admin-key.sh --all

Options:
  --production     Upload to Production. This is the default.
  --preview        Upload to Preview.
  --development    Upload to Development.
  --all            Upload to Production, Preview, and Development.
  --help           Show this help text.

The script reads the key from OPENAI_ADMIN_KEY if set. Otherwise it prompts with
hidden input. The key is sent to `vercel env add` through stdin, not as a CLI
argument.
EOF
}

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

targets=()

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

admin_key="${OPENAI_ADMIN_KEY:-}"
if [[ -z "$admin_key" ]]; then
  if [[ ! -r /dev/tty ]]; then
    echo "OPENAI_ADMIN_KEY is not set and no terminal is available for hidden input." >&2
    exit 1
  fi

  read -r -s -p "Paste OPENAI_ADMIN_KEY: " admin_key </dev/tty
  printf '\n' >/dev/tty
fi

if [[ -z "$admin_key" ]]; then
  echo "OPENAI_ADMIN_KEY cannot be empty." >&2
  exit 1
fi

for target in "${targets[@]}"; do
  args=(env add OPENAI_ADMIN_KEY "$target" --force --yes)
  if [[ "$target" == "production" || "$target" == "preview" ]]; then
    args+=(--sensitive)
  fi

  printf '%s' "$admin_key" | vercel "${args[@]}"
done

unset admin_key

echo "Uploaded OPENAI_ADMIN_KEY to: ${targets[*]}"
echo "Redeploy Vercel for existing deployments to pick up the new environment variable."
