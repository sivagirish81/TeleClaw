# TeleClaw OpenClaw Plugin

TypeScript plugin that exposes TeleClaw tools for OpenClaw.

## Tools

- `teleclaw_list_runbooks`
- `teleclaw_run_runbook`
- `teleclaw_get_runbook_status`
- `teleclaw_ping` (debug canary)

## Installation

```bash
cd openclaw-plugin
npm install
npm run build
openclaw plugins install ~/TeleClaw/openclaw-plugin --force
```

## Plugin Config

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

## Local Development

```bash
npm run dev
```

## Safety Notes

- Plugin chooses runbook IDs, not raw infrastructure commands.
- Broker remains the execution enforcement point.
- No static credentials are stored in this package.
