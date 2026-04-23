package manifests

import "testing"

func TestLoadDir(t *testing.T) {
	idx, err := LoadDir("../../testdata/runbooks")
	if err != nil {
		t.Fatalf("LoadDir returned error: %v", err)
	}

	if len(idx.ByID) != 1 {
		t.Fatalf("expected 1 manifest, got %d", len(idx.ByID))
	}

	if _, ok := idx.ByID["ssh.host_diagnose"]; !ok {
		t.Fatalf("expected ssh.host_diagnose to be loaded")
	}
}
