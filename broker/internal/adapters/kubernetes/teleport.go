package kubernetes

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/example/teleclaw/broker/internal/config"
	"github.com/example/teleclaw/broker/internal/models"
)

var (
	namespacePattern = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
	workloadPattern  = regexp.MustCompile(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`)
	selectorPattern  = regexp.MustCompile(`^[a-zA-Z0-9=,._-]+$`)
)

type CommandRunner interface {
	Run(ctx context.Context, name string, args []string) (stdout string, stderr string, err error)
}

type TeleportAdapter struct {
	cfg            config.TeleportConfig
	runner         CommandRunner
	loginTimeout   time.Duration
	commandTimeout time.Duration
}

func NewTeleport(cfg config.TeleportConfig, runner CommandRunner) (*TeleportAdapter, error) {
	loginTimeout, err := time.ParseDuration(cfg.LoginTimeout)
	if err != nil {
		return nil, fmt.Errorf("invalid teleport.login_timeout: %w", err)
	}
	commandTimeout, err := time.ParseDuration(cfg.CommandTimeout)
	if err != nil {
		return nil, fmt.Errorf("invalid teleport.command_timeout: %w", err)
	}

	return &TeleportAdapter{
		cfg:            cfg,
		runner:         runner,
		loginTimeout:   loginTimeout,
		commandTimeout: commandTimeout,
	}, nil
}

func (a *TeleportAdapter) Run(manifest models.RunbookManifest, input map[string]string) (map[string]any, []string, error) {
	if !a.cfg.Enabled {
		return nil, nil, fmt.Errorf("teleport adapter is disabled in broker config")
	}
	if strings.TrimSpace(a.cfg.KubeCluster) == "" {
		return nil, nil, fmt.Errorf("teleport.kube_cluster must be configured")
	}

	namespace := strings.TrimSpace(input["namespace"])
	if !namespacePattern.MatchString(namespace) {
		return nil, nil, fmt.Errorf("invalid namespace %q", namespace)
	}

	logs := []string{}
	if err := a.loginToTeleport(namespace, &logs); err != nil {
		return nil, logs, err
	}

	switch manifest.ID {
	case "k8s.release_diagnose":
		return a.runReleaseDiagnose(namespace, input, logs)
	case "k8s.pod_logs":
		return a.runPodLogs(namespace, input, logs)
	default:
		return nil, logs, fmt.Errorf("teleport adapter does not support runbook %q", manifest.ID)
	}
}

func (a *TeleportAdapter) runReleaseDiagnose(namespace string, input map[string]string, logs []string) (map[string]any, []string, error) {
	workload := strings.TrimSpace(input["workload"])
	if !workloadPattern.MatchString(workload) {
		return nil, logs, fmt.Errorf("invalid workload %q", workload)
	}

	tail, err := sanitizeTailLines(input["log_tail_lines"], 100)
	if err != nil {
		return nil, logs, err
	}

	rolloutOut, rolloutErr := a.kubectl("rollout_status", namespace, logsPtr(&logs), "rollout", "status", "deployment/"+workload, "-n", namespace, "--watch=false")
	podsOut, podsErr := a.kubectl("pod_list", namespace, logsPtr(&logs), "get", "pods", "-n", namespace, "-l", "app="+workload, "-o", "wide")
	eventsOut, eventsErr := a.kubectl("recent_events", namespace, logsPtr(&logs), "get", "events", "-n", namespace, "--sort-by=.lastTimestamp", "--field-selector", "type!=Normal")
	logsOut, logsErr := a.kubectl("logs_tail", namespace, logsPtr(&logs), "logs", "deployment/"+workload, "-n", namespace, "--tail", strconv.Itoa(tail))

	checks := []map[string]any{
		buildCheck("rollout_status", rolloutOut, rolloutErr),
		buildCheck("pod_list", podsOut, podsErr),
		buildCheck("recent_events", eventsOut, eventsErr),
		buildCheck("logs_tail", logsOut, logsErr),
	}

	overallStatus := "ok"
	for _, check := range checks {
		status, _ := check["status"].(string)
		if status != "ok" {
			overallStatus = "degraded"
			break
		}
	}

	result := map[string]any{
		"namespace":      namespace,
		"workload":       workload,
		"provider":       "teleport",
		"overall_status": overallStatus,
		"checks":         checks,
	}
	return result, logs, nil
}

func (a *TeleportAdapter) runPodLogs(namespace string, input map[string]string, logs []string) (map[string]any, []string, error) {
	tail, err := sanitizeTailLines(input["tail_lines"], 200)
	if err != nil {
		return nil, logs, err
	}

	selector := strings.TrimSpace(input["selector"])
	if selector == "" {
		workload := strings.TrimSpace(input["workload"])
		if workload != "" {
			if !workloadPattern.MatchString(workload) {
				return nil, logs, fmt.Errorf("invalid workload %q", workload)
			}
			selector = "app=" + workload
		}
	}
	if selector == "" {
		return nil, logs, fmt.Errorf("selector or workload is required for k8s.pod_logs")
	}
	if !selectorPattern.MatchString(selector) {
		return nil, logs, fmt.Errorf("invalid selector %q", selector)
	}

	podLogs, err := a.kubectl("logs_tail", namespace, logsPtr(&logs), "logs", "-n", namespace, "-l", selector, "--tail", strconv.Itoa(tail))
	if err != nil {
		return nil, logs, err
	}

	result := map[string]any{
		"namespace": namespace,
		"selector":  selector,
		"provider":  "teleport",
		"checks": []map[string]any{
			{"name": "logs_tail", "status": "ok", "value": truncate(podLogs, 1200)},
		},
	}
	return result, logs, nil
}

func (a *TeleportAdapter) loginToTeleport(namespace string, logs *[]string) error {
	ctx, cancel := context.WithTimeout(context.Background(), a.loginTimeout)
	defer cancel()

	args := []string{}
	if strings.TrimSpace(a.cfg.Proxy) != "" {
		args = append(args, "--proxy="+strings.TrimSpace(a.cfg.Proxy))
	}
	args = append(args, "kube", "login", strings.TrimSpace(a.cfg.KubeCluster))
	if ttl := strings.TrimSpace(a.cfg.LoginTTL); ttl != "" {
		args = append(args, "--ttl", ttl)
	}

	stdout, stderr, err := a.runner.Run(ctx, a.cfg.TshPath, args)
	*logs = append(*logs, fmt.Sprintf("teleport login: %s %s", a.cfg.TshPath, strings.Join(args, " ")))
	if strings.TrimSpace(stdout) != "" {
		*logs = append(*logs, "teleport login stdout: "+truncate(stdout, 300))
	}
	if strings.TrimSpace(stderr) != "" {
		*logs = append(*logs, "teleport login stderr: "+truncate(stderr, 300))
	}
	if err != nil {
		return fmt.Errorf("teleport kube login failed: %w", err)
	}
	_ = namespace
	return nil
}

func (a *TeleportAdapter) kubectl(checkName, namespace string, logs *[]string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), a.commandTimeout)
	defer cancel()

	stdout, stderr, err := a.runner.Run(ctx, a.cfg.KubectlPath, args)
	*logs = append(*logs, fmt.Sprintf("%s: %s %s", checkName, a.cfg.KubectlPath, strings.Join(args, " ")))
	if strings.TrimSpace(stderr) != "" {
		*logs = append(*logs, fmt.Sprintf("%s stderr: %s", checkName, truncate(stderr, 300)))
	}
	if err != nil {
		return "", fmt.Errorf("%s failed: %w", checkName, err)
	}
	return strings.TrimSpace(stdout), nil
}

func sanitizeTailLines(raw string, defaultValue int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultValue, nil
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("tail lines must be a number")
	}
	if v < 1 || v > 5000 {
		return 0, fmt.Errorf("tail lines must be between 1 and 5000")
	}
	return v, nil
}

func truncate(text string, max int) string {
	if len(text) <= max {
		return text
	}
	return text[:max] + "..."
}

func logsPtr(logs *[]string) *[]string {
	return logs
}

func buildCheck(name, value string, err error) map[string]any {
	if err != nil {
		return map[string]any{
			"name":   name,
			"status": "failed",
			"value":  truncate(err.Error(), 600),
		}
	}
	return map[string]any{
		"name":   name,
		"status": "ok",
		"value":  truncate(value, 600),
	}
}
