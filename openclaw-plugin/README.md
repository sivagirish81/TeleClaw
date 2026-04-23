# TeleClaw OpenClaw Plugin

TypeScript plugin that exposes TeleClaw tools for OpenClaw.

## Tools

- `list_runbooks`
- `run_runbook`
- `get_runbook_status`

## Installation (template guidance)

1. Install dependencies:

```bash
cd openclaw-plugin
npm install
npm run build
```

2. Register plugin package in your OpenClaw runtime/plugin config.
3. Configure broker URL (`TELECLAW_BROKER_URL`) in plugin environment.

Because OpenClaw deployment patterns differ by team, this template keeps registration generic and focuses on plugin runtime contract.

## Local Development

```bash
npm run dev
```

## Safety Notes

- Plugin chooses runbook IDs, not raw infrastructure commands.
- Broker remains the execution enforcement point.
- No static credentials are stored in this package.
