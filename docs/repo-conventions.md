# Repository Conventions

## `.example` Strategy

This repository is a public-safe template. Any committed starter config, runbook, or env file must be `.example`.

Examples:

- `.env.example` committed, `.env` ignored
- `broker/configs/broker.example.yaml` committed, `broker/configs/broker.yaml` ignored
- `runbooks/ssh/host_diagnose.example.yaml` committed, `runbooks/ssh/host_diagnose.yaml` ignored

## Why Real Files Are Ignored

- Prevent accidental secret commits.
- Keep environment-specific values local.
- Preserve reusable template defaults in source control.

## Required Checks

- `scripts/copy-examples.sh`: materialize local files.
- `scripts/validate-runbooks.sh`: validate manifest shape and naming.
- `scripts/check-template-conventions.sh`: fail on tracked non-example config/runbook files.
