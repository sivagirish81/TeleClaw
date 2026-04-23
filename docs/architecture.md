# TeleClaw Architecture

## System Design

TeleClaw splits operator intent from execution authority.

- OpenClaw handles interaction and tool selection.
- TeleClaw plugin translates tool calls into typed broker API requests.
- Broker loads allowlisted runbook manifests and validates inputs.
- Runner dispatches to adapter interfaces (`ssh`, `k8s`, `application`).
- Adapters execute read-only diagnostics through environment-specific access paths.
- Results are redacted, summarized, persisted, and returned.

## Trust Boundaries

1. User/Engineer boundary:
   - Input is untrusted; requests are treated as intent only.
2. OpenClaw runtime boundary:
   - Plugin never executes arbitrary shell; it only calls broker APIs.
3. Broker boundary:
   - Policy enforcement point for runbook allowlist and input validation.
4. Infrastructure boundary:
   - Adapters use Teleport-authenticated identity instead of static credentials.

## Data Flow

1. `list_runbooks` -> `GET /v1/runbooks`.
2. `run_runbook` -> `POST /v1/runbooks/execute` with `{runbook_id, input}`.
3. Broker validates manifest + required inputs.
4. Broker dispatches to adapter by `kind` prefix.
5. Adapter returns structured findings + logs.
6. Broker redacts sensitive values, computes summary, stores job, returns job response.
7. `get_runbook_status` -> `GET /v1/jobs/{id}` and optional logs endpoint.

## Extensibility

- Add new runbook kinds without changing API contract.
- Replace mock adapters with Teleport-aware implementations.
- Switch JSON store to SQLite without changing API handlers.
