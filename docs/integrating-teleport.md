# Integrating Teleport

## Teleport Role in TeleClaw

Teleport is the identity and access control plane for infrastructure access paths used by broker adapters.

- Do not place static kubeconfigs, SSH keys, or API tokens in plugin runtime.
- Use Teleport roles and short-lived credentials.
- Keep policy, auditability, and identity centralized in Teleport.

## Integration Paths

1. Host diagnostics via Teleport SSH access.
2. Kubernetes diagnostics via Teleport Kubernetes access.
3. OpenClaw UI protection via Teleport Application Access.
4. Future workload identity automation via `tbot`.

## What You Must Customize

- Teleport cluster name / proxy endpoint.
- Role mappings and labels for your environments.
- Adapter execution internals (how runner calls Teleport-aware clients).
- CI/CD and runtime identity bootstrap for broker host.

See `teleport/configs/*.example.yaml` and `teleport/roles/*.example.yaml` as placeholders.

## TeleClaw Teleport Execution Mode

The broker now supports a Teleport-backed Kubernetes adapter path for real read-only runs:

1. Configure `broker/configs/broker.yaml`:
   - `teleport.enabled: true`
   - `teleport.proxy`
   - `teleport.kube_cluster`
2. In your local runbook copy (not the `.example` file), set:
   - `execution.provider: teleport`
3. On each runbook execution, broker calls `tsh kube login` to obtain short-lived access, then runs read-only `kubectl` diagnostics.

This keeps runbook calls typed/allowlisted and avoids static kubeconfig material in plugin runtime.
