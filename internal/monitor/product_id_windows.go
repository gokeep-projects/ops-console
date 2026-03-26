//go:build windows

package monitor

import (
	"strings"

	"golang.org/x/sys/windows/registry"
)

func getProductID() string {
	const regPath = `SOFTWARE\Microsoft\Windows NT\CurrentVersion`
	if id := readWindowsRegistryProductID(regPath, registry.WOW64_64KEY|registry.QUERY_VALUE); id != "" {
		return id
	}
	return readWindowsRegistryProductID(regPath, registry.QUERY_VALUE)
}

func readWindowsRegistryProductID(path string, access uint32) string {
	key, err := registry.OpenKey(registry.LOCAL_MACHINE, path, access)
	if err != nil {
		return ""
	}
	defer key.Close()

	value, _, err := key.GetStringValue("ProductId")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(value)
}
