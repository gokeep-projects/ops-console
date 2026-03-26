package monitor

import (
	"bytes"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
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

type GPUCardInfo struct {
	Name          string `json:"name"`
	Vendor        string `json:"vendor"`
	DriverVersion string `json:"driver_version"`
	MemoryMB      uint64 `json:"memory_mb"`
	DeviceID      string `json:"device_id"`
}

type NetworkAdapterInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	MACAddress  string `json:"mac_address"`
	SpeedMbps   uint64 `json:"speed_mbps"`
	AdapterType string `json:"adapter_type"`
	Status      string `json:"status"`
}

type staticHardwareMeta struct {
	CPUModel        string
	CPUArch         string
	CPUFrequencyMHz float64
	MemoryModules   []MemoryModule
	DiskHardware    []DiskHardwareInfo
	GPUCards        []GPUCardInfo
	NetworkAdapters []NetworkAdapterInfo
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
	out.GPUCards = append([]GPUCardInfo(nil), in.GPUCards...)
	out.NetworkAdapters = append([]NetworkAdapterInfo(nil), in.NetworkAdapters...)
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
		GPUCards:        detectGPUCards(),
		NetworkAdapters: detectNetworkAdapters(),
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
	case "linux":
		return detectLinuxMemoryModules()
	case "darwin":
		return detectDarwinMemoryModules()
	default:
		return detectFallbackMemoryModules()
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

func detectLinuxMemoryModules() []MemoryModule {
	// Linux usually cannot read per-module DIMM details without elevated privileges.
	return detectFallbackMemoryModules()
}

func detectDarwinMemoryModules() []MemoryModule {
	cmd := exec.Command("system_profiler", "SPMemoryDataType", "-json")
	raw, err := cmd.Output()
	if err != nil {
		return detectFallbackMemoryModules()
	}

	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return detectFallbackMemoryModules()
	}
	nodes := flattenMapNodes(root)
	out := make([]MemoryModule, 0, 8)
	for _, node := range nodes {
		sizeText := strings.TrimSpace(toString(node["dimm_size"]))
		if sizeText == "" || strings.EqualFold(sizeText, "empty") {
			continue
		}
		out = append(out, MemoryModule{
			Manufacturer: strings.TrimSpace(toString(node["dimm_manufacturer"])),
			Model:        strings.TrimSpace(toString(node["dimm_part_number"])),
			FrequencyMHz: parseFrequencyMHz(toString(node["dimm_speed"])),
			Capacity:     parseSizeToBytes(sizeText),
			Serial:       strings.TrimSpace(toString(node["dimm_serial_number"])),
		})
	}
	if len(out) == 0 {
		return detectFallbackMemoryModules()
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Capacity == out[j].Capacity {
			return out[i].Model < out[j].Model
		}
		return out[i].Capacity > out[j].Capacity
	})
	return out
}

func detectFallbackMemoryModules() []MemoryModule {
	vm, err := mem.VirtualMemory()
	if err != nil || vm.Total == 0 {
		return nil
	}
	return []MemoryModule{
		{
			Manufacturer: "-",
			Model:        "总内存",
			FrequencyMHz: 0,
			Capacity:     vm.Total,
			Serial:       "-",
		},
	}
}

func detectDiskHardware() []DiskHardwareInfo {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsDiskHardware()
	case "linux":
		return detectLinuxDiskHardware()
	case "darwin":
		return detectDarwinDiskHardware()
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

func detectLinuxDiskHardware() []DiskHardwareInfo {
	entries, err := os.ReadDir("/sys/block")
	if err != nil {
		return nil
	}
	out := make([]DiskHardwareInfo, 0, len(entries))
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name())
		if name == "" || strings.HasPrefix(name, "loop") || strings.HasPrefix(name, "ram") {
			continue
		}
		base := filepath.Join("/sys/block", name)
		model := strings.TrimSpace(readText(filepath.Join(base, "device", "model")))
		vendor := strings.TrimSpace(readText(filepath.Join(base, "device", "vendor")))
		if vendor != "" && model != "" && !strings.Contains(strings.ToLower(model), strings.ToLower(vendor)) {
			model = vendor + " " + model
		}
		serial := strings.TrimSpace(readText(filepath.Join(base, "device", "serial")))
		size := parseUint64(strings.TrimSpace(readText(filepath.Join(base, "size")))) * 512
		media := "-"
		switch strings.TrimSpace(readText(filepath.Join(base, "queue", "rotational"))) {
		case "0":
			media = "SSD/NVMe"
		case "1":
			media = "HDD"
		}
		iface := detectLinuxDiskInterface(base)

		out = append(out, DiskHardwareInfo{
			Name:      "/dev/" + name,
			Model:     nonEmpty(model, name),
			Serial:    nonEmpty(serial, "-"),
			Interface: iface,
			MediaType: media,
			Size:      size,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func detectLinuxDiskInterface(base string) string {
	link, err := os.Readlink(base)
	if err != nil {
		return "-"
	}
	low := strings.ToLower(link)
	switch {
	case strings.Contains(low, "nvme"):
		return "NVMe"
	case strings.Contains(low, "virtio"):
		return "VirtIO"
	case strings.Contains(low, "usb"):
		return "USB"
	case strings.Contains(low, "sata"), strings.Contains(low, "ata"):
		return "SATA"
	case strings.Contains(low, "scsi"):
		return "SCSI"
	default:
		return "-"
	}
}

func detectDarwinDiskHardware() []DiskHardwareInfo {
	cmd := exec.Command("system_profiler", "SPStorageDataType", "-json")
	raw, err := cmd.Output()
	if err != nil {
		return nil
	}
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil
	}
	nodes := flattenMapNodes(root)
	out := make([]DiskHardwareInfo, 0, 8)
	seen := map[string]struct{}{}
	for _, node := range nodes {
		model := strings.TrimSpace(nonEmpty(toString(node["device_model"]), toString(node["physical_drive"])))
		name := strings.TrimSpace(nonEmpty(toString(node["bsd_name"]), toString(node["_name"])))
		size := toUint64(node["size_in_bytes"])
		if name == "" && model == "" && size == 0 {
			continue
		}
		key := name + "|" + model
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}

		out = append(out, DiskHardwareInfo{
			Name:      nonEmpty(name, "-"),
			Model:     nonEmpty(model, "-"),
			Serial:    nonEmpty(strings.TrimSpace(toString(node["serial_num"])), "-"),
			Interface: nonEmpty(strings.TrimSpace(toString(node["protocol"])), "-"),
			MediaType: nonEmpty(strings.TrimSpace(toString(node["medium_type"])), "-"),
			Size:      size,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func detectGPUCards() []GPUCardInfo {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsGPUCards()
	case "linux":
		return detectLinuxGPUCards()
	case "darwin":
		return detectDarwinGPUCards()
	default:
		return nil
	}
}

type win32VideoController struct {
	Name                 string  `json:"Name"`
	AdapterCompatibility string  `json:"AdapterCompatibility"`
	DriverVersion        string  `json:"DriverVersion"`
	AdapterRAM           *uint64 `json:"AdapterRAM"`
	PNPDeviceID          string  `json:"PNPDeviceID"`
}

func detectWindowsGPUCards() []GPUCardInfo {
	script := "$ErrorActionPreference='SilentlyContinue'; " +
		"Get-CimInstance Win32_VideoController | " +
		"Select-Object Name,AdapterCompatibility,DriverVersion,AdapterRAM,PNPDeviceID | " +
		"ConvertTo-Json -Compress"
	raw, err := runPowerShellJSON(script)
	if err != nil {
		return nil
	}
	list, err := decodeJSONList[win32VideoController](raw)
	if err != nil {
		return nil
	}

	out := make([]GPUCardInfo, 0, len(list))
	for _, item := range list {
		name := strings.TrimSpace(item.Name)
		vendor := strings.TrimSpace(item.AdapterCompatibility)
		driver := strings.TrimSpace(item.DriverVersion)
		deviceID := strings.TrimSpace(item.PNPDeviceID)
		memoryMB := uint64(0)
		if item.AdapterRAM != nil && *item.AdapterRAM > 0 {
			memoryMB = *item.AdapterRAM / (1024 * 1024)
		}

		if name == "" && vendor == "" && driver == "" && memoryMB == 0 && deviceID == "" {
			continue
		}
		out = append(out, GPUCardInfo{
			Name:          name,
			Vendor:        vendor,
			DriverVersion: driver,
			MemoryMB:      memoryMB,
			DeviceID:      deviceID,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out
}

func detectLinuxGPUCards() []GPUCardInfo {
	entries, err := os.ReadDir("/sys/class/drm")
	if err != nil {
		return nil
	}
	out := make([]GPUCardInfo, 0, 4)
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name())
		if !strings.HasPrefix(name, "card") || strings.Contains(name, "-") {
			continue
		}
		base := filepath.Join("/sys/class/drm", name, "device")
		vendorID := strings.ToLower(strings.TrimSpace(readText(filepath.Join(base, "vendor"))))
		deviceID := strings.ToLower(strings.TrimSpace(readText(filepath.Join(base, "device"))))
		driver := "-"
		if link, err := os.Readlink(filepath.Join(base, "driver")); err == nil {
			driver = filepath.Base(link)
		}
		memoryMB := parseUint64(strings.TrimSpace(readText(filepath.Join(base, "mem_info_vram_total")))) / 1024 / 1024
		vendor := mapPCIVendor(vendorID)
		displayName := strings.TrimSpace(nonEmpty(vendor, "GPU"))
		if deviceID != "" {
			displayName = strings.TrimSpace(displayName + " " + deviceID)
		}
		out = append(out, GPUCardInfo{
			Name:          displayName,
			Vendor:        nonEmpty(vendor, "-"),
			DriverVersion: nonEmpty(driver, "-"),
			MemoryMB:      memoryMB,
			DeviceID:      strings.TrimPrefix(strings.TrimPrefix(deviceID, "0x"), "0X"),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func detectDarwinGPUCards() []GPUCardInfo {
	cmd := exec.Command("system_profiler", "SPDisplaysDataType", "-json")
	raw, err := cmd.Output()
	if err != nil {
		return nil
	}
	var root map[string]any
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil
	}
	nodes := flattenMapNodes(root)
	out := make([]GPUCardInfo, 0, 4)
	seen := map[string]struct{}{}
	for _, node := range nodes {
		name := strings.TrimSpace(nonEmpty(toString(node["sppci_model"]), toString(node["_name"])))
		vendor := strings.TrimSpace(nonEmpty(toString(node["spdisplays_vendor"]), toString(node["sppci_vendor"])))
		if name == "" && vendor == "" {
			continue
		}
		key := name + "|" + vendor
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		vram := strings.TrimSpace(toString(node["spdisplays_vram"]))
		if vram == "" {
			vram = strings.TrimSpace(toString(node["spdisplays_vram_shared"]))
		}
		out = append(out, GPUCardInfo{
			Name:          nonEmpty(name, "GPU"),
			Vendor:        nonEmpty(vendor, "-"),
			DriverVersion: "-",
			MemoryMB:      parseMemoryMB(vram),
			DeviceID:      strings.TrimSpace(toString(node["spdisplays_device-id"])),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func detectNetworkAdapters() []NetworkAdapterInfo {
	switch runtime.GOOS {
	case "windows":
		return detectWindowsNetworkAdapters()
	case "linux":
		return detectLinuxNetworkAdapters()
	case "darwin":
		return detectDarwinNetworkAdapters()
	default:
		return detectBasicNetworkAdapters()
	}
}

type win32NetworkAdapter struct {
	Name                 string  `json:"Name"`
	InterfaceDescription string  `json:"InterfaceDescription"`
	MACAddress           string  `json:"MACAddress"`
	Speed                *uint64 `json:"Speed"`
	AdapterType          string  `json:"AdapterType"`
	NetEnabled           *bool   `json:"NetEnabled"`
	NetConnectionID      string  `json:"NetConnectionID"`
	NetConnectionStatus  *int32  `json:"NetConnectionStatus"`
}

func detectWindowsNetworkAdapters() []NetworkAdapterInfo {
	script := "$ErrorActionPreference='SilentlyContinue'; " +
		"Get-CimInstance Win32_NetworkAdapter | " +
		"Where-Object { ($_.NetEnabled -eq $true) -or ($_.PhysicalAdapter -eq $true) } | " +
		"Select-Object Name,InterfaceDescription,MACAddress,Speed,AdapterType,NetEnabled,NetConnectionID,NetConnectionStatus | " +
		"ConvertTo-Json -Compress"
	raw, err := runPowerShellJSON(script)
	if err != nil {
		return detectBasicNetworkAdapters()
	}
	list, err := decodeJSONList[win32NetworkAdapter](raw)
	if err != nil {
		return detectBasicNetworkAdapters()
	}

	out := make([]NetworkAdapterInfo, 0, len(list))
	for _, item := range list {
		name := strings.TrimSpace(item.NetConnectionID)
		if name == "" {
			name = strings.TrimSpace(item.Name)
		}
		desc := strings.TrimSpace(item.InterfaceDescription)
		if desc == "" {
			desc = strings.TrimSpace(item.Name)
		}
		mac := strings.TrimSpace(item.MACAddress)
		adapterType := strings.TrimSpace(item.AdapterType)
		status := localizeNetConnectionStatus(item.NetConnectionStatus, item.NetEnabled)
		speedMbps := normalizeAdapterSpeedMbps(item.Speed)
		if name == "" && desc == "" && mac == "" && speedMbps == 0 {
			continue
		}
		out = append(out, NetworkAdapterInfo{
			Name:        name,
			Description: desc,
			MACAddress:  mac,
			SpeedMbps:   speedMbps,
			AdapterType: adapterType,
			Status:      status,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Status == out[j].Status {
			return out[i].Name < out[j].Name
		}
		return out[i].Status < out[j].Status
	})
	if len(out) == 0 {
		return detectBasicNetworkAdapters()
	}
	return out
}

func detectLinuxNetworkAdapters() []NetworkAdapterInfo {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]NetworkAdapterInfo, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.TrimSpace(iface.Name)
		if name == "" {
			continue
		}
		base := filepath.Join("/sys/class/net", name)
		status := "未连接"
		switch strings.TrimSpace(readText(filepath.Join(base, "operstate"))) {
		case "up":
			status = "已连接"
		case "dormant":
			status = "连接中"
		}
		speed := parseUint64(strings.TrimSpace(readText(filepath.Join(base, "speed"))))
		if speed > 400_000 {
			speed = 0
		}
		out = append(out, NetworkAdapterInfo{
			Name:        name,
			Description: name,
			MACAddress:  strings.TrimSpace(iface.HardwareAddr.String()),
			SpeedMbps:   speed,
			AdapterType: linuxNICType(strings.TrimSpace(readText(filepath.Join(base, "type")))),
			Status:      status,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func detectDarwinNetworkAdapters() []NetworkAdapterInfo {
	portMap := map[string]string{}
	cmd := exec.Command("networksetup", "-listallhardwareports")
	raw, err := cmd.Output()
	if err == nil {
		lines := strings.Split(string(raw), "\n")
		currentPort := ""
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "Hardware Port:") {
				currentPort = strings.TrimSpace(strings.TrimPrefix(line, "Hardware Port:"))
				continue
			}
			if strings.HasPrefix(line, "Device:") {
				dev := strings.TrimSpace(strings.TrimPrefix(line, "Device:"))
				if dev != "" && currentPort != "" {
					portMap[dev] = currentPort
				}
			}
		}
	}

	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]NetworkAdapterInfo, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.TrimSpace(iface.Name)
		if name == "" {
			continue
		}
		status := "未连接"
		if iface.Flags&net.FlagUp != 0 {
			status = "已连接"
		}
		desc := nonEmpty(portMap[name], name)
		out = append(out, NetworkAdapterInfo{
			Name:        desc,
			Description: name,
			MACAddress:  strings.TrimSpace(iface.HardwareAddr.String()),
			SpeedMbps:   0,
			AdapterType: resolveDarwinNICType(desc),
			Status:      status,
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func localizeNetConnectionStatus(raw *int32, netEnabled *bool) string {
	if netEnabled != nil {
		if *netEnabled {
			return "已连接"
		}
		return "未连接"
	}
	if raw == nil {
		return "未知"
	}
	switch *raw {
	case 0:
		return "已断开"
	case 1:
		return "连接中"
	case 2:
		return "已连接"
	case 3:
		return "断开中"
	case 4:
		return "硬件异常"
	case 5:
		return "硬件禁用"
	case 6:
		return "认证异常"
	case 7:
		return "凭据异常"
	case 8:
		return "认证中"
	case 9:
		return "凭据校验中"
	default:
		return "未知"
	}
}

func normalizeAdapterSpeedMbps(raw *uint64) uint64 {
	if raw == nil || *raw == 0 {
		return 0
	}
	bps := *raw
	if bps > 400_000_000_000 {
		return 0
	}
	mbps := bps / 1_000_000
	if mbps > 400_000 {
		return 0
	}
	return mbps
}

func detectBasicNetworkAdapters() []NetworkAdapterInfo {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	out := make([]NetworkAdapterInfo, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.TrimSpace(iface.Name)
		if name == "" {
			continue
		}
		mac := strings.TrimSpace(iface.HardwareAddr.String())
		status := "未连接"
		if iface.Flags&net.FlagUp != 0 {
			status = "已连接"
		}
		out = append(out, NetworkAdapterInfo{
			Name:        name,
			Description: name,
			MACAddress:  mac,
			SpeedMbps:   0,
			AdapterType: "-",
			Status:      status,
		})
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out
}

func readText(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func parseUint64(raw string) uint64 {
	v := strings.TrimSpace(raw)
	if v == "" {
		return 0
	}
	n, err := strconv.ParseUint(v, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func nonEmpty(items ...string) string {
	for _, item := range items {
		v := strings.TrimSpace(item)
		if v != "" {
			return v
		}
	}
	return ""
}

func flattenMapNodes(root map[string]any) []map[string]any {
	out := make([]map[string]any, 0, 32)
	var walk func(node any)
	walk = func(node any) {
		switch v := node.(type) {
		case map[string]any:
			out = append(out, v)
			for _, vv := range v {
				walk(vv)
			}
		case []any:
			for _, vv := range v {
				walk(vv)
			}
		}
	}
	walk(root)
	return out
}

func toString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case json.Number:
		return x.String()
	default:
		if x == nil {
			return ""
		}
		return strings.TrimSpace(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(strings.TrimSpace(toJSONText(x))), "\"", ""), "\n", " "))
	}
}

func toJSONText(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

func toUint64(v any) uint64 {
	switch x := v.(type) {
	case uint64:
		return x
	case uint32:
		return uint64(x)
	case int64:
		if x < 0 {
			return 0
		}
		return uint64(x)
	case int:
		if x < 0 {
			return 0
		}
		return uint64(x)
	case float64:
		if x < 0 {
			return 0
		}
		return uint64(x)
	case json.Number:
		n, _ := x.Int64()
		if n < 0 {
			return 0
		}
		return uint64(n)
	case string:
		return parseUint64(x)
	default:
		return parseUint64(toString(v))
	}
}

func parseFrequencyMHz(raw string) uint32 {
	v := strings.ToLower(strings.TrimSpace(raw))
	if v == "" {
		return 0
	}
	for _, token := range strings.Fields(v) {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		if strings.HasSuffix(token, "mhz") {
			token = strings.TrimSuffix(token, "mhz")
		}
		if strings.HasSuffix(token, "ghz") {
			token = strings.TrimSuffix(token, "ghz")
			f, err := strconv.ParseFloat(token, 64)
			if err == nil && f > 0 {
				return uint32(f * 1000)
			}
			continue
		}
		n, err := strconv.ParseFloat(token, 64)
		if err == nil && n > 0 {
			if n < 10 {
				return uint32(n * 1000)
			}
			return uint32(n)
		}
	}
	return 0
}

func parseSizeToBytes(raw string) uint64 {
	v := strings.ToUpper(strings.TrimSpace(raw))
	if v == "" {
		return 0
	}
	fields := strings.Fields(v)
	if len(fields) == 0 {
		return 0
	}
	num, err := strconv.ParseFloat(strings.TrimSpace(fields[0]), 64)
	if err != nil || num <= 0 {
		return 0
	}
	unit := ""
	if len(fields) > 1 {
		unit = fields[1]
	}
	switch unit {
	case "TB", "TIB":
		num *= 1024 * 1024 * 1024 * 1024
	case "GB", "GIB":
		num *= 1024 * 1024 * 1024
	case "MB", "MIB":
		num *= 1024 * 1024
	case "KB", "KIB":
		num *= 1024
	case "B":
	default:
		if strings.Contains(v, "TB") {
			num *= 1024 * 1024 * 1024 * 1024
		} else if strings.Contains(v, "GB") {
			num *= 1024 * 1024 * 1024
		} else if strings.Contains(v, "MB") {
			num *= 1024 * 1024
		} else if strings.Contains(v, "KB") {
			num *= 1024
		}
	}
	if num < 0 {
		return 0
	}
	return uint64(num)
}

func parseMemoryMB(raw string) uint64 {
	b := parseSizeToBytes(raw)
	if b == 0 {
		return 0
	}
	return b / 1024 / 1024
}

func mapPCIVendor(vendorID string) string {
	switch strings.ToLower(strings.TrimSpace(vendorID)) {
	case "0x10de":
		return "NVIDIA"
	case "0x1002", "0x1022":
		return "AMD"
	case "0x8086":
		return "Intel"
	case "0x1af4":
		return "VirtIO"
	default:
		return "未知厂商"
	}
}

func linuxNICType(raw string) string {
	switch strings.TrimSpace(raw) {
	case "1":
		return "以太网"
	case "801":
		return "Wi-Fi"
	default:
		return "-"
	}
}

func resolveDarwinNICType(desc string) string {
	v := strings.ToLower(strings.TrimSpace(desc))
	switch {
	case strings.Contains(v, "wi-fi"), strings.Contains(v, "wifi"), strings.Contains(v, "airport"):
		return "Wi-Fi"
	case strings.Contains(v, "ethernet"):
		return "以太网"
	default:
		return "-"
	}
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

func detectPrimaryNetworkIPv4() (string, string, string) {
	type candidate struct {
		name  string
		ip    string
		mac   string
		score int
	}

	best := candidate{score: -1}
	interfaces, err := net.Interfaces()
	if err != nil {
		return "", "", ""
	}

	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		nameLower := strings.ToLower(strings.TrimSpace(iface.Name))
		if isVirtualNIC(nameLower) {
			continue
		}

		baseScore := 20
		if isEthernetNIC(nameLower) {
			baseScore = 60
		} else if isWirelessNIC(nameLower) {
			baseScore = 45
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
					mac:   strings.TrimSpace(iface.HardwareAddr.String()),
					score: score,
				}
			}
		}
	}

	if best.score < 0 {
		return "", "", ""
	}
	return best.ip, best.name, best.mac
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
