# Local Development

## Local-Only Mode

This template ships with mock adapters for `ssh`, `k8s`, and `application`.

- No live Teleport credentials are required to run local tests.
- No real infrastructure commands are executed.
- Responses are deterministic enough for integration scaffolding.
- Kubernetes runbooks default to `execution.provider: mock` in committed examples.

## Recommended Workflow

1. `make copy-examples`
2. `make broker`
3. `make plugin`
4. `make test`

## Data Persistence

By default, jobs are stored in JSON (`tmp/jobs.json`) through broker config.
