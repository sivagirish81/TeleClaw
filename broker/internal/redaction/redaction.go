package redaction

import "regexp"

var rules = []*regexp.Regexp{
	regexp.MustCompile(`(?i)password\s*[:=]\s*[^\s]+`),
	regexp.MustCompile(`(?i)token\s*[:=]\s*[^\s]+`),
	regexp.MustCompile(`(?i)authorization\s*:\s*bearer\s+[^\s]+`),
}

func Text(input string) string {
	out := input
	for _, rule := range rules {
		out = rule.ReplaceAllString(out, "[REDACTED]")
	}
	return out
}

func Logs(lines []string) []string {
	redacted := make([]string, 0, len(lines))
	for _, line := range lines {
		redacted = append(redacted, Text(line))
	}
	return redacted
}
