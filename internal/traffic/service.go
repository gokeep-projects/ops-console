//go:build cgo

package traffic

import (
	"bufio"
	"context"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/gopacket"
	"github.com/google/gopacket/layers"
	"github.com/google/gopacket/pcap"
	"github.com/google/gopacket/tcpassembly"
	"github.com/google/gopacket/tcpassembly/tcpreader"
	netio "github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

const (
	defaultPacketLimit   = 1200
	defaultMessageLimit  = 300
	maxHTTPBodyBytes     = 64 << 10
	defaultCaptureFilter = "tcp or udp"
)

type Manager struct {
	mu sync.RWMutex

	hostIPs map[string]struct{}

	session *captureSession
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

type captureSession struct {
	mu sync.RWMutex

	handle        *pcap.Handle
	iface         InterfaceInfo
	startedAt     time.Time
	lastError     string
	localIPs      map[string]struct{}
	connMap       map[string]connMeta
	flowStats     map[string]*flowStat
	packets       []PacketEntry
	httpMessages  []HTTPMessage
	permissionOK  bool
	stopCtx       context.Context
	stopFn        context.CancelFunc
	wg            sync.WaitGroup
	packetLimit   int
	messageLimit  int
	captureFilter string
	assembler     *tcpassembly.Assembler
	streamPool    *tcpassembly.StreamPool
}

type connMeta struct {
	Key         string
	PID         int32
	ProcessName string
	ExePath     string
	LocalIP     string
	LocalPort   uint32
	RemoteIP    string
	RemotePort  uint32
	Status      string
	Protocol    string
}

type flowStat struct {
	PacketsIn  uint64
	PacketsOut uint64
	BytesIn    uint64
	BytesOut   uint64
	LastSeen   time.Time
}

type httpStreamFactory struct {
	session *captureSession
}

type httpStream struct {
	net, transport gopacket.Flow
	reader         tcpreader.ReaderStream
	session        *captureSession
}

func NewManager() *Manager {
	return &Manager{
		hostIPs: collectLocalIPSet(),
	}
}

func (m *Manager) Shutdown() {
	m.StopCapture()
}

func (m *Manager) Interfaces() []InterfaceInfo {
	list := listInterfaces()
	m.mu.RLock()
	activeName := ""
	if m.session != nil {
		activeName = m.session.iface.Name
	}
	m.mu.RUnlock()
	for i := range list {
		list[i].Selected = strings.EqualFold(strings.TrimSpace(list[i].Name), strings.TrimSpace(activeName))
	}
	return list
}

func (m *Manager) StartCapture(interfaceName, captureFilter string) error {
	m.StopCapture()

	iface, err := pickInterface(interfaceName)
	if err != nil {
		return err
	}

	captureFilter = strings.TrimSpace(captureFilter)
	if captureFilter == "" {
		captureFilter = defaultCaptureFilter
	}

	handle, err := pcap.OpenLive(iface.Name, 65535, true, pcap.BlockForever)
	if err != nil {
		return fmt.Errorf("open capture interface failed: %w", err)
	}
	if err := handle.SetBPFFilter(captureFilter); err != nil {
		handle.Close()
		return fmt.Errorf("apply capture filter failed: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	session := &captureSession{
		handle:        handle,
		iface:         iface,
		startedAt:     time.Now(),
		localIPs:      collectLocalIPSet(),
		connMap:       map[string]connMeta{},
		flowStats:     map[string]*flowStat{},
		packetLimit:   defaultPacketLimit,
		messageLimit:  defaultMessageLimit,
		permissionOK:  true,
		captureFilter: captureFilter,
		stopCtx:       ctx,
		stopFn:        cancel,
	}
	factory := &httpStreamFactory{session: session}
	session.streamPool = tcpassembly.NewStreamPool(factory)
	session.assembler = tcpassembly.NewAssembler(session.streamPool)

	session.refreshConnections()
	session.wg.Add(2)
	go session.captureLoop()
	go session.connectionRefreshLoop()

	m.mu.Lock()
	m.session = session
	m.mu.Unlock()
	return nil
}

func (m *Manager) StopCapture() {
	m.mu.Lock()
	session := m.session
	m.session = nil
	m.mu.Unlock()
	if session == nil {
		return
	}
	session.stopFn()
	session.handle.Close()
	session.wg.Wait()
}

func (m *Manager) Snapshot(limitPackets, limitMessages int) Snapshot {
	interfaces := m.Interfaces()
	connections := m.connectionRows(nil)
	status := CaptureStatus{
		Supported:         true,
		InterfacesLoaded:  len(interfaces) > 0,
		CaptureFilter:     defaultCaptureFilter,
		Connections:       len(connections),
		LocalAddresses:    sortedKeys(m.hostIPs),
		PermissionGranted: true,
	}
	m.mu.RLock()
	session := m.session
	m.mu.RUnlock()
	if session == nil {
		return Snapshot{
			Status:      status,
			Interfaces:  interfaces,
			Connections: connections,
			Packets:     []PacketEntry{},
			HTTP:        []HTTPMessage{},
		}
	}
	status = session.status()
	return Snapshot{
		Status:      status,
		Interfaces:  interfaces,
		Connections: m.connectionRows(session),
		Packets:     session.packetList(limitPackets),
		HTTP:        session.httpList(limitMessages),
	}
}

func (m *Manager) connectionRows(session *captureSession) []ConnectionRow {
	rows := make([]ConnectionRow, 0, 128)
	connMap := map[string]connMeta{}
	statsMap := map[string]flowStat{}
	if session != nil {
		session.mu.RLock()
		for key, item := range session.connMap {
			connMap[key] = item
		}
		for key, item := range session.flowStats {
			if item == nil {
				continue
			}
			statsMap[key] = *item
		}
		session.mu.RUnlock()
	} else {
		for _, item := range collectConnections() {
			connMap[item.Key] = item
		}
	}

	for _, item := range connMap {
		stat := statsMap[item.Key]
		rows = append(rows, ConnectionRow{
			PID:           item.PID,
			ProcessName:   item.ProcessName,
			ExePath:       item.ExePath,
			Protocol:      item.Protocol,
			Status:        item.Status,
			LocalIP:       item.LocalIP,
			LocalPort:     item.LocalPort,
			RemoteIP:      item.RemoteIP,
			RemotePort:    item.RemotePort,
			ConnectionKey: item.Key,
			Connections:   1,
			BytesIn:       stat.BytesIn,
			BytesOut:      stat.BytesOut,
			PacketsIn:     stat.PacketsIn,
			PacketsOut:    stat.PacketsOut,
			LastSeen:      stat.LastSeen,
		})
	}
	sort.SliceStable(rows, func(i, j int) bool {
		iBytes := rows[i].BytesIn + rows[i].BytesOut
		jBytes := rows[j].BytesIn + rows[j].BytesOut
		if iBytes != jBytes {
			return iBytes > jBytes
		}
		if rows[i].LastSeen != rows[j].LastSeen {
			return rows[i].LastSeen.After(rows[j].LastSeen)
		}
		if rows[i].ProcessName != rows[j].ProcessName {
			return rows[i].ProcessName < rows[j].ProcessName
		}
		return rows[i].PID < rows[j].PID
	})
	return rows
}

func (s *captureSession) status() CaptureStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return CaptureStatus{
		Supported:         true,
		InterfacesLoaded:  true,
		Active:            true,
		InterfaceName:     s.iface.Name,
		CaptureFilter:     s.captureFilter,
		StartedAt:         s.startedAt,
		Error:             s.lastError,
		PacketCount:       len(s.packets),
		HTTPMessageCount:  len(s.httpMessages),
		Connections:       len(s.connMap),
		LocalAddresses:    sortedKeys(s.localIPs),
		PermissionGranted: s.permissionOK,
	}
}

func (s *captureSession) packetList(limit int) []PacketEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.packets) {
		limit = len(s.packets)
	}
	out := append([]PacketEntry(nil), s.packets[max(0, len(s.packets)-limit):]...)
	reversePackets(out)
	return out
}

func (s *captureSession) httpList(limit int) []HTTPMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.httpMessages) {
		limit = len(s.httpMessages)
	}
	out := append([]HTTPMessage(nil), s.httpMessages[max(0, len(s.httpMessages)-limit):]...)
	for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
		out[i], out[j] = out[j], out[i]
	}
	return out
}

func (s *captureSession) captureLoop() {
	defer s.wg.Done()
	source := gopacket.NewPacketSource(s.handle, s.handle.LinkType())
	source.NoCopy = true
	for {
		select {
		case <-s.stopCtx.Done():
			return
		case packet, ok := <-source.Packets():
			if !ok {
				return
			}
			s.consumePacket(packet)
		}
	}
}

func (s *captureSession) connectionRefreshLoop() {
	defer s.wg.Done()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCtx.Done():
			return
		case <-ticker.C:
			s.refreshConnections()
			if s.assembler != nil {
				s.assembler.FlushOlderThan(time.Now().Add(-2 * time.Minute))
			}
		}
	}
}

func (s *captureSession) refreshConnections() {
	items := collectConnections()
	mapped := make(map[string]connMeta, len(items))
	for _, item := range items {
		mapped[item.Key] = item
	}
	s.mu.Lock()
	s.connMap = mapped
	s.mu.Unlock()
}

func (s *captureSession) consumePacket(packet gopacket.Packet) {
	if packet == nil {
		return
	}
	metadata := packet.Metadata()
	ts := time.Now()
	if metadata != nil && !metadata.Timestamp.IsZero() {
		ts = metadata.Timestamp
	}

	networkLayer := packet.NetworkLayer()
	if networkLayer == nil {
		return
	}
	transportLayer := packet.TransportLayer()
	if transportLayer == nil {
		return
	}

	srcIP, dstIP := endpointIPs(networkLayer)
	srcPort, dstPort, protocol, tcpLayer, payload := transportMeta(transportLayer)
	if protocol == "" {
		return
	}
	meta, direction := s.resolveConnection(srcIP, dstIP, srcPort, dstPort, protocol)
	if meta.ProcessName == "" {
		meta.ProcessName = "-"
	}
	if meta.ExePath == "" {
		meta.ExePath = "-"
	}

	packetEntry := PacketEntry{
		ID:          fmt.Sprintf("%d-%s-%d-%s-%d", ts.UnixNano(), srcIP, srcPort, dstIP, dstPort),
		Timestamp:   ts,
		PID:         meta.PID,
		ProcessName: meta.ProcessName,
		ExePath:     meta.ExePath,
		Direction:   direction,
		Protocol:    strings.ToUpper(protocol),
		SrcIP:       srcIP,
		SrcPort:     srcPort,
		DstIP:       dstIP,
		DstPort:     dstPort,
		Length:      len(payload),
	}
	packetEntry.AppProtocol, packetEntry.Info, packetEntry.PayloadPreview, packetEntry.DecodedText, packetEntry.HTTPS = describePayload(payload, srcPort, dstPort)
	s.recordPacket(packetEntry, meta.Key, uint64(packetEntry.Length), direction)

	if tcpLayer != nil {
		s.assembler.AssembleWithTimestamp(networkLayer.NetworkFlow(), tcpLayer, ts)
	}
}

func (s *captureSession) recordPacket(item PacketEntry, key string, size uint64, direction string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.packets = append(s.packets, item)
	if len(s.packets) > s.packetLimit {
		s.packets = append([]PacketEntry(nil), s.packets[len(s.packets)-s.packetLimit:]...)
	}
	if key == "" {
		return
	}
	stat, ok := s.flowStats[key]
	if !ok {
		stat = &flowStat{}
		s.flowStats[key] = stat
	}
	if direction == "outbound" {
		stat.PacketsOut++
		stat.BytesOut += size
	} else {
		stat.PacketsIn++
		stat.BytesIn += size
	}
	stat.LastSeen = item.Timestamp
}

func (s *captureSession) resolveConnection(srcIP, dstIP string, srcPort, dstPort uint16, protocol string) (connMeta, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	srcLocal := hasKey(s.localIPs, srcIP)
	dstLocal := hasKey(s.localIPs, dstIP)
	var keys []string
	direction := "unknown"
	if srcLocal {
		direction = "outbound"
		keys = append(keys,
			connectionKey(protocol, srcIP, uint32(srcPort), dstIP, uint32(dstPort)),
			connectionKey(protocol, "", uint32(srcPort), dstIP, uint32(dstPort)),
			connectionKey(protocol, srcIP, uint32(srcPort), "", uint32(dstPort)),
		)
	}
	if dstLocal {
		if direction == "unknown" {
			direction = "inbound"
		}
		keys = append(keys,
			connectionKey(protocol, dstIP, uint32(dstPort), srcIP, uint32(srcPort)),
			connectionKey(protocol, "", uint32(dstPort), srcIP, uint32(srcPort)),
			connectionKey(protocol, dstIP, uint32(dstPort), "", uint32(srcPort)),
		)
	}
	for _, key := range keys {
		if item, ok := s.connMap[key]; ok {
			return item, direction
		}
	}
	if srcLocal {
		for _, item := range s.connMap {
			if strings.EqualFold(item.Protocol, protocol) && item.LocalPort == uint32(srcPort) {
				return item, "outbound"
			}
		}
	}
	if dstLocal {
		for _, item := range s.connMap {
			if strings.EqualFold(item.Protocol, protocol) && item.LocalPort == uint32(dstPort) {
				return item, "inbound"
			}
		}
	}
	return connMeta{}, direction
}

func (f *httpStreamFactory) New(netFlow, tcpFlow gopacket.Flow) tcpassembly.Stream {
	stream := &httpStream{
		net:       netFlow,
		transport: tcpFlow,
		reader:    tcpreader.NewReaderStream(),
		session:   f.session,
	}
	go stream.run()
	return &stream.reader
}

func (s *httpStream) run() {
	buf := bufio.NewReader(&s.reader)
	first, err := buf.Peek(8)
	if err != nil {
		return
	}
	head := string(first)
	switch {
	case looksLikeHTTPRequest(head):
		s.readRequests(buf)
	case looksLikeHTTPResponse(head):
		s.readResponses(buf)
	default:
		return
	}
}

func (s *httpStream) readRequests(reader *bufio.Reader) {
	for {
		req, err := http.ReadRequest(reader)
		if err != nil {
			if err != io.EOF && !strings.Contains(strings.ToLower(err.Error()), "timeout") {
				return
			}
			return
		}
		body, rawBody := readHTTPBody(req.Body, req.Header.Get("Content-Type"))
		_ = req.Body.Close()
		meta, direction := s.session.resolveConnection(s.net.Src().String(), s.net.Dst().String(), flowPort(s.transport.Src()), flowPort(s.transport.Dst()), "tcp")
		msg := HTTPMessage{
			ID:          fmt.Sprintf("http-req-%d", time.Now().UnixNano()),
			Timestamp:   time.Now(),
			PID:         meta.PID,
			ProcessName: nonEmpty(meta.ProcessName, "-"),
			ExePath:     nonEmpty(meta.ExePath, "-"),
			Direction:   direction,
			Method:      req.Method,
			URL:         req.URL.String(),
			Host:        req.Host,
			Protocol:    req.Proto,
			ContentType: req.Header.Get("Content-Type"),
			Headers:     headerMap(req.Header),
			Body:        body,
			Raw:         buildHTTPRequestRaw(req, rawBody),
		}
		s.session.addHTTPMessage(msg)
	}
}

func (s *httpStream) readResponses(reader *bufio.Reader) {
	for {
		resp, err := http.ReadResponse(reader, nil)
		if err != nil {
			if err != io.EOF && !strings.Contains(strings.ToLower(err.Error()), "timeout") {
				return
			}
			return
		}
		body, rawBody := readHTTPBody(resp.Body, resp.Header.Get("Content-Type"))
		_ = resp.Body.Close()
		meta, direction := s.session.resolveConnection(s.net.Dst().String(), s.net.Src().String(), flowPort(s.transport.Dst()), flowPort(s.transport.Src()), "tcp")
		msg := HTTPMessage{
			ID:          fmt.Sprintf("http-resp-%d", time.Now().UnixNano()),
			Timestamp:   time.Now(),
			PID:         meta.PID,
			ProcessName: nonEmpty(meta.ProcessName, "-"),
			ExePath:     nonEmpty(meta.ExePath, "-"),
			Direction:   direction,
			StatusCode:  resp.StatusCode,
			Status:      resp.Status,
			Protocol:    resp.Proto,
			ContentType: resp.Header.Get("Content-Type"),
			Headers:     headerMap(resp.Header),
			Body:        body,
			Raw:         buildHTTPResponseRaw(resp, rawBody),
		}
		s.session.addHTTPMessage(msg)
	}
}

func (s *captureSession) addHTTPMessage(item HTTPMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.httpMessages = append(s.httpMessages, item)
	if len(s.httpMessages) > s.messageLimit {
		s.httpMessages = append([]HTTPMessage(nil), s.httpMessages[len(s.httpMessages)-s.messageLimit:]...)
	}
}

func listInterfaces() []InterfaceInfo {
	nicMeta := netInterfaceMeta()
	devs, err := pcap.FindAllDevs()
	if err == nil && len(devs) > 0 {
		out := make([]InterfaceInfo, 0, len(devs))
		for _, dev := range devs {
			addrs := make([]string, 0, len(dev.Addresses))
			for _, addr := range dev.Addresses {
				if addr.IP == nil {
					continue
				}
				addrs = append(addrs, addr.IP.String())
			}
			sort.Strings(addrs)
			meta, ok := nicMeta[dev.Name]
			out = append(out, InterfaceInfo{
				Name:        dev.Name,
				Description: dev.Description,
				Addresses:   addrs,
				Loopback:    interfaceLoopback(dev.Name, addrs, meta, ok),
				Up:          interfaceUp(addrs, meta, ok),
			})
		}
		sort.SliceStable(out, func(i, j int) bool {
			iScore := interfacePriority(out[i])
			jScore := interfacePriority(out[j])
			if iScore != jScore {
				return iScore > jScore
			}
			return out[i].Name < out[j].Name
		})
		return out
	}
	nics, _ := net.Interfaces()
	out := make([]InterfaceInfo, 0, len(nics))
	for _, nic := range nics {
		addrs := make([]string, 0, 4)
		items, _ := nic.Addrs()
		for _, item := range items {
			addrs = append(addrs, strings.Split(item.String(), "/")[0])
		}
		sort.Strings(addrs)
		out = append(out, InterfaceInfo{
			Name:        nic.Name,
			Description: nic.HardwareAddr.String(),
			Addresses:   addrs,
			Loopback:    nic.Flags&net.FlagLoopback != 0,
			Up:          nic.Flags&net.FlagUp != 0,
		})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func pickInterface(name string) (InterfaceInfo, error) {
	items := listInterfaces()
	name = strings.TrimSpace(name)
	if name != "" {
		for _, item := range items {
			if strings.EqualFold(item.Name, name) {
				return item, nil
			}
		}
		return InterfaceInfo{}, fmt.Errorf("interface not found: %s", name)
	}
	for _, item := range items {
		if item.Up && !item.Loopback && len(item.Addresses) > 0 {
			return item, nil
		}
	}
	if len(items) == 0 {
		return InterfaceInfo{}, fmt.Errorf("no capture interface available")
	}
	return items[0], nil
}

type nicInfo struct {
	Loopback bool
	Up       bool
}

func netInterfaceMeta() map[string]nicInfo {
	items, _ := net.Interfaces()
	out := make(map[string]nicInfo, len(items))
	for _, item := range items {
		out[item.Name] = nicInfo{
			Loopback: item.Flags&net.FlagLoopback != 0,
			Up:       item.Flags&net.FlagUp != 0,
		}
	}
	return out
}

func interfaceLoopback(name string, addrs []string, meta nicInfo, ok bool) bool {
	if ok && meta.Loopback {
		return true
	}
	if strings.HasPrefix(strings.ToLower(strings.TrimSpace(name)), "lo") {
		return true
	}
	return isLoopbackAddresses(addrs)
}

func interfaceUp(addrs []string, meta nicInfo, ok bool) bool {
	if ok {
		return meta.Up
	}
	return len(addrs) > 0
}

func interfacePriority(item InterfaceInfo) int {
	score := 0
	name := strings.ToLower(strings.TrimSpace(item.Name))
	if isPhysicalInterfaceName(name) {
		score += 1000
	}
	if item.Up {
		score += 300
	}
	if hasRoutableAddress(item.Addresses) {
		score += 200
	} else if hasUsableAddress(item.Addresses, item.Loopback) {
		score += 80
	}
	if item.Loopback {
		score += 120
	}
	if isVirtualInterfaceName(name) {
		score -= 200
	}
	return score
}

func isPhysicalInterfaceName(name string) bool {
	switch {
	case strings.HasPrefix(name, "en"),
		strings.HasPrefix(name, "eth"),
		strings.HasPrefix(name, "eno"),
		strings.HasPrefix(name, "ens"),
		strings.HasPrefix(name, "enp"),
		strings.HasPrefix(name, "wlan"),
		strings.HasPrefix(name, "wlp"),
		strings.HasPrefix(name, "wl"):
		return true
	default:
		return false
	}
}

func isVirtualInterfaceName(name string) bool {
	switch {
	case strings.HasPrefix(name, "lo"),
		strings.HasPrefix(name, "bridge"),
		strings.HasPrefix(name, "docker"),
		strings.HasPrefix(name, "br-"),
		strings.HasPrefix(name, "veth"),
		strings.HasPrefix(name, "utun"),
		strings.HasPrefix(name, "awdl"),
		strings.HasPrefix(name, "llw"),
		strings.HasPrefix(name, "gif"),
		strings.HasPrefix(name, "stf"),
		strings.HasPrefix(name, "p2p"),
		strings.HasPrefix(name, "tap"),
		strings.HasPrefix(name, "tun"),
		strings.HasPrefix(name, "vmnet"),
		strings.HasPrefix(name, "xhc"):
		return true
	default:
		return false
	}
}

func hasRoutableAddress(addrs []string) bool {
	for _, addr := range addrs {
		ip := net.ParseIP(strings.TrimSpace(addr))
		if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			continue
		}
		return true
	}
	return false
}

func hasUsableAddress(addrs []string, loopback bool) bool {
	for _, addr := range addrs {
		ip := net.ParseIP(strings.TrimSpace(addr))
		if ip == nil || ip.IsUnspecified() {
			continue
		}
		if loopback {
			return true
		}
		if !ip.IsLinkLocalUnicast() && !ip.IsLinkLocalMulticast() {
			return true
		}
	}
	return false
}

func collectConnections() []connMeta {
	items, err := netio.Connections("inet")
	if err != nil {
		return nil
	}
	pidCache := map[int32]procMeta{}
	out := make([]connMeta, 0, len(items))
	for _, item := range items {
		proto := protoName(item.Type)
		if proto == "" {
			continue
		}
		meta := resolveProcMeta(item.Pid, pidCache)
		key := connectionKey(proto, item.Laddr.IP, item.Laddr.Port, item.Raddr.IP, item.Raddr.Port)
		out = append(out, connMeta{
			Key:         key,
			PID:         item.Pid,
			ProcessName: meta.Name,
			ExePath:     meta.ExePath,
			LocalIP:     item.Laddr.IP,
			LocalPort:   item.Laddr.Port,
			RemoteIP:    item.Raddr.IP,
			RemotePort:  item.Raddr.Port,
			Status:      item.Status,
			Protocol:    proto,
		})
	}
	return out
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
	if pid > 0 {
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
	}
	cache[pid] = meta
	return meta
}

func endpointIPs(networkLayer gopacket.NetworkLayer) (string, string) {
	switch layer := networkLayer.(type) {
	case *layers.IPv4:
		return layer.SrcIP.String(), layer.DstIP.String()
	case *layers.IPv6:
		return layer.SrcIP.String(), layer.DstIP.String()
	default:
		return networkLayer.NetworkFlow().Src().String(), networkLayer.NetworkFlow().Dst().String()
	}
}

func transportMeta(layer gopacket.Layer) (uint16, uint16, string, *layers.TCP, []byte) {
	switch x := layer.(type) {
	case *layers.TCP:
		return uint16(x.SrcPort), uint16(x.DstPort), "tcp", x, append([]byte(nil), x.Payload...)
	case *layers.UDP:
		return uint16(x.SrcPort), uint16(x.DstPort), "udp", nil, append([]byte(nil), x.Payload...)
	default:
		return 0, 0, "", nil, nil
	}
}

func flowPort(endpoint gopacket.Endpoint) uint16 {
	var port uint16
	fmt.Sscanf(endpoint.String(), "%d", &port)
	return port
}

func describePayload(payload []byte, srcPort, dstPort uint16) (appProtocol, info, preview, decoded string, https bool) {
	if len(payload) == 0 {
		return "-", "-", "", "", false
	}
	textPreview := previewPayload(payload)
	if looksLikeHTTPPayload(payload) {
		return "http", "HTTP 明文流量", textPreview, textPreview, false
	}
	if likelyHTTPS(payload, srcPort, dstPort) {
		return "https", "HTTPS/TLS 流量，暂不支持明文解码", textPreview, "", true
	}
	return "raw", hexPreview(payload), textPreview, textPreview, false
}

func likelyHTTPS(payload []byte, srcPort, dstPort uint16) bool {
	if srcPort == 443 || dstPort == 443 {
		return true
	}
	if len(payload) >= 3 && payload[0] == 0x16 && payload[1] == 0x03 {
		return true
	}
	return false
}

func previewPayload(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}
	limit := len(payload)
	if limit > 2048 {
		limit = 2048
	}
	buf := payload[:limit]
	if !isMostlyPrintable(buf) {
		return hexPreview(buf)
	}
	return string(buf)
}

func hexPreview(payload []byte) string {
	limit := len(payload)
	if limit > 96 {
		limit = 96
	}
	out := hex.EncodeToString(payload[:limit])
	if len(payload) > limit {
		out += "..."
	}
	return out
}

func looksLikeHTTPPayload(payload []byte) bool {
	text := strings.ToUpper(string(payload))
	for _, prefix := range []string{"GET ", "POST ", "PUT ", "DELETE ", "PATCH ", "HEAD ", "OPTIONS ", "HTTP/1."} {
		if strings.HasPrefix(text, prefix) {
			return true
		}
	}
	return false
}

func looksLikeHTTPRequest(head string) bool {
	text := strings.ToUpper(head)
	for _, prefix := range []string{"GET ", "POST ", "PUT ", "DELET", "PATCH", "HEAD ", "OPTION", "TRACE ", "CONNEC"} {
		if strings.HasPrefix(text, prefix) {
			return true
		}
	}
	return false
}

func looksLikeHTTPResponse(head string) bool {
	return strings.HasPrefix(strings.ToUpper(head), "HTTP/")
}

func headerMap(header http.Header) map[string]string {
	out := make(map[string]string, len(header))
	for key, values := range header {
		out[key] = strings.Join(values, ", ")
	}
	return out
}

func readHTTPBody(body io.ReadCloser, contentType string) (string, string) {
	if body == nil {
		return "", ""
	}
	raw, _ := io.ReadAll(io.LimitReader(body, maxHTTPBodyBytes))
	if !isTextContent(contentType, raw) {
		return fmt.Sprintf("[binary body %d bytes]", len(raw)), ""
	}
	text := string(raw)
	return text, text
}

func buildHTTPRequestRaw(req *http.Request, body string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s %s\r\n", req.Method, req.URL.RequestURI(), req.Proto)
	req.Header.Write(&b)
	b.WriteString("\r\n")
	b.WriteString(body)
	return b.String()
}

func buildHTTPResponseRaw(resp *http.Response, body string) string {
	var b strings.Builder
	fmt.Fprintf(&b, "%s %s\r\n", resp.Proto, resp.Status)
	resp.Header.Write(&b)
	b.WriteString("\r\n")
	b.WriteString(body)
	return b.String()
}

func isTextContent(contentType string, body []byte) bool {
	contentType = strings.ToLower(strings.TrimSpace(contentType))
	switch {
	case strings.Contains(contentType, "json"),
		strings.Contains(contentType, "xml"),
		strings.Contains(contentType, "html"),
		strings.Contains(contentType, "text"),
		strings.Contains(contentType, "javascript"),
		strings.Contains(contentType, "x-www-form-urlencoded"):
		return true
	}
	return isMostlyPrintable(body)
}

func isMostlyPrintable(body []byte) bool {
	if len(body) == 0 {
		return true
	}
	printable := 0
	for _, b := range body {
		if (b >= 32 && b <= 126) || b == '\r' || b == '\n' || b == '\t' {
			printable++
		}
	}
	return float64(printable)/float64(len(body)) >= 0.85
}

func connectionKey(protocol, localIP string, localPort uint32, remoteIP string, remotePort uint32) string {
	return fmt.Sprintf("%s|%s|%d|%s|%d", strings.ToLower(strings.TrimSpace(protocol)), strings.TrimSpace(localIP), localPort, strings.TrimSpace(remoteIP), remotePort)
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

func isLoopbackAddresses(addrs []string) bool {
	if len(addrs) == 0 {
		return false
	}
	for _, addr := range addrs {
		ip := net.ParseIP(addr)
		if ip == nil || !ip.IsLoopback() {
			return false
		}
	}
	return true
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

func reversePackets(items []PacketEntry) {
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
}

func hasKey(m map[string]struct{}, key string) bool {
	_, ok := m[strings.TrimSpace(key)]
	return ok
}

func nonEmpty(values ...string) string {
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			return value
		}
	}
	return ""
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
