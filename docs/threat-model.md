# Threat Model

## Primary Risks

- Arbitrary shell execution from model-generated commands.
- Prompt injection causing execution scope expansion.
- Credential leakage from static kubeconfig, SSH keys, API tokens.
- Over-permissioned access with no audit trail.

## Security Controls in This Template

- Manifest allowlist: broker executes only known runbook IDs.
- Typed inputs: user/model inputs are validated before execution.
- Read-only policy: manifests must set `access.mode: read_only`.
- Adapter abstraction: no direct shell pass-through from LLM.
- Redaction: common sensitive tokens are scrubbed from logs/results.
- Teleport integration model: identity and auditing move to access layer.

## Why Teleport Helps

- Short-lived identity and role-based access.
- Centralized policy and session visibility.
- Reduced need for long-lived static credentials.

## Residual Risks

- Misconfigured manifests can over-broaden read-only data access.
- Incomplete redaction patterns may miss sensitive output variants.
- Environment-specific adapter implementations must enforce least privilege.
