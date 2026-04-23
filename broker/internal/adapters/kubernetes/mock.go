package kubernetes

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
	ns := input["namespace"]
	if ns == "" {
		ns = "default"
	}
	workload := input["workload"]
	if workload == "" {
		workload = "sample-app"
	}

	result := map[string]any{
		"namespace": ns,
		"workload":  workload,
		"checks": []map[string]any{
			{"name": "rollout_status", "status": "ok", "value": "healthy"},
			{"name": "pod_count", "status": "ok", "value": "3/3 ready"},
			{"name": "recent_events", "status": "ok", "value": "no warning events"},
		},
	}

	logs := []string{
		fmt.Sprintf("[%s] mock k8s read-only check for %s/%s", time.Now().Format(time.RFC3339), ns, workload),
		"authorization: bearer token-example-value",
	}

	return result, logs, nil
}
