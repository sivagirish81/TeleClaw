package manifests

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/example/teleclaw/broker/internal/models"
	"gopkg.in/yaml.v3"
)

type Index struct {
	ByID map[string]models.RunbookManifest
}

func LoadDir(root string) (Index, error) {
	idx := Index{ByID: map[string]models.RunbookManifest{}}

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			return nil
		}
		if !isYAML(path) {
			return nil
		}
		if shouldSkipExample(path) {
			return nil
		}

		manifest, err := loadManifest(path)
		if err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		if err := validateManifest(manifest); err != nil {
			return fmt.Errorf("%s: %w", path, err)
		}
		if _, exists := idx.ByID[manifest.ID]; exists {
			return fmt.Errorf("duplicate runbook id: %s", manifest.ID)
		}

		idx.ByID[manifest.ID] = manifest
		return nil
	})
	if err != nil {
		return Index{}, err
	}

	return idx, nil
}

func loadManifest(path string) (models.RunbookManifest, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return models.RunbookManifest{}, fmt.Errorf("read: %w", err)
	}

	var m models.RunbookManifest
	if err := yaml.Unmarshal(data, &m); err != nil {
		return models.RunbookManifest{}, fmt.Errorf("yaml parse: %w", err)
	}
	return m, nil
}

func validateManifest(m models.RunbookManifest) error {
	if m.ID == "" {
		return fmt.Errorf("missing id")
	}
	if m.Title == "" {
		return fmt.Errorf("missing title")
	}
	if m.Kind == "" {
		return fmt.Errorf("missing kind")
	}
	if m.Description == "" {
		return fmt.Errorf("missing description")
	}
	mode, _ := m.Access["mode"].(string)
	if mode != "read_only" {
		return fmt.Errorf("access.mode must be read_only")
	}
	return nil
}

func isYAML(path string) bool {
	lower := strings.ToLower(path)
	return strings.HasSuffix(lower, ".yaml") || strings.HasSuffix(lower, ".yml")
}

func shouldSkipExample(path string) bool {
	if strings.HasSuffix(path, ".example.yaml") {
		local := strings.TrimSuffix(path, ".example.yaml") + ".yaml"
		_, err := os.Stat(local)
		return err == nil
	}
	if strings.HasSuffix(path, ".example.yml") {
		local := strings.TrimSuffix(path, ".example.yml") + ".yml"
		_, err := os.Stat(local)
		return err == nil
	}
	return false
}
