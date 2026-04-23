# Adding Runbooks

## Manifest Format

Runbook files belong under `runbooks/` and committed starter files must be `*.example.yaml`.

Required fields:

- `id`
- `title`
- `kind`
- `description`
- `required_inputs`
- `optional_inputs`
- `access`
- `execution`
- `output`
- `redaction`

## Adapter Mapping

`kind` determines adapter selection by prefix:

- `ssh.*` -> `ssh` adapter
- `k8s.*` -> `k8s` adapter
- `application.*` -> `application` adapter

`execution.provider` selects implementation mode:

- `mock` for local deterministic testing
- `teleport` for Teleport-backed runtime credential retrieval (currently supported for `k8s.*`)

## Workflow

1. Add manifest as `.example.yaml`.
2. Add local copy via `make copy-examples`.
3. Ensure `access.mode: read_only`.
4. Implement adapter logic (or extend mock behavior).
5. Run `make validate-runbooks` and `make test`.
