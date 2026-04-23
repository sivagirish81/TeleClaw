# Quickstart

## Prerequisites

- Go 1.23+
- Node.js 22+
- npm 10+

## Install Dependencies

```bash
make setup
```

## Materialize Local Files from Examples

```bash
make copy-examples
```

## Start Broker

```bash
make broker
```

## Start Plugin (dev mode)

```bash
make plugin
```

## Validate Setup

```bash
curl http://127.0.0.1:8080/healthz
make validate-runbooks
```
