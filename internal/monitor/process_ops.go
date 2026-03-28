package monitor

import (
	"fmt"
	"time"

	"github.com/shirou/gopsutil/v3/process"
)

type ProcessDetail struct {
	PID           int32   `json:"pid"`
	Name          string  `json:"name"`
	ExePath       string  `json:"exe_path"`
	Cmdline       string  `json:"cmdline"`
	Status        string  `json:"status"`
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryPercent float32 `json:"memory_percent"`
	RSS           uint64  `json:"rss"`
	VMS           uint64  `json:"vms"`
	ReadBytes     uint64  `json:"read_bytes"`
	WriteBytes    uint64  `json:"write_bytes"`
	ReadCount     uint64  `json:"read_count"`
	WriteCount    uint64  `json:"write_count"`
	Threads       int32   `json:"threads"`
	CreatedAt     string  `json:"created_at"`
}

func GetProcessDetail(pid int32) (*ProcessDetail, error) {
	p, err := process.NewProcess(pid)
	if err != nil {
		return nil, err
	}

	name, _ := p.Name()
	exe, _ := p.Exe()
	cmdline, _ := p.Cmdline()
	statuses, _ := p.Status()
	status := ""
	if len(statuses) > 0 {
		status = statuses[0]
	}
	cpuPercent, _ := p.CPUPercent()
	memPercent, _ := p.MemoryPercent()
	memInfo, _ := p.MemoryInfo()
	ioInfo, _ := p.IOCounters()
	threads, _ := p.NumThreads()
	createTimeMs, _ := p.CreateTime()

	createdAt := ""
	if createTimeMs > 0 {
		createdAt = time.UnixMilli(createTimeMs).Format(time.RFC3339)
	}

	detail := &ProcessDetail{
		PID:           pid,
		Name:          displayProcessName(name, cmdline, exe),
		ExePath:       exe,
		Cmdline:       cmdline,
		Status:        status,
		CPUPercent:    cpuPercent,
		MemoryPercent: memPercent,
		Threads:       threads,
		CreatedAt:     createdAt,
	}

	if memInfo != nil {
		detail.RSS = memInfo.RSS
		detail.VMS = memInfo.VMS
	}
	if ioInfo != nil {
		detail.ReadBytes = ioInfo.ReadBytes
		detail.WriteBytes = ioInfo.WriteBytes
		detail.ReadCount = ioInfo.ReadCount
		detail.WriteCount = ioInfo.WriteCount
	}

	return detail, nil
}

func KillProcess(pid int32) error {
	p, err := process.NewProcess(pid)
	if err != nil {
		return err
	}
	if err := p.Kill(); err != nil {
		return fmt.Errorf("kill pid %d failed: %w", pid, err)
	}
	return nil
}
