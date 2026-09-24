# shared

**Owns:** runtime helpers used by every project, imported as `from shared
import auth` and `from shared.db import ...`.

**Interfaces:**
- `db._sql_http_path()`, `db._sql_connect_kwargs()`, `db._IDENTIFIER_PART_RE`:
  Databricks SQL connection built from environment only (App service
  principal, PAT, or local CLI profile).
- `auth.authorized(project_key)`: project gate (Kelly, Cortana, Galileo,
  Laplace).
- `auth.is_authorized(warehouse_id)`: Kelly plant-scope gate.
- `auth.get_current_email()`, `auth.get_user_projects(email)`: used by
  `/api/my-access`.

**Constraints:**
- Fail closed once deployed: a missing identity or a failed lookup denies.
  Only a local run without Databricks App variables allows everything, and
  `KELLY_DEV_USER_EMAIL` is ignored once deployed.
- Identity comes only from the proxy headers (`X-Forwarded-Email`, ...).
- Table names from the environment are validated and backtick-quoted; values
  go through bound query parameters.
- Grant lookups use short timeouts and TTL caches (`KELLY_AUTH_TTL_S`,
  `GLI_AUTH_SQL_*`). During an outage the last good grant is served; a failed
  lookup is cached for 30 s only.

**Env:** `GLI_ACCESS_TABLE`, `DATABRICKS_WAREHOUSE_ID` or `KELLY_SQL_HTTP_PATH`,
`DATABRICKS_CONFIG_PROFILE` (local only).
