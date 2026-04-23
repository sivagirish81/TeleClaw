package summary

import (
	"fmt"
	"strings"
)

func FromResult(runbookID string, result map[string]any, logs []string) string {
	checks, _ := result["checks"].([]map[string]any)
	if len(checks) > 0 {
		ok := 0
		for _, c := range checks {
			status, _ := c["status"].(string)
			if strings.EqualFold(status, "ok") {
				ok++
			}
		}
		return fmt.Sprintf("%s completed: %d/%d checks OK.", runbookID, ok, len(checks))
	}

	if len(logs) > 0 {
		return fmt.Sprintf("%s completed with %d log lines.", runbookID, len(logs))
	}

	return fmt.Sprintf("%s completed successfully.", runbookID)
}
