#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CLAUDE_VARIANTS_ROOT:-$HOME/.cc-mirror}"
INSTALL_BIN_DIR="${CLAUDE_VARIANTS_BIN_DIR:-$HOME/.local/bin}"

CLAUDE_ORIG="${CLAUDE_ORIG:-}"
if [[ -z "${CLAUDE_ORIG}" ]]; then
  if ! CLAUDE_ORIG="$(command -v claude 2>/dev/null)"; then
    echo "Error: 'claude' not found in PATH and CLAUDE_ORIG not set." >&2
    exit 1
  fi
fi

if [[ ! -x "${CLAUDE_ORIG}" ]]; then
  echo "Error: CLAUDE_ORIG is not executable: ${CLAUDE_ORIG}" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required to run tweakcc." >&2
  exit 1
fi

TWEAKCC_CMD=()
if [[ -x "./node_modules/.bin/tweakcc" ]]; then
  TWEAKCC_CMD=(./node_modules/.bin/tweakcc)
elif command -v tweakcc >/dev/null 2>&1; then
  TWEAKCC_CMD=(tweakcc)
else
  if ! command -v npx >/dev/null 2>&1; then
    echo "Error: npx not found; install tweakcc or ensure npm/npx is available." >&2
    exit 1
  fi
  TWEAKCC_CMD=(npx tweakcc@3.2.2)
fi

mkdir -p "${ROOT_DIR}" "${INSTALL_BIN_DIR}"

ZAI_DIR="${ROOT_DIR}/zai"
MINIMAX_DIR="${ROOT_DIR}/minimax"

ZAI_BIN="${ZAI_DIR}/claude"
MINIMAX_BIN="${MINIMAX_DIR}/claude"

ZAI_CONFIG_DIR="${ZAI_DIR}/config"
MINIMAX_CONFIG_DIR="${MINIMAX_DIR}/config"

ZAI_TWEAK_DIR="${ZAI_DIR}/tweakcc"
MINIMAX_TWEAK_DIR="${MINIMAX_DIR}/tweakcc"

ZAI_BASE_URL="${ZAI_BASE_URL:-https://api.z.ai/api/anthropic}"
MINIMAX_BASE_URL="${MINIMAX_BASE_URL:-https://api.minimax.io/anthropic}"

ZAI_API_KEY="${ZAI_API_KEY:-}"
MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"

ZAI_TIMEOUT_MS="${ZAI_API_TIMEOUT_MS:-3000000}"
MINIMAX_TIMEOUT_MS="${MINIMAX_API_TIMEOUT_MS:-3000000}"

ensure_key() {
  local name="$1"
  local value="$2"
  if [[ -z "${value}" ]]; then
    echo "<${name}>"
  else
    echo "${value}"
  fi
}

write_settings() {
  local config_dir="$1"
  local base_url="$2"
  local api_key="$3"
  local timeout_ms="$4"
  local provider="$5"

  mkdir -p "${config_dir}"

  if [[ "${provider}" == "zai" ]]; then
    cat > "${config_dir}/settings.json" <<JSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "${base_url}",
    "ANTHROPIC_API_KEY": "$(ensure_key ZAI_API_KEY "${api_key}")",
    "API_TIMEOUT_MS": "${timeout_ms}",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
  }
}
JSON
  elif [[ "${provider}" == "minimax" ]]; then
    cat > "${config_dir}/settings.json" <<JSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "${base_url}",
    "ANTHROPIC_API_KEY": "$(ensure_key MINIMAX_API_KEY "${api_key}")",
    "API_TIMEOUT_MS": "${timeout_ms}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1,
    "ANTHROPIC_MODEL": "MiniMax-M2.1",
    "ANTHROPIC_SMALL_FAST_MODEL": "MiniMax-M2.1",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "MiniMax-M2.1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "MiniMax-M2.1",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "MiniMax-M2.1"
  }
}
JSON
  else
    echo "Unknown provider: ${provider}" >&2
    exit 1
  fi
}

copy_binary() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "${dest}")"
  cp -f "${src}" "${dest}"
  chmod +x "${dest}"
}

apply_tweakcc() {
  local tweak_dir="$1"
  local bin_path="$2"
  TWEAKCC_CONFIG_DIR="${tweak_dir}" \
  TWEAKCC_CC_INSTALLATION_PATH="${bin_path}" \
    "${TWEAKCC_CMD[@]}" --apply
}

write_wrapper() {
  local name="$1"
  local bin_path="$2"
  local config_dir="$3"
  local wrapper_path="${INSTALL_BIN_DIR}/${name}"

  cat > "${wrapper_path}" <<SH
#!/usr/bin/env bash
set -euo pipefail
export CLAUDE_CONFIG_DIR="${config_dir}"
if command -v node >/dev/null 2>&1; then
  __cc_mirror_env_file="$(mktemp)"
  node - <<'NODE' > "$__cc_mirror_env_file" || true
const fs = require('fs');
const path = require('path');
const dir = process.env.CLAUDE_CONFIG_DIR;
if (!dir) process.exit(0);
const file = path.join(dir, 'settings.json');
const escape = (value) => "'" + String(value).replace(/'/g, "'\"'\"'") + "'";
try {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const env = data && typeof data === 'object' ? data.env : null;
    if (env && typeof env === 'object') {
      for (const [key, value] of Object.entries(env)) {
        if (!key) continue;
        process.stdout.write(\`export \${key}=\${escape(value)}\\n\`);
      }
    }
  }
} catch {}
NODE
  if [[ -s "$__cc_mirror_env_file" ]]; then
    # shellcheck disable=SC1090
    source "$__cc_mirror_env_file"
  fi
  rm -f "$__cc_mirror_env_file" || true
fi
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  unset ANTHROPIC_AUTH_TOKEN
fi
exec "${bin_path}" "\$@"
SH
  chmod +x "${wrapper_path}"
}

copy_binary "${CLAUDE_ORIG}" "${ZAI_BIN}"
copy_binary "${CLAUDE_ORIG}" "${MINIMAX_BIN}"

write_settings "${ZAI_CONFIG_DIR}" "${ZAI_BASE_URL}" "${ZAI_API_KEY}" "${ZAI_TIMEOUT_MS}" "zai"
write_settings "${MINIMAX_CONFIG_DIR}" "${MINIMAX_BASE_URL}" "${MINIMAX_API_KEY}" "${MINIMAX_TIMEOUT_MS}" "minimax"

apply_tweakcc "${ZAI_TWEAK_DIR}" "${ZAI_BIN}"
apply_tweakcc "${MINIMAX_TWEAK_DIR}" "${MINIMAX_BIN}"

write_wrapper "zai" "${ZAI_BIN}" "${ZAI_CONFIG_DIR}"
write_wrapper "minimax" "${MINIMAX_BIN}" "${MINIMAX_CONFIG_DIR}"

cat <<SUMMARY
Done.

Binaries:
  Z.ai:     ${ZAI_BIN}
  MiniMax:  ${MINIMAX_BIN}

Wrappers:
  ${INSTALL_BIN_DIR}/zai
  ${INSTALL_BIN_DIR}/minimax

Config dirs:
  Z.ai:     ${ZAI_CONFIG_DIR}
  MiniMax:  ${MINIMAX_CONFIG_DIR}

Notes:
  - If ZAI_API_KEY or MINIMAX_API_KEY were not set, placeholder values were written.
  - Update settings.json in each config dir with your real API keys if needed.
SUMMARY
