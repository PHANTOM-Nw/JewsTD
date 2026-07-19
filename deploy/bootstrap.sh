#!/usr/bin/env bash
set -euo pipefail

# Run once as root after reviewing the defaults. Re-running is safe: managed
# files are regenerated from repository templates and data is never removed.
DEPLOY_USER="${DEPLOY_USER:-jewstd-deploy}"
API_ROOT="${API_ROOT:-/opt/JewsTD/api}"
DATA_DIR="${DATA_DIR:-/var/lib/jewstd}"
DATABASE_PATH="${DATABASE_PATH:-${DATA_DIR}/leaderboard.sqlite}"
SERVICE_NAME="${SERVICE_NAME:-jewstd-leaderboard.service}"
API_PORT="${API_PORT:-3001}"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'bootstrap.sh must run as root.' >&2
  exit 1
fi

if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "Deploy user ${DEPLOY_USER} does not exist." >&2
  exit 1
fi

if [[ ! "${DEPLOY_USER}" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'DEPLOY_USER contains unsupported characters.' >&2
  exit 1
fi
if [[ ! "${API_ROOT}" =~ ^/opt/JewsTD/[A-Za-z0-9_][A-Za-z0-9._-]*(/[A-Za-z0-9_][A-Za-z0-9._-]*)*/?$ ]]; then
  echo 'API_ROOT must be a safe directory below /opt/JewsTD/.' >&2
  exit 1
fi
if [[ ! "${DATA_DIR}" =~ ^/var/lib/[A-Za-z0-9_][A-Za-z0-9._-]*(/[A-Za-z0-9_][A-Za-z0-9._-]*)*/?$ ]]; then
  echo 'DATA_DIR must be a safe directory below /var/lib/.' >&2
  exit 1
fi
if [[ "${DATABASE_PATH}" != "${DATA_DIR}/"* ]] || [[ "${DATABASE_PATH}" == */ ]]; then
  echo 'DATABASE_PATH must be a file below DATA_DIR.' >&2
  exit 1
fi
if [[ ! "${SERVICE_NAME}" =~ ^[A-Za-z0-9_.@-]+\.service$ ]]; then
  echo 'SERVICE_NAME must be a valid systemd service name.' >&2
  exit 1
fi
if [[ ! "${API_PORT}" =~ ^[0-9]+$ ]] ||
  (( 10#${API_PORT} < 1 || 10#${API_PORT} > 65535 )); then
  echo 'API_PORT must be an integer from 1 to 65535.' >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMCTL_PATH="$(command -v systemctl)"
VISUDO_PATH="$(command -v visudo)"
NODE_PATH="$(command -v node)"

if ! "${NODE_PATH}" -e \
  "const major=Number(process.versions.node.split('.')[0]); process.exit(major >= 20 ? 0 : 1)"; then
  echo 'Node.js 20 or newer is required.' >&2
  exit 1
fi
command -v npm >/dev/null
command -v curl >/dev/null

install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" -m 0755 "${API_ROOT}"
install -d -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" -m 0750 "${DATA_DIR}"
install -d -o root -g root -m 0755 /etc/jewstd

ENV_FILE="$(mktemp)"
UNIT_FILE="$(mktemp)"
SUDOERS_FILE="$(mktemp)"
trap 'rm -f "${ENV_FILE}" "${UNIT_FILE}" "${SUDOERS_FILE}"' EXIT

{
  echo 'API_HOST=127.0.0.1'
  echo "API_PORT=${API_PORT}"
  echo "DATABASE_PATH=${DATABASE_PATH}"
  echo 'RUN_TTL_MS=86400000'
} > "${ENV_FILE}"
install -o root -g root -m 0644 "${ENV_FILE}" /etc/jewstd/leaderboard.env

sed \
  -e "s|__DEPLOY_USER__|${DEPLOY_USER}|g" \
  -e "s|__API_ROOT__|${API_ROOT}|g" \
  -e "s|__DATA_DIR__|${DATA_DIR}|g" \
  -e "s|__NODE_PATH__|${NODE_PATH}|g" \
  "${SCRIPT_DIR}/systemd/jewstd-leaderboard.service.example" > "${UNIT_FILE}"
install -o root -g root -m 0644 \
  "${UNIT_FILE}" "/etc/systemd/system/${SERVICE_NAME}"

{
  echo "${DEPLOY_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} restart ${SERVICE_NAME}"
  echo "${DEPLOY_USER} ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} is-active --quiet ${SERVICE_NAME}"
} > "${SUDOERS_FILE}"
"${VISUDO_PATH}" -cf "${SUDOERS_FILE}"
install -o root -g root -m 0440 \
  "${SUDOERS_FILE}" "/etc/sudoers.d/jewstd-leaderboard-deploy"

"${SYSTEMCTL_PATH}" daemon-reload
"${SYSTEMCTL_PATH}" enable "${SERVICE_NAME}"

echo "Prepared ${API_ROOT}, ${DATA_DIR}, ${SERVICE_NAME} and restricted restart permissions."
echo "Merge ${SCRIPT_DIR}/nginx/jewstd-api-location.conf.example into the existing Nginx server block, test Nginx, and reload it."
echo 'The daily deployment will install/migrate the API, restart the service and check /api/health.'
