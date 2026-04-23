package ssh

import (
	"fmt"
	"time"

	"github.com/example/teleclaw/broker/internal/models"
)

type Mock struct{}

func NewMock() *Mock {
	return &Mock{}
}

func (m *Mock) Run(manifest models.RunbookManifest, input map[string]string) (map[string]any, []string, error) {
	host := input["host"]
	if host == "" {
		host = "placeholder-host"
	}

	result := map[string]any{
		"target": host,
		"checks": []map[string]any{
			{"name": "hostname", "status": "ok", "value": host},
			{"name": "uptime", "status": "ok", "value": "3d12h"},
			{"name": "disk_usage", "status": "ok", "value": "58%"},
			{"name": "memory_usage", "status": "ok", "value": "62%"},
		},
	}

	logs := []string{
		fmt.Sprintf("[%s] mock ssh read-only diagnostics for %s", time.Now().Format(time.RFC3339), host),
		"password=supersecret-example", // demonstrates redaction
	}

	return result, logs, nil
}
