package monitor

import (
	"fmt"
	"net"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"ops-tool/internal/config"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/load"
	"github.com/shirou/gopsutil/v3/mem"
	netio "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

type Snapshot struct {
	Time         time.Time            `json:"time"`
	OS           OSInfo               `json:"os"`
	CPU          CPUInfo              `json:"cpu"`
	Memory       MemoryInfo           `json:"memory"`
	Disks        []DiskInfo           `json:"disks"`
	DiskHardware []DiskHardwareInfo   `json:"disk_hardware"`
	GPUCards     []GPUCardInfo        `json:"gpu_cards"`
	NetworkCards []NetworkAdapterInfo `json:"network_cards"`
	DiskIO       DiskIOSummary        `json:"disk_io"`
	Network      NetworkInfo          `json:"network"`
	ProcessCount int                  `json:"process_count"`
	ThreadCount  int                  `json:"thread_count"`
	TopProcesses []ProcessInfo        `json:"top_processes"`
	Ports        []PortInfo           `json:"ports"`
	Applications []ServiceStatus      `json:"applications"`
	Databases    []ServiceStatus      `json:"databases"`
	Middleware   []ServiceStatus      `json:"middleware"`
	SNMP         []SNMPTargetStatus   `json:"snmp"`
	Nmap         []NmapTargetStatus   `json:"nmap"`
	JVM          []ProcessInfo        `json:"jvm"`
}

type OSInfo struct {
	Hostname      string  `json:"hostname"`
	Platform      string  `json:"platform"`
	OSType        string  `json:"os_type"`
	Version       string  `json:"version"`
	KernelVersion string  `json:"kernel_version"`
	DeviceID      string  `json:"device_id"`
	ProductID     string  `json:"product_id"`
	Uptime        uint64  `json:"uptime"`
	Load1         float64 `json:"load1"`
	Load5         float64 `json:"load5"`
	Load15        float64 `json:"load15"`
}

type CPUInfo struct {
	UsagePercent float64 `json:"usage_percent"`
	CoreCount    int     `json:"core_count"`
	Model        string  `json:"model"`
	Architecture string  `json:"architecture"`
	FrequencyMHz float64 `json:"frequency_mhz"`
}

type MemoryInfo struct {
	Total        uint64         `json:"total"`
	Used         uint64         `json:"used"`
	UsedPercent  float64        `json:"used_percent"`
	SwapTotal    uint64         `json:"swap_total"`
	SwapUsed     uint64         `json:"swap_used"`
	SwapUsedRate float64        `json:"swap_used_rate"`
	Modules      []MemoryModule `json:"modules"`
}

type DiskInfo struct {
	Path        string  `json:"path"`
	Device      string  `json:"device"`
	FSType      string  `json:"fs_type"`
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
	ReadBytes   uint64  `json:"read_bytes"`
	WriteBytes  uint64  `json:"write_bytes"`
	ReadCount   uint64  `json:"read_count"`
	WriteCount  uint64  `json:"write_count"`
}

type DiskIOSummary struct {
	ReadBytes  uint64 `json:"read_bytes"`
	WriteBytes uint64 `json:"write_bytes"`
	ReadCount  uint64 `json:"read_count"`
	WriteCount uint64 `json:"write_count"`
}

type NetworkInfo struct {
	BytesSent       uint64 `json:"bytes_sent"`
	BytesRecv       uint64 `json:"bytes_recv"`
	PacketsIn       uint64 `json:"packets_in"`
	PacketsOut      uint64 `json:"packets_out"`
	ConnectionCount int    `json:"connection_count"`
	PrimaryIP       string `json:"primary_ip"`
	PrimaryNIC      string `json:"primary_nic"`
	PrimaryMAC      string `json:"primary_mac"`
}

type ProcessInfo struct {
	PID     int32   `json:"pid"`
	Name    string  `json:"name"`
	CPU     float64 `json:"cpu"`
	Memory  float32 `json:"memory"`
	Threads int32   `json:"threads"`
	Cmdline string  `json:"cmdline"`
	ExePath string  `json:"exe_path"`
	IsJVM   bool    `json:"is_jvm"`
}

type PortInfo struct {
	ExePath     string `json:"exe_path"`
	ProcessName string `json:"process_name"`
	Port        uint32 `json:"port"`
	Status      string `json:"status"`
	PID         int32  `json:"pid"`
}

type ServiceStatus struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Status  string `json:"status"`
	Detail  string `json:"detail"`
	Latency int64  `json:"latency_ms"`
}

type processCatalogEntry struct {
	PID     int32
	Name    string
	Cmdline string
	ExePath string
}

func Gather(cfg *config.Config) Snapshot {
	catalog := buildProcessCatalog()
	pidMeta := make(map[int32]processCatalogEntry, len(catalog))
	for _, item := range catalog {
		pidMeta[item.PID] = item
	}

	staticMeta := getStaticHardwareMeta()
	topProcesses, processCount, threadCount := gatherTopProcesses(120)
	diskIO := gatherDiskIOSummary()

	return Snapshot{
		Time:         time.Now(),
		OS:           gatherOS(),
		CPU:          gatherCPU(staticMeta),
		Memory:       gatherMemory(staticMeta),
		Disks:        gatherDisks(),
		DiskHardware: staticMeta.DiskHardware,
		GPUCards:     staticMeta.GPUCards,
		NetworkCards: staticMeta.NetworkAdapters,
		DiskIO:       diskIO,
		Network:      gatherNetwork(),
		ProcessCount: processCount,
		ThreadCount:  threadCount,
		TopProcesses: topProcesses,
		Ports:        gatherPorts(pidMeta),
		Applications: gatherApplications(cfg.Applications, catalog),
		Databases:    gatherDatabases(cfg.Databases, catalog),
		Middleware:   gatherMiddleware(cfg.Middleware.Checks, catalog),
		SNMP:         gatherSNMP(cfg.Monitor.SNMP),
		Nmap:         gatherNmap(cfg.Monitor.Nmap),
		JVM:          gatherJVM(80),
	}
}

func gatherOS() OSInfo {
	info, _ := host.Info()
	avg, _ := load.Avg()
	osType := strings.TrimSpace(info.Platform)
	if osType == "" {
		osType = strings.TrimSpace(info.OS)
	}
	if osType == "" {
		osType = "-"
	}

	version := strings.TrimSpace(info.PlatformVersion)
	if version == "" {
		version = "-"
	}

	kernelVersion := strings.TrimSpace(info.KernelVersion)
	if kernelVersion == "" {
		kernelVersion = "-"
	}

	deviceID := strings.TrimSpace(info.HostID)
	if deviceID == "" {
		deviceID = "-"
	}

	productID := strings.TrimSpace(getProductID())
	if productID == "" {
		productID = "-"
	}

	platform := osType
	if arch := strings.TrimSpace(info.KernelArch); arch != "" {
		platform = fmt.Sprintf("%s/%s", osType, arch)
	}

	return OSInfo{
		Hostname:      info.Hostname,
		Platform:      platform,
		OSType:        osType,
		Version:       version,
		KernelVersion: kernelVersion,
		DeviceID:      deviceID,
		ProductID:     productID,
		Uptime:        info.Uptime,
		Load1:         avg.Load1,
		Load5:         avg.Load5,
		Load15:        avg.Load15,
	}
}

func gatherCPU(meta staticHardwareMeta) CPUInfo {
	cores, _ := cpu.Counts(true)
	vals, _ := cpu.Percent(500*time.Millisecond, false)
	v := 0.0
	if len(vals) > 0 {
		v = vals[0]
	}
	return CPUInfo{
		UsagePercent: v,
		CoreCount:    cores,
		Model:        meta.CPUModel,
		Architecture: meta.CPUArch,
		FrequencyMHz: meta.CPUFrequencyMHz,
	}
}

func gatherMemory(meta staticHardwareMeta) MemoryInfo {
	vm, _ := mem.VirtualMemory()
	sm, _ := mem.SwapMemory()
	return MemoryInfo{
		Total:        vm.Total,
		Used:         vm.Used,
		UsedPercent:  vm.UsedPercent,
		SwapTotal:    sm.Total,
		SwapUsed:     sm.Used,
		SwapUsedRate: sm.UsedPercent,
		Modules:      meta.MemoryModules,
	}
}

func gatherDisks() []DiskInfo {
	parts, _ := disk.Partitions(runtime.GOOS == "linux")
	ioStats, _ := disk.IOCounters()
	out := make([]DiskInfo, 0, len(parts))
	seenMount := make(map[string]struct{}, len(parts))
	for _, p := range parts {
		if shouldSkipPartition(p) {
			continue
		}
		mountpoint := strings.TrimSpace(p.Mountpoint)
		if mountpoint == "" {
			continue
		}
		key := strings.ToLower(mountpoint)
		if _, ok := seenMount[key]; ok {
			continue
		}
		u, err := disk.Usage(mountpoint)
		if err != nil {
			continue
		}
		if u.Total == 0 {
			continue
		}
		seenMount[key] = struct{}{}
		io := matchDiskIO(ioStats, p.Device, mountpoint)
		device := strings.TrimSpace(p.Device)
		if device == "" {
			device = "-"
		}
		out = append(out, DiskInfo{
			Path:        mountpoint,
			Device:      device,
			FSType:      p.Fstype,
			Total:       u.Total,
			Used:        u.Used,
			UsedPercent: u.UsedPercent,
			ReadBytes:   io.ReadBytes,
			WriteBytes:  io.WriteBytes,
			ReadCount:   io.ReadCount,
			WriteCount:  io.WriteCount,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Path < out[j].Path
	})
	return out
}

func shouldSkipPartition(p disk.PartitionStat) bool {
	if runtime.GOOS != "linux" {
		return false
	}

	mp := strings.TrimSpace(p.Mountpoint)
	if mp == "" {
		return true
	}
	if mp == "/proc" || strings.HasPrefix(mp, "/proc/") {
		return true
	}
	if mp == "/sys" || strings.HasPrefix(mp, "/sys/") {
		return true
	}
	if mp == "/dev" || strings.HasPrefix(mp, "/dev/pts") {
		return true
	}

	fsType := strings.ToLower(strings.TrimSpace(p.Fstype))
	switch fsType {
	case "proc",
		"sysfs",
		"devpts",
		"securityfs",
		"cgroup",
		"cgroup2",
		"pstore",
		"bpf",
		"tracefs",
		"configfs",
		"debugfs",
		"mqueue",
		"hugetlbfs",
		"fusectl",
		"rpc_pipefs",
		"autofs",
		"binfmt_misc",
		"nsfs":
		return true
	default:
		return false
	}
}

func gatherDiskIOSummary() DiskIOSummary {
	stats, err := disk.IOCounters()
	if err != nil {
		return DiskIOSummary{}
	}
	var out DiskIOSummary
	for _, s := range stats {
		out.ReadBytes += s.ReadBytes
		out.WriteBytes += s.WriteBytes
		out.ReadCount += s.ReadCount
		out.WriteCount += s.WriteCount
	}
	return out
}

func matchDiskIO(ioStats map[string]disk.IOCountersStat, device, mountpoint string) disk.IOCountersStat {
	if len(ioStats) == 0 {
		return disk.IOCountersStat{}
	}

	driveName := strings.TrimSuffix(strings.TrimSuffix(strings.TrimSpace(mountpoint), `\`), `:`)
	candidates := []string{
		strings.TrimSpace(device),
		filepath.Base(strings.TrimSpace(device)),
		strings.TrimSpace(mountpoint),
		driveName,
	}

	for _, c := range candidates {
		if c == "" {
			continue
		}
		for k, v := range ioStats {
			if strings.EqualFold(k, c) {
				return v
			}
		}
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		cLower := strings.ToLower(c)
		for k, v := range ioStats {
			if strings.Contains(strings.ToLower(k), cLower) || strings.Contains(cLower, strings.ToLower(k)) {
				return v
			}
		}
	}
	return disk.IOCountersStat{}
}

func gatherNetwork() NetworkInfo {
	n, _ := netio.IOCounters(false)
	if len(n) == 0 {
		return NetworkInfo{}
	}
	connectionCount := 0
	if cs, err := netio.Connections("inet"); err == nil {
		connectionCount = len(cs)
	}
	ip, nic, mac := detectPrimaryNetworkIPv4()
	return NetworkInfo{
		BytesSent:       n[0].BytesSent,
		BytesRecv:       n[0].BytesRecv,
		PacketsIn:       n[0].PacketsRecv,
		PacketsOut:      n[0].PacketsSent,
		ConnectionCount: connectionCount,
		PrimaryIP:       ip,
		PrimaryNIC:      nic,
		PrimaryMAC:      mac,
	}
}

func gatherTopProcesses(limit int) ([]ProcessInfo, int, int) {
	ps, err := process.Processes()
	if err != nil {
		return nil, 0, 0
	}
	items := make([]ProcessInfo, 0, len(ps))
	totalThreads := 0
	for _, p := range ps {
		name, _ := p.Name()
		c, _ := p.CPUPercent()
		m, _ := p.MemoryPercent()
		cmdline, _ := p.Cmdline()
		exe, _ := p.Exe()
		t, _ := p.NumThreads()
		totalThreads += int(t)
		items = append(items, ProcessInfo{
			PID:     p.Pid,
			Name:    name,
			CPU:     c,
			Memory:  m,
			Threads: t,
			Cmdline: trim(cmdline, 180),
			ExePath: trim(exe, 160),
			IsJVM:   isJavaProcess(name, cmdline, exe),
		})
	}
	sortByCPUDesc(items)
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items, len(ps), totalThreads
}

func gatherPorts(pidMeta map[int32]processCatalogEntry) []PortInfo {
	cs, err := netio.Connections("inet")
	if err != nil {
		return nil
	}
	out := make([]PortInfo, 0, 64)
	seen := make(map[string]int, 128)
	for _, c := range cs {
		if strings.ToUpper(c.Status) != "LISTEN" {
			continue
		}
		entry, ok := pidMeta[c.Pid]
		if !ok {
			entry = processCatalogEntry{PID: c.Pid}
		}
		entry = hydrateProcessCatalogEntry(c.Pid, entry)
		path := normalizePortPath(entry.ExePath, entry.Name, c.Pid)
		row := PortInfo{
			ExePath:     trim(path, 180),
			ProcessName: entry.Name,
			Port:        c.Laddr.Port,
			Status:      c.Status,
			PID:         c.Pid,
		}
		key := fmt.Sprintf("%d|%d|%s", row.PID, row.Port, strings.ToUpper(strings.TrimSpace(row.Status)))
		if idx, exists := seen[key]; exists {
			if out[idx].ProcessName == "" && row.ProcessName != "" {
				out[idx].ProcessName = row.ProcessName
			}
			if out[idx].ExePath == "" && row.ExePath != "" {
				out[idx].ExePath = row.ExePath
			}
			continue
		}
		seen[key] = len(out)
		out = append(out, row)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Port == out[j].Port {
			return out[i].ExePath < out[j].ExePath
		}
		return out[i].Port < out[j].Port
	})
	if len(out) > 120 {
		out = out[:120]
	}
	return out
}

func gatherApplications(apps []config.Application, catalog []processCatalogEntry) []ServiceStatus {
	out := make([]ServiceStatus, 0, len(apps))
	for _, app := range apps {
		if !app.Enabled {
			continue
		}
		patterns := app.ProcessNames
		if len(patterns) == 0 && app.Name != "" {
			patterns = []string{app.Name}
		}
		matched := matchByPatterns(catalog, patterns, 5)
		serviceType := app.Type
		if serviceType == "" {
			serviceType = "application"
		}
		out = append(out, buildServiceStatus(app.Name, serviceType, matched))
	}
	return out
}

func gatherDatabases(databases []config.DatabaseTarget, catalog []processCatalogEntry) []ServiceStatus {
	out := make([]ServiceStatus, 0, len(databases))
	for _, db := range databases {
		patterns := db.ProcessNames
		if len(patterns) == 0 && db.Name != "" {
			patterns = []string{db.Name}
		}
		matched := matchByPatterns(catalog, patterns, 5)
		out = append(out, buildServiceStatus(db.Name, "database", matched))
	}
	return out
}

func gatherMiddleware(items []config.MiddlewareCheck, catalog []processCatalogEntry) []ServiceStatus {
	out := make([]ServiceStatus, 0, len(items))
	for _, item := range items {
		patterns := item.ProcessNames
		if len(patterns) == 0 && item.Name != "" {
			patterns = []string{item.Name}
		}
		matched := matchByPatterns(catalog, patterns, 5)
		out = append(out, buildServiceStatus(item.Name, "middleware", matched))
	}
	return out
}

func buildServiceStatus(name, serviceType string, matched []processCatalogEntry) ServiceStatus {
	status := ServiceStatus{
		Name:   name,
		Type:   serviceType,
		Status: "down",
		Detail: "process not found",
	}
	if len(matched) == 0 {
		return status
	}

	status.Status = "up"
	items := make([]string, 0, len(matched))
	for _, m := range matched {
		items = append(items, fmt.Sprintf("%s(pid=%d)", m.Name, m.PID))
	}
	status.Detail = strings.Join(items, ", ")
	return status
}

func buildProcessCatalog() []processCatalogEntry {
	ps, err := process.Processes()
	if err != nil {
		return nil
	}
	out := make([]processCatalogEntry, 0, len(ps))
	for _, p := range ps {
		name, _ := p.Name()
		cmdline, _ := p.Cmdline()
		exe, _ := p.Exe()
		if strings.TrimSpace(exe) == "" {
			exe = extractExecutableFromCmdline(cmdline)
		}
		if strings.TrimSpace(name) == "" && strings.TrimSpace(exe) != "" {
			name = filepath.Base(exe)
		}
		out = append(out, processCatalogEntry{
			PID:     p.Pid,
			Name:    name,
			Cmdline: cmdline,
			ExePath: exe,
		})
	}
	return out
}

func matchByPatterns(catalog []processCatalogEntry, patterns []string, limit int) []processCatalogEntry {
	if len(patterns) == 0 || len(catalog) == 0 {
		return nil
	}
	keys := make([]string, 0, len(patterns))
	for _, p := range patterns {
		p = strings.TrimSpace(strings.ToLower(p))
		if p != "" {
			keys = append(keys, p)
		}
	}
	if len(keys) == 0 {
		return nil
	}

	matched := make([]processCatalogEntry, 0, 8)
	seen := map[int32]struct{}{}
	for _, entry := range catalog {
		searchable := strings.ToLower(entry.Name + " " + entry.Cmdline + " " + entry.ExePath)
		for _, key := range keys {
			if strings.Contains(searchable, key) {
				if _, exists := seen[entry.PID]; exists {
					break
				}
				seen[entry.PID] = struct{}{}
				matched = append(matched, entry)
				break
			}
		}
		if limit > 0 && len(matched) >= limit {
			break
		}
	}
	return matched
}

func gatherJVM(limit int) []ProcessInfo {
	ps, err := process.Processes()
	if err != nil {
		return nil
	}
	res := make([]ProcessInfo, 0, 16)
	for _, p := range ps {
		name, _ := p.Name()
		cmdline, _ := p.Cmdline()
		exe, _ := p.Exe()
		if !isJavaProcess(name, cmdline, exe) {
			continue
		}
		c, _ := p.CPUPercent()
		m, _ := p.MemoryPercent()
		t, _ := p.NumThreads()
		res = append(res, ProcessInfo{
			PID:     p.Pid,
			Name:    name,
			CPU:     c,
			Memory:  m,
			Threads: t,
			Cmdline: trim(cmdline, 180),
			ExePath: trim(exe, 160),
			IsJVM:   true,
		})
	}
	sortByCPUDesc(res)
	if limit > 0 && len(res) > limit {
		res = res[:limit]
	}
	return res
}

func isJavaProcess(name, cmdline, exe string) bool {
	low := strings.ToLower(name + " " + cmdline + " " + exe)
	return strings.Contains(low, "java")
}

func sortByCPUDesc(items []ProcessInfo) {
	sort.Slice(items, func(i, j int) bool {
		return items[i].CPU > items[j].CPU
	})
}

func trim(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

func hydrateProcessCatalogEntry(pid int32, entry processCatalogEntry) processCatalogEntry {
	if pid <= 0 {
		return entry
	}
	if strings.TrimSpace(entry.Name) != "" && strings.TrimSpace(entry.ExePath) != "" {
		return entry
	}
	p, err := process.NewProcess(pid)
	if err != nil {
		if strings.TrimSpace(entry.ExePath) == "" {
			entry.ExePath = extractExecutableFromCmdline(entry.Cmdline)
		}
		return entry
	}
	if strings.TrimSpace(entry.Name) == "" {
		if name, err := p.Name(); err == nil {
			entry.Name = name
		}
	}
	if strings.TrimSpace(entry.Cmdline) == "" {
		if cmdline, err := p.Cmdline(); err == nil {
			entry.Cmdline = cmdline
		}
	}
	if strings.TrimSpace(entry.ExePath) == "" {
		if exe, err := p.Exe(); err == nil {
			entry.ExePath = exe
		}
	}
	if strings.TrimSpace(entry.ExePath) == "" {
		entry.ExePath = extractExecutableFromCmdline(entry.Cmdline)
	}
	if strings.TrimSpace(entry.Name) == "" && strings.TrimSpace(entry.ExePath) != "" {
		entry.Name = filepath.Base(entry.ExePath)
	}
	return entry
}

func extractExecutableFromCmdline(cmdline string) string {
	s := strings.TrimSpace(cmdline)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(s, "\"") {
		rest := s[1:]
		if idx := strings.Index(rest, "\""); idx >= 0 {
			return strings.TrimSpace(rest[:idx])
		}
	}
	fields := strings.Fields(s)
	if len(fields) == 0 {
		return ""
	}
	return strings.Trim(fields[0], "\"")
}

func normalizePortPath(exePath, processName string, pid int32) string {
	path := strings.TrimSpace(exePath)
	if path != "" {
		return path
	}
	name := strings.TrimSpace(processName)
	if name != "" {
		return fmt.Sprintf("%s%s", name, "\uFF08\u8DEF\u5F84\u53D7\u9650\uFF09")
	}
	if pid <= 0 {
		return "\u7CFB\u7EDF\u8FDB\u7A0B\uFF08\u8DEF\u5F84\u53D7\u9650\uFF09"
	}
	return fmt.Sprintf("PID-%d%s", pid, "\uFF08\u8DEF\u5F84\u53D7\u9650\uFF09")
}

func checkTCP(addr string, timeout time.Duration) (bool, string) {
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false, err.Error()
	}
	_ = conn.Close()
	return true, "ok"
}
