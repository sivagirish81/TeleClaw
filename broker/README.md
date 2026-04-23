# TeleClaw Broker

The TeleClaw broker is the execution enforcement point.

## Responsibilities

- Load and validate allowlisted runbook manifests.
- Expose typed HTTP APIs for runbook listing and execution.
- Enforce read-only runbook policy.
- Route execution to pluggable adapter interfaces.
- Redact sensitive output patterns.
- Persist job state in a local JSON-backed store.
- Support provider-based adapters (for example `k8s` with `mock` or `teleport` execution provider).

## Endpoints

- `GET /healthz`
- `GET /v1/runbooks`
- `POST /v1/runbooks/execute`
- `GET /v1/jobs/{id}`
- `GET /v1/jobs/{id}/logs`

## Run Locally

```bash
cd broker
go run ./cmd/server
```

Configuration defaults can be overridden using `TELECLAW_BROKER_CONFIG`.
