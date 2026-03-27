package main

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

func tryAutoOpenDashboard(listenAddr string) {
	targetURL, ok := buildLocalAccessURL(listenAddr)
	if !ok {
		return
	}

	if !waitForHTTPReady(targetURL, 12*time.Second) {
		return
	}

	switch runtime.GOOS {
	case "windows":
		if !isAllowedDefaultBrowserWindows() {
			return
		}
		_ = exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL).Start()
	case "linux":
		if !isAllowedDefaultBrowserLinux() {
			return
		}
		_ = exec.Command("xdg-open", targetURL).Start()
	case "darwin":
		if !isAllowedDefaultBrowserDarwin() {
			return
		}
		_ = exec.Command("open", targetURL).Start()
	default:
		return
	}
}

func buildLocalAccessURL(listenAddr string) (string, bool) {
	raw := strings.TrimSpace(listenAddr)
	if raw == "" {
		return "", false
	}

	if strings.Contains(raw, "://") {
		u, err := url.Parse(raw)
		if err != nil || u.Host == "" {
			return "", false
		}
		if strings.TrimSpace(u.Scheme) == "" {
			u.Scheme = "http"
		}
		return ensureTrailingSlash(u.String()), true
	}

	host, port, ok := splitHostPort(raw)
	if !ok {
		return "", false
	}
	host = normalizeOpenHost(host)
	if host == "" {
		host = "127.0.0.1"
	}

	if strings.Contains(host, ":") && !strings.HasPrefix(host, "[") {
		host = "[" + host + "]"
	}

	if port == "" {
		return ensureTrailingSlash("http://" + host), true
	}
	return ensureTrailingSlash(fmt.Sprintf("http://%s:%s", host, port)), true
}

func splitHostPort(addr string) (string, string, bool) {
	if strings.HasPrefix(addr, ":") {
		return "", strings.TrimPrefix(addr, ":"), true
	}
	if h, p, err := net.SplitHostPort(addr); err == nil {
		return strings.TrimSpace(h), strings.TrimSpace(p), true
	}
	parts := strings.Split(addr, ":")
	if len(parts) == 2 {
		return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), true
	}
	return "", "", false
}

func normalizeOpenHost(host string) string {
	v := strings.TrimSpace(host)
	v = strings.TrimPrefix(v, "[")
	v = strings.TrimSuffix(v, "]")
	switch strings.ToLower(v) {
	case "", "0.0.0.0", "::", "::0", "*":
		return "127.0.0.1"
	default:
		return v
	}
}

func ensureTrailingSlash(raw string) string {
	if strings.HasSuffix(raw, "/") {
		return raw
	}
	return raw + "/"
}

func waitForHTTPReady(targetURL string, timeout time.Duration) bool {
	if strings.TrimSpace(targetURL) == "" {
		return false
	}
	client := &http.Client{Timeout: 1200 * time.Millisecond}
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		resp, err := client.Get(targetURL)
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			return true
		}
		time.Sleep(350 * time.Millisecond)
	}
	return false
}

func isAllowedDefaultBrowserWindows() bool {
	allowedProg := map[string]struct{}{
		"chromehtml":    {},
		"firefoxurl":    {},
		"msedgehtm":     {},
		"microsoftedge": {},
	}

	userChoiceOut, err := exec.Command(
		"reg",
		"query",
		`HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice`,
		"/v",
		"ProgId",
	).Output()
	if err == nil {
		progID := strings.ToLower(strings.TrimSpace(parseRegQueryValue(string(userChoiceOut))))
		if progID != "" {
			if _, ok := allowedProg[progID]; ok {
				return true
			}
			return false
		}
	}

	cmdOut, err := exec.Command("reg", "query", `HKCR\HTTP\shell\open\command`, "/ve").Output()
	if err != nil {
		return false
	}
	low := strings.ToLower(string(cmdOut))
	return strings.Contains(low, "chrome.exe") ||
		strings.Contains(low, "firefox.exe") ||
		strings.Contains(low, "msedge.exe")
}

func parseRegQueryValue(output string) string {
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		joined := strings.ToLower(strings.Join(fields, " "))
		if !strings.Contains(joined, "reg_") {
			continue
		}
		return strings.TrimSpace(strings.Join(fields[2:], " "))
	}
	return ""
}

func isAllowedDefaultBrowserLinux() bool {
	out, err := exec.Command("xdg-settings", "get", "default-web-browser").Output()
	if err != nil {
		return false
	}
	v := strings.ToLower(strings.TrimSpace(string(out)))
	return strings.Contains(v, "chrome") || strings.Contains(v, "firefox") || strings.Contains(v, "edge")
}

func isAllowedDefaultBrowserDarwin() bool {
	out, err := exec.Command(
		"osascript",
		"-e",
		`id of app (path to default application for URL "http://127.0.0.1")`,
	).Output()
	if err != nil {
		return false
	}
	bundleID := strings.ToLower(strings.TrimSpace(string(out)))
	return bundleID == "com.google.chrome" ||
		bundleID == "org.mozilla.firefox" ||
		strings.HasPrefix(bundleID, "com.microsoft.edge")
}
