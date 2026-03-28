package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hash/crc32"
	"image"
	"image/jpeg"
	"math"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kbinani/screenshot"
	"golang.org/x/image/draw"
)

const (
	remoteWSWriteTimeout      = 8 * time.Second
	remoteWSReadTimeout       = 75 * time.Second
	remoteWSPingInterval      = 25 * time.Second
	remoteWSMaxReadBytes      = 64 * 1024
	remoteMinFrameInterval    = 40 * time.Millisecond
	remoteMaxFrameInterval    = 250 * time.Millisecond
	remoteIdleFramePushPeriod = 1200 * time.Millisecond
)

var remoteWSUpgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type remoteDesktopMeta struct {
	Type      string  `json:"type"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Scale     float64 `json:"scale"`
	Quality   int     `json:"quality"`
	FPS       int     `json:"fps"`
	Platform  string  `json:"platform"`
	CanInput  bool    `json:"can_input"`
	Timestamp int64   `json:"ts"`
}

type remoteDesktopInputRequest struct {
	Type   string  `json:"type"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Button string  `json:"button"`
	Delta  int     `json:"delta"`
	Key    string  `json:"key"`
	Code   string  `json:"code"`
}

type remoteDesktopWSRequest struct {
	Type  string                    `json:"type"`
	Input remoteDesktopInputRequest `json:"input"`
}

func (s *Server) handleRemoteMeta(w http.ResponseWriter, r *http.Request) {
	b, err := primaryDisplayBounds()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"available": false,
			"platform":  runtime.GOOS,
			"can_input": remoteInputSupported(),
			"error":     err.Error(),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"available":       true,
		"platform":        runtime.GOOS,
		"can_input":       remoteInputSupported(),
		"width":           b.Dx(),
		"height":          b.Dy(),
		"default_fps":     10,
		"default_quality": 65,
		"default_scale":   0.75,
	})
}

func (s *Server) handleRemoteDesktopWS(w http.ResponseWriter, r *http.Request) {
	conn, err := remoteWSUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	fps := clampInt(parseIntDefault(r.URL.Query().Get("fps"), 10), 2, 20)
	quality := clampInt(parseIntDefault(r.URL.Query().Get("quality"), 65), 35, 90)
	scale := clampScale(parseFloatDefault(r.URL.Query().Get("scale"), 0.75))
	baseFrameInterval := intervalFromFPS(fps)

	_ = conn.SetReadDeadline(time.Now().Add(remoteWSReadTimeout))
	conn.SetReadLimit(remoteWSMaxReadBytes)
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(remoteWSReadTimeout))
	})

	done := make(chan struct{})
	go s.remoteDesktopWSReader(conn, done)

	frameTicker := time.NewTicker(baseFrameInterval)
	defer frameTicker.Stop()
	pingTicker := time.NewTicker(remoteWSPingInterval)
	defer pingTicker.Stop()

	currentFrameInterval := baseFrameInterval
	lastW, lastH := 0, 0
	lastFrameChecksum := uint32(0)
	lastFrameSentAt := time.Time{}
	lastCaptureError := ""
	lastCaptureErrorAt := time.Time{}

	for {
		select {
		case <-done:
			return
		case <-pingTicker.C:
			_ = conn.SetWriteDeadline(time.Now().Add(remoteWSWriteTimeout))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		case <-frameTicker.C:
			captureStarted := time.Now()
			frame, fw, fh, capErr := captureDesktopJPEG(scale, quality)
			captureCost := time.Since(captureStarted)

			nextInterval := calcNextFrameInterval(baseFrameInterval, captureCost)
			if nextInterval != currentFrameInterval {
				currentFrameInterval = nextInterval
				frameTicker.Reset(nextInterval)
			}

			if capErr != nil {
				shouldPushErr := capErr.Error() != lastCaptureError || time.Since(lastCaptureErrorAt) > 2*time.Second
				if shouldPushErr {
					_ = conn.SetWriteDeadline(time.Now().Add(remoteWSWriteTimeout))
					if err := conn.WriteJSON(map[string]any{
						"type":  "error",
						"ts":    time.Now().UnixMilli(),
						"error": capErr.Error(),
					}); err != nil {
						return
					}
					lastCaptureError = capErr.Error()
					lastCaptureErrorAt = time.Now()
				}
				continue
			}
			lastCaptureError = ""

			if fw != lastW || fh != lastH {
				meta := remoteDesktopMeta{
					Type:      "meta",
					Width:     fw,
					Height:    fh,
					Scale:     scale,
					Quality:   quality,
					FPS:       fps,
					Platform:  runtime.GOOS,
					CanInput:  remoteInputSupported(),
					Timestamp: time.Now().UnixMilli(),
				}
				_ = conn.SetWriteDeadline(time.Now().Add(remoteWSWriteTimeout))
				if err := conn.WriteJSON(meta); err != nil {
					return
				}
				lastW, lastH = fw, fh
			}

			checksum := crc32.ChecksumIEEE(frame)
			now := time.Now()
			unchanged := checksum == lastFrameChecksum
			if unchanged && !lastFrameSentAt.IsZero() && now.Sub(lastFrameSentAt) < remoteIdleFramePushPeriod {
				continue
			}

			_ = conn.SetWriteDeadline(time.Now().Add(remoteWSWriteTimeout))
			if err := conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
				return
			}
			lastFrameChecksum = checksum
			lastFrameSentAt = now
		}
	}
}

func (s *Server) remoteDesktopWSReader(conn *websocket.Conn, done chan<- struct{}) {
	defer close(done)

	for {
		messageType, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}
		if messageType != websocket.TextMessage || len(payload) == 0 {
			continue
		}

		var req remoteDesktopWSRequest
		if err := json.Unmarshal(payload, &req); err != nil {
			continue
		}
		if !strings.EqualFold(strings.TrimSpace(req.Type), "input") {
			continue
		}
		_ = s.applyRemoteDesktopInput(req.Input)
	}
}

func (s *Server) handleRemoteDesktopInput(w http.ResponseWriter, r *http.Request) {
	var req remoteDesktopInputRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.applyRemoteDesktopInput(req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) applyRemoteDesktopInput(req remoteDesktopInputRequest) error {
	if !remoteInputSupported() {
		return fmt.Errorf("当前系统暂不支持网页输入控制")
	}

	b, err := primaryDisplayBounds()
	if err != nil {
		return err
	}
	x, y := denormalizePoint(req.X, req.Y, b)

	switch strings.TrimSpace(req.Type) {
	case "move":
		return remoteInputMove(x, y)
	case "down":
		if err := remoteInputMove(x, y); err != nil {
			return err
		}
		return remoteInputMouseButton(req.Button, true)
	case "up":
		if err := remoteInputMove(x, y); err != nil {
			return err
		}
		return remoteInputMouseButton(req.Button, false)
	case "wheel":
		return remoteInputWheel(req.Delta)
	case "key_down":
		return remoteInputKey(req.Key, req.Code, true)
	case "key_up":
		return remoteInputKey(req.Key, req.Code, false)
	case "key_tap":
		return remoteInputKeyTap(req.Key, req.Code)
	default:
		return fmt.Errorf("unknown input type: %s", req.Type)
	}
}

func captureDesktopJPEG(scale float64, quality int) ([]byte, int, int, error) {
	b, err := primaryDisplayBounds()
	if err != nil {
		return nil, 0, 0, err
	}
	img, err := screenshot.CaptureRect(b)
	if err != nil {
		return nil, 0, 0, err
	}
	w, h := b.Dx(), b.Dy()
	if scale > 0 && scale < 0.999 {
		tw := int(math.Max(2, math.Round(float64(w)*scale)))
		th := int(math.Max(2, math.Round(float64(h)*scale)))
		dst := image.NewRGBA(image.Rect(0, 0, tw, th))
		draw.CatmullRom.Scale(dst, dst.Bounds(), img, img.Bounds(), draw.Over, nil)
		img = dst
		w, h = tw, th
	}
	buf := bytes.NewBuffer(make([]byte, 0, w*h/4))
	if err := jpeg.Encode(buf, img, &jpeg.Options{Quality: clampInt(quality, 35, 90)}); err != nil {
		return nil, 0, 0, err
	}
	return buf.Bytes(), w, h, nil
}

func primaryDisplayBounds() (image.Rectangle, error) {
	count := screenshot.NumActiveDisplays()
	if count <= 0 {
		return image.Rectangle{}, fmt.Errorf("未检测到可用显示器")
	}
	return screenshot.GetDisplayBounds(0), nil
}

func denormalizePoint(nx, ny float64, bounds image.Rectangle) (int, int) {
	xr := nx
	yr := ny
	if xr < 0 {
		xr = 0
	}
	if xr > 1 {
		xr = 1
	}
	if yr < 0 {
		yr = 0
	}
	if yr > 1 {
		yr = 1
	}
	x := bounds.Min.X + int(math.Round(xr*float64(remoteMaxInt(bounds.Dx()-1, 1))))
	y := bounds.Min.Y + int(math.Round(yr*float64(remoteMaxInt(bounds.Dy()-1, 1))))
	return x, y
}

func parseIntDefault(raw string, fallback int) int {
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return fallback
	}
	return v
}

func parseFloatDefault(raw string, fallback float64) float64 {
	v, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil {
		return fallback
	}
	return v
}

func clampInt(v, min, max int) int {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func clampScale(v float64) float64 {
	if v < 0.25 {
		return 0.25
	}
	if v > 1 {
		return 1
	}
	return v
}

func intervalFromFPS(fps int) time.Duration {
	if fps <= 0 {
		fps = 8
	}
	interval := time.Second / time.Duration(fps)
	if interval < remoteMinFrameInterval {
		return remoteMinFrameInterval
	}
	if interval > remoteMaxFrameInterval {
		return remoteMaxFrameInterval
	}
	return interval
}

func calcNextFrameInterval(base, captureCost time.Duration) time.Duration {
	next := base
	if captureCost > base {
		next = captureCost + 20*time.Millisecond
	} else if captureCost*2 > base {
		next = base + 20*time.Millisecond
	}
	if next < remoteMinFrameInterval {
		return remoteMinFrameInterval
	}
	if next > remoteMaxFrameInterval {
		return remoteMaxFrameInterval
	}
	return next
}

func remoteMaxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
