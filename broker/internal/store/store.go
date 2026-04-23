package store

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/example/teleclaw/broker/internal/models"
)

type JobStore interface {
	Put(job models.Job) error
	Get(id string) (models.Job, bool)
	List() []models.Job
}

type JSONStore struct {
	mu    sync.RWMutex
	path  string
	jobs  map[string]models.Job
	order []string
}

func NewJSONStore(path string) (*JSONStore, error) {
	s := &JSONStore{path: path, jobs: map[string]models.Job{}, order: []string{}}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *JSONStore) Put(job models.Job) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.jobs[job.ID]; !exists {
		s.order = append(s.order, job.ID)
	}
	s.jobs[job.ID] = job
	return s.persist()
}

func (s *JSONStore) Get(id string) (models.Job, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	job, ok := s.jobs[id]
	return job, ok
}

func (s *JSONStore) List() []models.Job {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]models.Job, 0, len(s.order))
	for _, id := range s.order {
		out = append(out, s.jobs[id])
	}
	return out
}

func (s *JSONStore) load() error {
	if _, err := os.Stat(s.path); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("stat store: %w", err)
	}

	data, err := os.ReadFile(s.path)
	if err != nil {
		return fmt.Errorf("read store: %w", err)
	}

	var jobs []models.Job
	if err := json.Unmarshal(data, &jobs); err != nil {
		return fmt.Errorf("parse store: %w", err)
	}

	for _, job := range jobs {
		s.jobs[job.ID] = job
		s.order = append(s.order, job.ID)
	}
	return nil
}

func (s *JSONStore) persist() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("create store dir: %w", err)
	}

	jobs := make([]models.Job, 0, len(s.order))
	for _, id := range s.order {
		jobs = append(jobs, s.jobs[id])
	}

	data, err := json.MarshalIndent(jobs, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal store: %w", err)
	}

	if err := os.WriteFile(s.path, data, 0o644); err != nil {
		return fmt.Errorf("write store: %w", err)
	}
	return nil
}
