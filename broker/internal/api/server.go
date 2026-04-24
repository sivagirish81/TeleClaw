package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/manifests"
	"github.com/example/teleclaw/broker/internal/models"
	"github.com/example/teleclaw/broker/internal/redaction"
	"github.com/example/teleclaw/broker/internal/runner"
	"github.com/example/teleclaw/broker/internal/store"
	"github.com/example/teleclaw/broker/internal/summary"
)

type Server struct {
	cfg       config.Config
	manifests manifests.Index
	store     store.JobStore
	runner    *runner.Runner
}

func NewServer(cfg config.Config, manifests manifests.Index, store store.JobStore, runner *runner.Runner) *Server {
	return &Server{cfg: cfg, manifests: manifests, store: store, runner: runner}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/v1/runbooks", s.handleRunbooks)
	mux.HandleFunc("/v1/runbooks/execute", s.handleRunbookExecute)
	mux.HandleFunc("/v1/jobs/", s.handleJobs)
	return s.logRequests(mux)
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (s *Server) handleRunbooks(w http.ResponseWriter, _ *http.Request) {
	items := make([]models.RunbookManifest, 0, len(s.manifests.ByID))
	for _, m := range s.manifests.ByID {
		items = append(items, m)
	}
	writeJSON(w, http.StatusOK, map[string]any{"runbooks": items})
}

func (s *Server) handleRunbookExecute(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}

	var req models.ExecuteRunbookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("teleclaw broker: invalid execute payload: %v", err)
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid JSON payload"})
		return
	}
	log.Printf("teleclaw broker: execute requested runbook_id=%s input_keys=%v", req.RunbookID, mapKeys(req.Input))
	manifest, ok := s.manifests.ByID[req.RunbookID]
	if !ok {
		log.Printf("teleclaw broker: unknown runbook_id=%s", req.RunbookID)
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "unknown runbook_id"})
		return
	}

	missing := missingInputs(manifest.RequiredInputs, req.Input)
	if len(missing) > 0 {
		log.Printf("teleclaw broker: missing required inputs runbook_id=%s missing=%v", req.RunbookID, missing)
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "missing required input", "missing": missing})
		return
	}

	job := models.Job{
		ID:        newJobID(),
		RunbookID: req.RunbookID,
		Input:     req.Input,
		Status:    models.JobRunning,
		StartedAt: time.Now().UTC(),
		Logs:      []string{},
	}
	_ = s.store.Put(job)
	log.Printf("teleclaw broker: job started job_id=%s runbook_id=%s", job.ID, job.RunbookID)

	result, logs, err := s.runner.Run(manifest, req.Input)
	logs = redaction.Logs(logs)
	job.Logs = logs
	if err != nil {
		finished := time.Now().UTC()
		job.Status = models.JobFailed
		job.Error = redaction.Text(err.Error())
		job.FinishedAt = &finished
		job.Summary = "Runbook failed."
		_ = s.store.Put(job)
		log.Printf("teleclaw broker: job failed job_id=%s runbook_id=%s err=%s", job.ID, job.RunbookID, job.Error)
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": "runbook execution failed", "job_id": job.ID})
		return
	}

	job.Result = result
	job.Status = models.JobSucceeded
	finished := time.Now().UTC()
	job.FinishedAt = &finished
	job.Summary = summary.FromResult(job.RunbookID, result, logs)
	_ = s.store.Put(job)
	log.Printf("teleclaw broker: job succeeded job_id=%s runbook_id=%s summary=%q", job.ID, job.RunbookID, job.Summary)

	writeJSON(w, http.StatusAccepted, models.ExecuteRunbookResponse{
		JobID:   job.ID,
		Status:  string(job.Status),
		Summary: job.Summary,
	})
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/v1/jobs/")
	if path == "" {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}

	isLogs := strings.HasSuffix(path, "/logs")
	jobID := strings.TrimSuffix(path, "/logs")
	jobID = strings.TrimSuffix(jobID, "/")
	job, ok := s.store.Get(jobID)
	if !ok {
		log.Printf("teleclaw broker: job not found job_id=%s", jobID)
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "job not found"})
		return
	}

	if isLogs {
		writeJSON(w, http.StatusOK, map[string]any{"job_id": job.ID, "logs": job.Logs})
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (s *Server) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		log.Printf(
			"teleclaw broker: request method=%s path=%s status=%d duration_ms=%d",
			r.Method,
			r.URL.Path,
			rec.status,
			time.Since(start).Milliseconds(),
		)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func missingInputs(required []string, input map[string]string) []string {
	missing := []string{}
	for _, key := range required {
		if strings.TrimSpace(input[key]) == "" {
			missing = append(missing, key)
		}
	}
	return missing
}

func mapKeys(input map[string]string) []string {
	keys := make([]string, 0, len(input))
	for k := range input {
		keys = append(keys, k)
	}
	return keys
}

func newJobID() string {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "job-fallback"
	}
	return "job-" + hex.EncodeToString(buf)
}
