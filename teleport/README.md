# Teleport Integration Scaffolding

This directory contains placeholder-safe example resources for wiring Teleport into TeleClaw.

## Included

- Example Teleport role resources (`roles/*.example.yaml`).
- Example Teleport service/client configs (`configs/*.example.yaml`).

## Guidance

- Replace placeholders with environment-specific values in local, untracked copies.
- Keep real credentials out of source control.
- Use Teleport roles to enforce least privilege for read-only diagnostics.

## Suggested Next Steps

1. Connect hosts and clusters to Teleport Cloud or self-hosted cluster.
2. Protect OpenClaw UI with Teleport Application Access.
3. Evolve broker adapters to use Teleport-issued credentials and workload identity.
