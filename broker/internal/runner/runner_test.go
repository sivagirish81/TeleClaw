package runner

import (
	"strings"
	"testing"

	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/models"
)

func TestTeleportProviderUnavailableWhenDisabled(t *testing.T) {
	r := NewDefaultRunner(config.Config{})
	manifest := models.RunbookManifest{
		ID:   "k8s.release_diagnose",
		Kind: "k8s.release",
		Execution: map[string]any{
			"provider": "teleport",
		},
	}

	_, _, err := r.Run(manifest, map[string]string{"namespace": "payments", "workload": "checkout"})
	if err == nil {
		t.Fatalf("expected error")
	}
	if !strings.Contains(err.Error(), "unavailable") {
		t.Fatalf("expected unavailable error, got %v", err)
	}
}
