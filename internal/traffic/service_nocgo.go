//go:build !cgo

package traffic

import (
	"fmt"
	"net"
	"sort"
	"strings"
	"time"
)

type Manager struct{}

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
	return &Manager{}
}

func (m *Manager) Shutdown() {
}

func (m *Manager) Interfaces() []InterfaceInfo {
	return []InterfaceInfo{}
}

func (m *Manager) StartCapture(interfaceName, captureFilter string) error {
	return fmt.Errorf("当前构建未启用流量抓包能力（需安装 CGO/libpcap）")
}

func (m *Manager) StopCapture() {
}

func (m *Manager) Snapshot(limitPackets, limitMessages int) Snapshot {
	return Snapshot{
		Status: CaptureStatus{
			Supported:         false,
			InterfacesLoaded:  false,
			Active:            false,
			InterfaceName:     "",
			CaptureFilter:     "",
			StartedAt:         time.Time{},
			Error:             "当前构建未启用流量抓包能力（需安装 CGO/libpcap）",
			PacketCount:       0,
			HTTPMessageCount:  0,
			Connections:       0,
			LocalAddresses:    collectLocalIPList(),
			PermissionGranted: false,
		},
		Interfaces:  []InterfaceInfo{},
		Connections: []ConnectionRow{},
		Packets:     []PacketEntry{},
		HTTP:        []HTTPMessage{},
	}
}

func collectLocalIPList() []string {
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
	result := make([]string, 0, len(out))
	for key := range out {
		if strings.TrimSpace(key) == "" {
			continue
		}
		result = append(result, key)
	}
	sort.Strings(result)
	return result
}
