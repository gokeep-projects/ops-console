//go:build linux

package monitor

import (
	"os"
	"strings"
)

func getProductID() string {
	candidates := []string{
		"/sys/class/dmi/id/product_uuid",
		"/etc/machine-id",
	}
	for _, path := range candidates {
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		value := strings.TrimSpace(string(b))
		if value != "" {
			return value
		}
	}
	return ""
}
