package monitor

import (
	"context"
	"encoding/xml"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"ops-tool/internal/config"

	"github.com/gosnmp/gosnmp"
)

type SNMPTargetStatus struct {
	Name      string      `json:"name"`
	Target    string      `json:"target"`
	Status    string      `json:"status"`
	Detail    string      `json:"detail"`
	LatencyMS int64       `json:"latency_ms"`
	Values    []SNMPOIDKV `json:"values"`
}

type SNMPOIDKV struct {
	Name  string `json:"name"`
	OID   string `json:"oid"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

type NmapTargetStatus struct {
	Target    string            `json:"target"`
	Address   string            `json:"address"`
	Hostname  string            `json:"hostname"`
	Status    string            `json:"status"`
	Detail    string            `json:"detail"`
	LatencyMS int64             `json:"latency_ms"`
	OpenPorts int               `json:"open_ports"`
	Services  []NmapPortService `json:"services"`
}

type NmapPortService struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	State    string `json:"state"`
	Service  string `json:"service"`
	Product  string `json:"product"`
}

var defaultSNMPOIDs = []config.SNMPOID{
	{Name: "sysName", OID: "1.3.6.1.2.1.1.5.0"},
	{Name: "sysUpTime", OID: "1.3.6.1.2.1.1.3.0"},
	{Name: "sysDescr", OID: "1.3.6.1.2.1.1.1.0"},
}

func gatherSNMP(cfg config.SNMPConfig) []SNMPTargetStatus {
	if !cfg.Enabled || len(cfg.Targets) == 0 {
		return nil
	}

	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 3 * time.Second
	}

	retries := cfg.Retries
	if retries < 0 {
		retries = 1
	}

	out := make([]SNMPTargetStatus, 0, len(cfg.Targets))
	for _, target := range cfg.Targets {
		host := strings.TrimSpace(target.Host)
		if host == "" {
			continue
		}
		port := target.Port
		if port == 0 {
			port = 161
		}

		item := SNMPTargetStatus{
			Name:   firstNonEmpty(target.Name, host),
			Target: fmt.Sprintf("%s:%d", host, port),
			Status: "down",
		}

		client := &gosnmp.GoSNMP{
			Target:    host,
			Port:      port,
			Community: firstNonEmpty(target.Community, "public"),
			Version:   parseSNMPVersion(target.Version),
			Timeout:   timeout,
			Retries:   retries,
			MaxOids:   gosnmp.MaxOids,
		}

		start := time.Now()
		if err := client.Connect(); err != nil {
			item.Detail = err.Error()
			out = append(out, item)
			continue
		}
		item.LatencyMS = time.Since(start).Milliseconds()

		oids := target.OIDs
		if len(oids) == 0 {
			oids = defaultSNMPOIDs
		}
		oidList := make([]string, 0, len(oids))
		oidNameMap := make(map[string]string, len(oids))
		for _, oid := range oids {
			raw := strings.TrimSpace(oid.OID)
			if raw == "" {
				continue
			}
			normalized := normalizeOID(raw)
			oidList = append(oidList, normalized)
			oidNameMap[normalized] = firstNonEmpty(oid.Name, raw)
		}
		if len(oidList) == 0 {
			oidList = []string{normalizeOID(defaultSNMPOIDs[0].OID)}
			oidNameMap[oidList[0]] = defaultSNMPOIDs[0].Name
		}

		packet, err := client.Get(oidList)
		if client.Conn != nil {
			_ = client.Conn.Close()
		}
		if err != nil {
			item.Detail = err.Error()
			out = append(out, item)
			continue
		}

		item.Status = "up"
		preview := make([]string, 0, 3)
		item.Values = make([]SNMPOIDKV, 0, len(packet.Variables))
		for _, variable := range packet.Variables {
			name := normalizeOID(variable.Name)
			label := firstNonEmpty(oidNameMap[name], name)
			value := formatSNMPValue(variable)
			item.Values = append(item.Values, SNMPOIDKV{
				Name:  label,
				OID:   name,
				Type:  variable.Type.String(),
				Value: value,
			})
			if len(preview) < 2 {
				preview = append(preview, fmt.Sprintf("%s=%s", label, value))
			}
		}
		if len(preview) > 0 {
			item.Detail = strings.Join(preview, "; ")
		} else {
			item.Detail = "ok"
		}
		out = append(out, item)
	}

	return out
}

func gatherNmap(cfg config.NmapConfig) []NmapTargetStatus {
	if !cfg.Enabled || len(cfg.Targets) == 0 {
		return nil
	}

	binary := strings.TrimSpace(cfg.NmapBinary)
	if binary == "" {
		binary = "nmap"
	}

	timeout := time.Duration(cfg.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	topPorts := cfg.TopPorts
	if topPorts <= 0 {
		topPorts = 100
	}

	targets := make([]string, 0, len(cfg.Targets))
	for _, t := range cfg.Targets {
		t = strings.TrimSpace(t)
		if t != "" {
			targets = append(targets, t)
		}
	}
	if len(targets) == 0 {
		return nil
	}

	if _, err := exec.LookPath(binary); err != nil {
		out := make([]NmapTargetStatus, 0, len(targets))
		for _, target := range targets {
			out = append(out, NmapTargetStatus{
				Target: target,
				Status: "down",
				Detail: fmt.Sprintf("nmap unavailable: %v", err),
			})
		}
		return out
	}

	baseArgs := make([]string, 0, 12+len(cfg.Arguments))
	baseArgs = append(baseArgs, "--top-ports", strconv.Itoa(topPorts))
	if len(cfg.Arguments) > 0 {
		baseArgs = append(baseArgs, cfg.Arguments...)
	} else {
		baseArgs = append(baseArgs, "-sT", "-sV", "--open")
	}
	baseArgs = append(baseArgs, "-oX", "-")

	out := make([]NmapTargetStatus, 0, len(targets))
	for _, target := range targets {
		args := append(append([]string{}, baseArgs...), target)
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		start := time.Now()
		raw, err := exec.CommandContext(ctx, binary, args...).CombinedOutput()
		latency := time.Since(start).Milliseconds()
		cancel()

		parsed := parseNmapOutput(target, raw, latency)
		if err != nil && parsed.Detail == "" {
			parsed.Detail = err.Error()
		}
		out = append(out, parsed)
	}
	return out
}

func parseSNMPVersion(raw string) gosnmp.SnmpVersion {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "v1", "1":
		return gosnmp.Version1
	case "v3", "3":
		return gosnmp.Version3
	default:
		return gosnmp.Version2c
	}
}

func normalizeOID(raw string) string {
	return strings.TrimPrefix(strings.TrimSpace(raw), ".")
}

func formatSNMPValue(variable gosnmp.SnmpPDU) string {
	switch v := variable.Value.(type) {
	case []byte:
		return strings.TrimSpace(string(v))
	default:
		return fmt.Sprintf("%v", v)
	}
}

type nmapRunXML struct {
	Hosts []nmapHostXML `xml:"host"`
}

type nmapHostXML struct {
	Status    nmapStatusXML    `xml:"status"`
	Addresses []nmapAddressXML `xml:"address"`
	Hostnames nmapHostnamesXML `xml:"hostnames"`
	Ports     nmapPortsXML     `xml:"ports"`
}

type nmapStatusXML struct {
	State  string `xml:"state,attr"`
	Reason string `xml:"reason,attr"`
}

type nmapAddressXML struct {
	Addr string `xml:"addr,attr"`
}

type nmapHostnamesXML struct {
	Items []nmapHostnameXML `xml:"hostname"`
}

type nmapHostnameXML struct {
	Name string `xml:"name,attr"`
}

type nmapPortsXML struct {
	Items []nmapPortXML `xml:"port"`
}

type nmapPortXML struct {
	Protocol string          `xml:"protocol,attr"`
	PortID   int             `xml:"portid,attr"`
	State    nmapPortState   `xml:"state"`
	Service  nmapPortService `xml:"service"`
}

type nmapPortState struct {
	State string `xml:"state,attr"`
}

type nmapPortService struct {
	Name      string `xml:"name,attr"`
	Product   string `xml:"product,attr"`
	Version   string `xml:"version,attr"`
	ExtraInfo string `xml:"extrainfo,attr"`
}

func parseNmapOutput(target string, raw []byte, latencyMS int64) NmapTargetStatus {
	out := NmapTargetStatus{
		Target:    target,
		Status:    "down",
		LatencyMS: latencyMS,
		Detail:    "no response",
	}

	text := strings.TrimSpace(string(raw))
	if text == "" {
		return out
	}

	var parsed nmapRunXML
	if err := xml.Unmarshal([]byte(text), &parsed); err != nil {
		out.Detail = trim(text, 180)
		return out
	}
	if len(parsed.Hosts) == 0 {
		out.Detail = "host not found in nmap result"
		return out
	}

	host := parsed.Hosts[0]
	out.Status = firstNonEmpty(strings.ToLower(host.Status.State), "unknown")
	out.Detail = firstNonEmpty(host.Status.Reason, out.Detail)
	if len(host.Addresses) > 0 {
		out.Address = host.Addresses[0].Addr
	}
	if len(host.Hostnames.Items) > 0 {
		out.Hostname = host.Hostnames.Items[0].Name
	}

	openServices := make([]NmapPortService, 0, len(host.Ports.Items))
	for _, port := range host.Ports.Items {
		state := strings.ToLower(port.State.State)
		if state != "open" {
			continue
		}
		product := strings.TrimSpace(strings.Join([]string{
			strings.TrimSpace(port.Service.Product),
			strings.TrimSpace(port.Service.Version),
			strings.TrimSpace(port.Service.ExtraInfo),
		}, " "))
		product = strings.Join(strings.Fields(product), " ")
		openServices = append(openServices, NmapPortService{
			Port:     port.PortID,
			Protocol: port.Protocol,
			State:    state,
			Service:  port.Service.Name,
			Product:  product,
		})
	}
	out.OpenPorts = len(openServices)
	out.Services = openServices

	if out.Status == "up" {
		if out.OpenPorts == 0 {
			out.Detail = "host up, no open port"
		} else {
			summary := make([]string, 0, 3)
			for i, svc := range openServices {
				if i >= 3 {
					break
				}
				summary = append(summary, fmt.Sprintf("%d/%s:%s", svc.Port, svc.Protocol, firstNonEmpty(svc.Service, "unknown")))
			}
			out.Detail = fmt.Sprintf("open ports %d (%s)", out.OpenPorts, strings.Join(summary, ", "))
		}
	}

	return out
}

func firstNonEmpty(items ...string) string {
	for _, item := range items {
		if strings.TrimSpace(item) != "" {
			return strings.TrimSpace(item)
		}
	}
	return ""
}
