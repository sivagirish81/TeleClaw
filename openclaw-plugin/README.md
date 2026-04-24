# TeleClaw OpenClaw Plugin

TypeScript plugin that exposes TeleClaw tools for OpenClaw.

## Tools

- `teleclaw_list_runbooks`
- `teleclaw_run_runbook`
- `teleclaw_get_runbook_status`

## Installation (template guidance)

1. Install dependencies:

```bash
cd openclaw-plugin
npm install
npm run build
```

2. Register plugin package in your OpenClaw runtime/plugin config.
3. Configure broker URL via plugin config (recommended) or `TELECLAW_BROKER_URL`.

Example OpenClaw plugin config:

```json
{
  "plugins": {
    "entries": {
      "@teleclaw/openclaw-plugin": {
        "enabled": true,
        "config": {
          "brokerUrl": "http://127.0.0.1:8080"
        }
      }
    }
  }
}
```

Because OpenClaw deployment patterns differ by team, this template keeps registration generic and focuses on plugin runtime contract.

## Local Development

```bash
npm run dev
```

## Safety Notes

- Plugin chooses runbook IDs, not raw infrastructure commands.
- Broker remains the execution enforcement point.
- No static credentials are stored in this package.
