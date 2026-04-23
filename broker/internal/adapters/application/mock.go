package application

import "github.com/example/teleclaw/broker/internal/models"

type Mock struct{}

func NewMock() *Mock {
	return &Mock{}
}

func (m *Mock) Run(_ models.RunbookManifest, _ map[string]string) (map[string]any, []string, error) {
	return map[string]any{"checks": []map[string]any{{"name": "application_probe", "status": "ok"}}}, []string{"application adapter mock run"}, nil
}
