# Server bootstrap and daily deployment

The existing static-site setup remains in place. Before the first leaderboard
deployment, install Node.js 20+ with `npm` plus `curl`, then review and run the
bootstrap script from a repository checkout on the server:

```bash
sudo DEPLOY_USER=jewstd-deploy \
  API_ROOT=/opt/JewsTD/api \
  DATA_DIR=/var/lib/jewstd \
  SERVICE_NAME=jewstd-leaderboard.service \
  bash deploy/bootstrap.sh
```

The script is repeatable. It creates the API release and persistent data
directories, writes the API environment and systemd unit, enables the unit,
and grants the deploy user only the two `systemctl` commands used by CI. It
does not start the service before an API release exists and never deletes the
database.

Nginx cannot safely be rewritten without knowing the site's existing TLS and
server-block configuration. Manually merge
`nginx/jewstd-api-location.conf.example` into that block once, run
`nginx -t`, and reload Nginx. The API stays bound to loopback.

The production Environment may optionally set these GitHub Actions variables;
the listed values are defaults:

| Variable | Default |
| --- | --- |
| `API_DEPLOY_PATH` | `/opt/JewsTD/api` |
| `API_DATABASE_PATH` | `/var/lib/jewstd/leaderboard.sqlite` |
| `API_SERVICE_NAME` | `jewstd-leaderboard.service` |
| `API_HEALTH_URL` | `http://127.0.0.1:3001/api/health` |

The existing `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_PATH`,
`DEPLOY_SSH_PRIVATE_KEY` and `DEPLOY_KNOWN_HOSTS` names do not change.

On each `main` push, and when the manual deploy workflow is run for a selected
ref, Actions builds the frontend and server, transfers both artifacts, runs a
production dependency install and idempotent database migration in
`API_DEPLOY_PATH`, restarts the service, checks its loopback health URL over
SSH, then updates the frontend. `API_DATABASE_PATH` is outside both release
directories and is not an rsync target.

Both deploy jobs share the `production-deploy` concurrency group and never
cancel an in-progress deployment. Automatic and manual production releases
therefore run one at a time, including migration, service restart and frontend
rsync.
