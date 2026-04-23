# Integrating with OpenClaw

## Plugin Contract

The plugin exports `createTeleClawPlugin()` and exposes:

- `list_runbooks`
- `run_runbook`
- `get_runbook_status`

Each tool returns:

- `summary`: concise human-readable status
- `data`: structured broker payload

## Install Steps

1. Build package:

```bash
cd openclaw-plugin
npm install
npm run build
```

2. Register `@teleclaw/openclaw-plugin` in your OpenClaw plugin runtime.
3. Set `TELECLAW_BROKER_URL` where OpenClaw launches plugin processes.

## Recommended Tooling Pattern

- Use `list_runbooks` for discovery.
- Use `run_runbook` with explicit `runbook_id` and typed `input` map.
- Poll `get_runbook_status` for execution state and summarized findings.
