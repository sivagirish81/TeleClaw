package kubernetes

import (
	"context"
	"os/exec"
)

type ExecRunner struct{}

func (r ExecRunner) Run(ctx context.Context, name string, args []string) (string, string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	stdout, err := cmd.Output()
	if err == nil {
		return string(stdout), "", nil
	}

	if exitErr, ok := err.(*exec.ExitError); ok {
		return string(stdout), string(exitErr.Stderr), err
	}

	return "", "", err
}
