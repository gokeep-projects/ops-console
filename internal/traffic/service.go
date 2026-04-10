package traffic

import (
	"fmt"
	"net"
	"sort"
	"strings"
	"time"

	netio "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

const (
	defaultCaptureFilter = "tcp or udp"
	unsupportedReason    = "数据包抓包功能已下线，仅保留连接态流量监控。"
)

type Manager struct {
	hostIPs map[string]struct{}
}

type InterfaceInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Addresses   []string `json:"addresses"`
	Loopback    bool     `json:"loopback"`
	Up          bool     `json:"up"`
	Selected    bool     `json:"selected"`
}

type CaptureStatus struct {
	Supported         bool      `json:"supported"`
	InterfacesLoaded  bool      `json:"interfaces_loaded"`
	Active            bool      `json:"active"`
	InterfaceName     string    `json:"interface_name"`
	CaptureFilter     string    `json:"capture_filter"`
	StartedAt         time.Time `json:"started_at"`
	Error             string    `json:"error"`
	PacketCount       int       `json:"packet_count"`
	HTTPMessageCount  int       `json:"http_message_count"`
	Connections       int       `json:"connections"`
	LocalAddresses    []string  `json:"local_addresses"`
	PermissionGranted bool      `json:"permission_granted"`
}

type ConnectionRow struct {
	PID           int32     `json:"pid"`
	ProcessName   string    `json:"process_name"`
	ExePath       string    `json:"exe_path"`
	Protocol      string    `json:"protocol"`
	Status        string    `json:"status"`
	LocalIP       string    `json:"local_ip"`
	LocalPort     uint32    `json:"local_port"`
	RemoteIP      string    `json:"remote_ip"`
	RemotePort    uint32    `json:"remote_port"`
	ConnectionKey string    `json:"connection_key"`
	Connections   int       `json:"connections"`
	BytesIn       uint64    `json:"bytes_in"`
	BytesOut      uint64    `json:"bytes_out"`
	PacketsIn     uint64    `json:"packets_in"`
	PacketsOut    uint64    `json:"packets_out"`
	LastSeen      time.Time `json:"last_seen"`
}

type PacketEntry struct {
	ID             string    `json:"id"`
	Timestamp      time.Time `json:"timestamp"`
	PID            int32     `json:"pid"`
	ProcessName    string    `json:"process_name"`
	ExePath        string    `json:"exe_path"`
	Direction      string    `json:"direction"`
	Protocol       string    `json:"protocol"`
	AppProtocol    string    `json:"app_protocol"`
	SrcIP          string    `json:"src_ip"`
	SrcPort        uint16    `json:"src_port"`
	DstIP          string    `json:"dst_ip"`
	DstPort        uint16    `json:"dst_port"`
	Length         int       `json:"length"`
	Info           string    `json:"info"`
	PayloadPreview string    `json:"payload_preview"`
	DecodedText    string    `json:"decoded_text"`
	HTTPS          bool      `json:"https"`
}

type HTTPMessage struct {
	ID                string            `json:"id"`
	Timestamp         time.Time         `json:"timestamp"`
	PID               int32             `json:"pid"`
	ProcessName       string            `json:"process_name"`
	ExePath           string            `json:"exe_path"`
	Direction         string            `json:"direction"`
	Method            string            `json:"method"`
	URL               string            `json:"url"`
	Host              string            `json:"host"`
	StatusCode        int               `json:"status_code"`
	Status            string            `json:"status"`
	Protocol          string            `json:"protocol"`
	ContentType       string            `json:"content_type"`
	Headers           map[string]string `json:"headers"`
	Body              string            `json:"body"`
	Raw               string            `json:"raw"`
	UnsupportedReason string            `json:"unsupported_reason"`
}

type Snapshot struct {
	Status      CaptureStatus   `json:"status"`
	Interfaces  []InterfaceInfo `json:"interfaces"`
	Connections []ConnectionRow `json:"connections"`
	Packets     []PacketEntry   `json:"packets"`
	HTTP        []HTTPMessage   `json:"http"`
}

func NewManager() *Manager {
	return &Manager{hostIPs: collectLocalIPSet()}
}

func (m *Manager) Shutdown() {}

func (m *Manager) Snapshot(_ int, _ int) Snapshot {
	connections := collectConnectionRows()
	return Snapshot{
		Status: CaptureStatus{
			Supported:         false,
			InterfacesLoaded:  false,
			Active:            false,
			InterfaceName:     "",
			CaptureFilter:     defaultCaptureFilter,
			StartedAt:         time.Time{},
			Error:             unsupportedReason,
			PacketCount:       0,
			HTTPMessageCount:  0,
			Connections:       len(connections),
			LocalAddresses:    sortedKeys(m.hostIPs),
			PermissionGranted: false,
		},
		Interfaces:  []InterfaceInfo{},
		Connections: connections,
		Packets:     []PacketEntry{},
		HTTP:        []HTTPMessage{},
	}
}

func collectConnectionRows() []ConnectionRow {
	items, err := netio.Connections("inet")
	if err != nil {
		return []ConnectionRow{}
	}
	now := time.Now()
	pidCache := map[int32]procMeta{}
	rows := make([]ConnectionRow, 0, len(items))
	for _, item := range items {
		protocol := protoName(item.Type)
		if protocol == "" {
			continue
		}
		meta := resolveProcMeta(item.Pid, pidCache)
		rows = append(rows, ConnectionRow{
			PID:           item.Pid,
			ProcessName:   meta.Name,
			ExePath:       meta.ExePath,
			Protocol:      protocol,
			Status:        item.Status,
			LocalIP:       item.Laddr.IP,
			LocalPort:     item.Laddr.Port,
			RemoteIP:      item.Raddr.IP,
			RemotePort:    item.Raddr.Port,
			ConnectionKey: connectionKey(protocol, item.Laddr.IP, item.Laddr.Port, item.Raddr.IP, item.Raddr.Port),
			Connections:   1,
			BytesIn:       0,
			BytesOut:      0,
			PacketsIn:     0,
			PacketsOut:    0,
			LastSeen:      now,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		if rows[i].ProcessName != rows[j].ProcessName {
			return rows[i].ProcessName < rows[j].ProcessName
		}
		if rows[i].PID != rows[j].PID {
			return rows[i].PID < rows[j].PID
		}
		if rows[i].LocalPort != rows[j].LocalPort {
			return rows[i].LocalPort < rows[j].LocalPort
		}
		return rows[i].RemotePort < rows[j].RemotePort
	})
	return rows
}

type procMeta struct {
	Name    string
	ExePath string
}

func resolveProcMeta(pid int32, cache map[int32]procMeta) procMeta {
	if item, ok := cache[pid]; ok {
		return item
	}
	meta := procMeta{Name: "-", ExePath: "-"}
	if pid <= 0 {
		meta.Name = "内核/系统"
		cache[pid] = meta
		return meta
	}
	if p, err := process.NewProcess(pid); err == nil {
		name, _ := p.Name()
		exe, _ := p.Exe()
		if strings.TrimSpace(name) != "" {
			meta.Name = name
		}
		if strings.TrimSpace(exe) != "" {
			meta.ExePath = exe
		}
	}
	if strings.TrimSpace(meta.Name) == "" || meta.Name == "-" {
		meta.Name = fmt.Sprintf("PID-%d", pid)
	}
	cache[pid] = meta
	return meta
}

func protoName(typ uint32) string {
	switch typ {
	case 1:
		return "tcp"
	case 2:
		return "udp"
	default:
		return ""
	}
}

func connectionKey(protocol, localIP string, localPort uint32, remoteIP string, remotePort uint32) string {
	return fmt.Sprintf("%s|%s|%d|%s|%d", strings.ToLower(strings.TrimSpace(protocol)), strings.TrimSpace(localIP), localPort, strings.TrimSpace(remoteIP), remotePort)
}

func collectLocalIPSet() map[string]struct{} {
	out := map[string]struct{}{
		"127.0.0.1": {},
		"::1":       {},
	}
	items, _ := net.Interfaces()
	for _, nic := range items {
		addrs, _ := nic.Addrs()
		for _, addr := range addrs {
			host := strings.Split(addr.String(), "/")[0]
			host = strings.TrimSpace(host)
			if host != "" {
				out[host] = struct{}{}
			}
		}
	}
	return out
}

func sortedKeys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for key := range m {
		if strings.TrimSpace(key) == "" {
			continue
		}
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}
