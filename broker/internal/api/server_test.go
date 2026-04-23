package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/manifests"
	"github.com/example/teleclaw/broker/internal/runner"
	"github.com/example/teleclaw/broker/internal/store"
)

func TestExecuteValidatesRequiredInput(t *testing.T) {
	idx, err := manifests.LoadDir("../../testdata/runbooks")
	if err != nil {
		t.Fatalf("LoadDir: %v", err)
	}

	st, err := store.NewJSONStore(t.TempDir() + "/jobs.json")
	if err != nil {
		t.Fatalf("NewJSONStore: %v", err)
	}

	srv := NewServer(config.Config{}, idx, st, runner.NewDefaultRunner(config.Config{}))
	handler := srv.Routes()

	payload := map[string]any{
		"runbook_id": "ssh.host_diagnose",
		"input":      map[string]string{},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/v1/runbooks/execute", bytes.NewReader(body))
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", res.Code)
	}
}
