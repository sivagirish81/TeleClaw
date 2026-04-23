package runner

import (
	"fmt"
	"strings"

	"github.com/example/teleclaw/broker/internal/adapters/application"
	"github.com/example/teleclaw/broker/internal/adapters/kubernetes"
	"github.com/example/teleclaw/broker/internal/adapters/ssh"
	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/models"
)

type Adapter interface {
	Run(manifest models.RunbookManifest, input map[string]string) (map[string]any, []string, error)
}

type Runner struct {
	adapters map[string]Adapter
}

func NewDefaultRunner(cfg config.Config) *Runner {
	adapters := map[string]Adapter{
		"ssh:mock":         ssh.NewMock(),
		"k8s:mock":         kubernetes.NewMock(),
		"application:mock": application.NewMock(),
	}

	teleportK8s, err := kubernetes.NewTeleport(cfg.Teleport, kubernetes.ExecRunner{})
	if err == nil {
		adapters["k8s:teleport"] = teleportK8s
	}

	return &Runner{adapters: adapters}
}

func (r *Runner) Run(manifest models.RunbookManifest, input map[string]string) (map[string]any, []string, error) {
	prefix := adapterPrefix(manifest.Kind)
	provider := adapterProvider(manifest)
	key := adapterKey(prefix, provider)
	adapter, ok := r.adapters[key]
	if !ok && provider != "mock" {
		return nil, nil, fmt.Errorf("adapter %q unavailable for kind %q", provider, manifest.Kind)
	}
	if !ok {
		adapter, ok = r.adapters[adapterKey(prefix, "mock")]
	}
	if !ok {
		return nil, nil, fmt.Errorf("no adapter for kind %q", manifest.Kind)
	}
	return adapter.Run(manifest, input)
}

func adapterPrefix(kind string) string {
	parts := strings.SplitN(kind, ".", 2)
	if len(parts) == 0 {
		return kind
	}
	return parts[0]
}

func adapterProvider(manifest models.RunbookManifest) string {
	raw, ok := manifest.Execution["provider"]
	if !ok {
		return "mock"
	}
	provider, ok := raw.(string)
	if !ok || strings.TrimSpace(provider) == "" {
		return "mock"
	}
	return strings.ToLower(strings.TrimSpace(provider))
}

func adapterKey(prefix, provider string) string {
	return fmt.Sprintf("%s:%s", prefix, provider)
}
