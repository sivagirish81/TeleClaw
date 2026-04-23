package models

import "time"

type RunbookManifest struct {
	ID             string            `yaml:"id" json:"id"`
	Title          string            `yaml:"title" json:"title"`
	Kind           string            `yaml:"kind" json:"kind"`
	Description    string            `yaml:"description" json:"description"`
	RequiredInputs []string          `yaml:"required_inputs" json:"required_inputs"`
	OptionalInputs []string          `yaml:"optional_inputs" json:"optional_inputs"`
	Access         map[string]any    `yaml:"access" json:"access"`
	Execution      map[string]any    `yaml:"execution" json:"execution"`
	Output         map[string]any    `yaml:"output" json:"output"`
	Redaction      map[string]any    `yaml:"redaction" json:"redaction"`
	Metadata       map[string]string `yaml:"metadata,omitempty" json:"metadata,omitempty"`
}

type JobStatus string

const (
	JobQueued    JobStatus = "queued"
	JobRunning   JobStatus = "running"
	JobSucceeded JobStatus = "succeeded"
	JobFailed    JobStatus = "failed"
)

type Job struct {
	ID         string            `json:"id"`
	RunbookID  string            `json:"runbook_id"`
	Status     JobStatus         `json:"status"`
	Input      map[string]string `json:"input"`
	StartedAt  time.Time         `json:"started_at"`
	FinishedAt *time.Time        `json:"finished_at,omitempty"`
	Summary    string            `json:"summary"`
	Result     map[string]any    `json:"result,omitempty"`
	Error      string            `json:"error,omitempty"`
	Logs       []string          `json:"logs"`
}

type ExecuteRunbookRequest struct {
	RunbookID string            `json:"runbook_id"`
	Input     map[string]string `json:"input"`
}

type ExecuteRunbookResponse struct {
	JobID   string `json:"job_id"`
	Status  string `json:"status"`
	Summary string `json:"summary"`
}
