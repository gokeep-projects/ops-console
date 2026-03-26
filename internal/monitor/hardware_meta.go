package monitor

import (
	"bytes"
	"encoding/json"
	"net"
	"os/exec"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
)

type MemoryModule struct {
	Manufacturer string `json:"manufacturer"`
	Model        string `json:"model"`
	FrequencyMHz uint32 `json:"frequency_mhz"`
	Capacity     uint64 `json:"capacity"`
	Serial       string `json:"serial"`
}

type DiskHardwareInfo struct {
	Name      string `json:"name"`
	Model     string `json:"model"`
	Serial    string `json:"serial"`
	Interface string `json:"interface"`
	MediaType string `json:"media_type"`
	Size      uint64 `json:"size"`
}

type staticHardwareMeta struct {
	CPUModel        string
	CPUArch         string
	CPUFrequencyMHz float64
	MemoryModules   []MemoryModule
	DiskHardware    []DiskHardwareInfo
}

var (
	staticHardwareMu   sync.RWMutex
	staticHardwareAt   time.Time
	staticHardwareData staticHardwareMeta
)

const staticHardwareTTL = 10 * time.Minute

func getStaticHardwareMeta() staticHardwareMeta {
	staticHardwareMu.RLock()
	if !staticHardwareAt.IsZero() && time.Since(staticHardwareAt) < staticHardwareTTL {
		out := cloneStaticHardwareMeta(staticHardwareData)
		staticHardwareMu.RUnlock()
		return out
	}
	staticHardwareMu.RUnlock()

	fresh := detectStaticHardwareMeta()

	staticHardwareMu.Lock()
	staticHardwareAt = time.Now()
	staticHardwareData = cloneStaticHardwareMeta(fresh)
	out := cloneStaticHardwareMeta(staticHardwareData)
	staticHardwareMu.Unlock()
	return out
}

func cloneStaticHardwareMeta(in staticHardwareMeta) staticHardwareMeta {
	out := in
	out.MemoryModules = append([]MemoryModule(nil), in.MemoryModules...)
	out.DiskHardware = append([]DiskHardwareInfo(nil), in.DiskHardware...)
	return out
}

func detectStaticHardwareMeta() staticHardwareMeta {
	model, arch, mhz := detectCPUStaticInfo()
	return staticHardwareMeta{
		CPUModel:        model,
		CPUArch:         arch,
		CPUFrequencyMHz: mhz,
		MemoryModules:   detectMemoryModules(),
		DiskHardware:    detectDiskHardware(),
	}
}

func detectCPUStaticInfo() (string, string, float64) {
	model := ""
	sumMHz := 0.0
	count := 0
	info, err := cpu.Info()
	if err == nil {
		for _, item := range info {
			if model == "" {
				model = strings.TrimSpace(item.ModelName)
			}
			if item.Mhz > 0 {
				sumMHz += item.Mhz
				count++
			}
		}
	}
	arch := normalizeArchitecture(runtime.GOARCH)
	mhz := 0.0
	if count > 0 {
		mhz = sumMHz / float64(count)
	}
	return model, arch, mhz
}

func normalizeArchitecture(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "amd64":
		return "x86_64"
	case "386":
		return "x86"
	default:
		return v
	}
}

func detectMemoryModules() []MemoryModule {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsMemoryModules()
	default:
		return nil
	}
}

type win32PhysicalMemory struct {
	Manufacturer         string `json:"Manufacturer"`
	PartNumber           string `json:"PartNumber"`
	ConfiguredClockSpeed uint32 `json:"ConfiguredClockSpeed"`
	Speed                uint32 `json:"Speed"`
	Capacity             uint64 `json:"Capacity"`
	SerialNumber         string `json:"SerialNumber"`
}

func detectWindowsMemoryModules() []MemoryModule {
	script := "$ErrorActionPreference='SilentlyContinue'; " +
		"Get-CimInstance Win32_PhysicalMemory | " +
		"Select-Object Manufacturer,PartNumber,ConfiguredClockSpeed,Speed,Capacity,SerialNumber | " +
		"ConvertTo-Json -Compress"
	raw, err := runPowerShellJSON(script)
	if err != nil {
		return nil
	}
	list, err := decodeJSONList[win32PhysicalMemory](raw)
	if err != nil {
		return nil
	}

	out := make([]MemoryModule, 0, len(list))
	for _, item := range list {
		manufacturer := strings.TrimSpace(item.Manufacturer)
		model := strings.TrimSpace(item.PartNumber)
		serial := strings.TrimSpace(item.SerialNumber)
		freq := item.ConfiguredClockSpeed
		if freq == 0 {
			freq = item.Speed
		}
		if manufacturer == "" && model == "" && serial == "" && item.Capacity == 0 {
			continue
		}
		out = append(out, MemoryModule{
			Manufacturer: manufacturer,
			Model:        model,
			FrequencyMHz: freq,
			Capacity:     item.Capacity,
			Serial:       serial,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Capacity == out[j].Capacity {
			return out[i].Model < out[j].Model
		}
		return out[i].Capacity > out[j].Capacity
	})
	return out
}

func detectDiskHardware() []DiskHardwareInfo {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsDiskHardware()
	default:
		return nil
	}
}

type win32DiskDrive struct {
	DeviceID      string `json:"DeviceID"`
	Model         string `json:"Model"`
	SerialNumber  string `json:"SerialNumber"`
	Size          uint64 `json:"Size"`
	InterfaceType string `json:"InterfaceType"`
	MediaType     string `json:"MediaType"`
}

func detectWindowsDiskHardware() []DiskHardwareInfo {
	script := "$ErrorActionPreference='SilentlyContinue'; " +
		"Get-CimInstance Win32_DiskDrive | " +
		"Select-Object DeviceID,Model,SerialNumber,Size,InterfaceType,MediaType | " +
		"ConvertTo-Json -Compress"
	raw, err := runPowerShellJSON(script)
	if err != nil {
		return nil
	}
	list, err := decodeJSONList[win32DiskDrive](raw)
	if err != nil {
		return nil
	}

	out := make([]DiskHardwareInfo, 0, len(list))
	for _, item := range list {
		name := strings.TrimSpace(item.DeviceID)
		model := strings.TrimSpace(item.Model)
		serial := strings.TrimSpace(item.SerialNumber)
		iface := strings.TrimSpace(item.InterfaceType)
		media := strings.TrimSpace(item.MediaType)
		if name == "" && model == "" && serial == "" && item.Size == 0 {
			continue
		}
		out = append(out, DiskHardwareInfo{
			Name:      name,
			Model:     model,
			Serial:    serial,
			Interface: iface,
			MediaType: media,
			Size:      item.Size,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out
}

func runPowerShellJSON(script string) ([]byte, error) {
	cmd := exec.Command(
		"powershell",
		"-NoProfile",
		"-Command",
		"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "+script,
	)
	return cmd.Output()
}

func decodeJSONList[T any](raw []byte) ([]T, error) {
	b := bytes.TrimSpace(raw)
	if len(b) == 0 || bytes.EqualFold(b, []byte("null")) {
		return nil, nil
	}
	if len(b) > 0 && b[0] == '[' {
		var list []T
		if err := json.Unmarshal(b, &list); err != nil {
			return nil, err
		}
		return list, nil
	}
	var one T
	if err := json.Unmarshal(b, &one); err != nil {
		return nil, err
	}
	return []T{one}, nil
}

func detectPrimaryNetworkIPv4() (string, string) {
	type candidate struct {
		name  string
		ip    string
		score int
	}

	best := candidate{score: -1}
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", ""
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		nameLower := strings.ToLower(strings.TrimSpace(iface.Name))
		if isVirtualNIC(nameLower) {
			continue
		}

		baseScore := 10
		if isWirelessNIC(nameLower) {
			baseScore = 40
		} else if isEthernetNIC(nameLower) {
			baseScore = 32
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip := extractIPv4(addr)
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			score := baseScore
			if isPrivateIPv4(ip) {
				score += 4
			}
			ipStr := ip.String()
			if score > best.score || (score == best.score && ipStr < best.ip) {
				best = candidate{
					name:  iface.Name,
					ip:    ipStr,
					score: score,
				}
			}
		}
	}

	if best.score < 0 {
		return "", ""
	}
	return best.ip, best.name
}

func extractIPv4(addr net.Addr) net.IP {
	switch v := addr.(type) {
	case *net.IPNet:
		return v.IP.To4()
	case *net.IPAddr:
		return v.IP.To4()
	default:
		return nil
	}
}

func isPrivateIPv4(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip[0] == 10 {
		return true
	}
	if ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31 {
		return true
	}
	if ip[0] == 192 && ip[1] == 168 {
		return true
	}
	return false
}

func isWirelessNIC(name string) bool {
	return strings.Contains(name, "wifi") ||
		strings.Contains(name, "wi-fi") ||
		strings.Contains(name, "wlan") ||
		strings.Contains(name, "wireless")
}

func isEthernetNIC(name string) bool {
	return strings.Contains(name, "ethernet") ||
		strings.HasPrefix(name, "eth") ||
		strings.HasPrefix(name, "en")
}

func isVirtualNIC(name string) bool {
	virtualKeywords := []string{
		"loopback", "docker", "vmware", "vethernet", "virtual",
		"hyper-v", "bridge", "tap", "tun", "vpn", "tailscale", "zerotier",
	}
	for _, key := range virtualKeywords {
		if strings.Contains(name, key) {
			return true
		}
	}
	return false
}
