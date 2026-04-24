package kubernetes

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/models"
)

type fakeRunner struct {
	calls          []string
	failRolloutCmd bool
}

func (f *fakeRunner) Run(_ context.Context, name string, args []string) (string, string, error) {
	call := name + " " + strings.Join(args, " ")
	f.calls = append(f.calls, call)

	switch {
	case strings.Contains(call, "kube login"):
		return "login-ok", "", nil
	case strings.Contains(call, "rollout status"):
		if f.failRolloutCmd {
			return "", "error: deployment \"mock-web\" exceeded its progress deadline", errors.New("exit status 1")
		}
		return "deployment is successfully rolled out", "", nil
	case strings.Contains(call, "get pods"):
		return "checkout-123 Running", "", nil
	case strings.Contains(call, "get events"):
		return "no warning events", "", nil
	case strings.Contains(call, "logs deployment"):
		return "latest logs", "", nil
	default:
		return "", "", errors.New("unexpected command")
	}
}

func TestTeleportAdapterReleaseDiagnose(t *testing.T) {
	runner := &fakeRunner{}
	adapter, err := NewTeleport(config.TeleportConfig{
		Enabled:        true,
		TshPath:        "tsh",
		KubectlPath:    "kubectl",
		Proxy:          "example.teleport.sh:443",
		KubeCluster:    "dev-kube",
		LoginTTL:       "10m",
		LoginTimeout:   "30s",
		CommandTimeout: "20s",
	}, runner)
	if err != nil {
		t.Fatalf("NewTeleport error: %v", err)
	}

	manifest := models.RunbookManifest{ID: "k8s.release_diagnose", Kind: "k8s.release"}
	result, logs, err := adapter.Run(manifest, map[string]string{
		"namespace": "payments",
		"workload":  "checkout",
	})
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}

	if len(runner.calls) != 5 {
		t.Fatalf("expected 5 commands, got %d", len(runner.calls))
	}
	if !strings.Contains(runner.calls[0], "tsh --proxy=example.teleport.sh:443 kube login dev-kube") {
		t.Fatalf("first call should be tsh kube login, got %q", runner.calls[0])
	}

	if result["provider"] != "teleport" {
		t.Fatalf("expected provider teleport")
	}
	if len(logs) == 0 {
		t.Fatalf("expected execution logs")
	}
}

func TestTeleportAdapterReleaseDiagnoseDegradedWhenRolloutFails(t *testing.T) {
	runner := &fakeRunner{failRolloutCmd: true}
	adapter, err := NewTeleport(config.TeleportConfig{
		Enabled:        true,
		TshPath:        "tsh",
		KubectlPath:    "kubectl",
		Proxy:          "example.teleport.sh:443",
		KubeCluster:    "dev-kube",
		LoginTTL:       "15",
		LoginTimeout:   "30s",
		CommandTimeout: "20s",
	}, runner)
	if err != nil {
		t.Fatalf("NewTeleport error: %v", err)
	}

	manifest := models.RunbookManifest{ID: "k8s.release_diagnose", Kind: "k8s.release"}
	result, logs, err := adapter.Run(manifest, map[string]string{
		"namespace": "mock-app",
		"workload":  "mock-web",
	})
	if err != nil {
		t.Fatalf("Run should not hard-fail on rollout degradation: %v", err)
	}

	if result["overall_status"] != "degraded" {
		t.Fatalf("expected overall_status degraded, got %v", result["overall_status"])
	}

	checks, ok := result["checks"].([]map[string]any)
	if !ok {
		t.Fatalf("expected checks slice")
	}
	if len(checks) != 4 {
		t.Fatalf("expected 4 checks, got %d", len(checks))
	}
	if checks[0]["status"] != "failed" {
		t.Fatalf("expected rollout check to be failed, got %v", checks[0]["status"])
	}
	if len(logs) == 0 {
		t.Fatalf("expected logs")
	}
}
