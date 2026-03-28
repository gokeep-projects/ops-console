//go:build linux

package web

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"unicode"
)

func remoteInputSupported() bool {
	if strings.TrimSpace(os.Getenv("DISPLAY")) == "" {
		return false
	}
	_, err := exec.LookPath("xdotool")
	return err == nil
}

func remoteInputMove(x, y int) error {
	return runXdotool("mousemove", "--sync", strconv.Itoa(x), strconv.Itoa(y))
}

func remoteInputMouseButton(button string, down bool) error {
	btn := mouseButtonNumber(button)
	if btn == "" {
		return fmt.Errorf("unsupported mouse button: %s", button)
	}
	if down {
		return runXdotool("mousedown", btn)
	}
	return runXdotool("mouseup", btn)
}

func remoteInputWheel(delta int) error {
	if delta == 0 {
		return nil
	}
	steps := delta
	if steps < 0 {
		steps = -steps
	}
	button := "4"
	if delta < 0 {
		button = "5"
	}
	for i := 0; i < steps; i++ {
		if err := runXdotool("click", button); err != nil {
			return err
		}
	}
	return nil
}

func remoteInputKeyTap(key, code string) error {
	linuxKey, ok := linuxKeyFromInput(key, code)
	if !ok {
		return fmt.Errorf("unsupported key: %s/%s", key, code)
	}
	return runXdotool("key", linuxKey)
}

func remoteInputKey(key, code string, down bool) error {
	linuxKey, ok := linuxKeyFromInput(key, code)
	if !ok {
		return fmt.Errorf("unsupported key: %s/%s", key, code)
	}
	if down {
		return runXdotool("keydown", linuxKey)
	}
	return runXdotool("keyup", linuxKey)
}

func runXdotool(args ...string) error {
	cmd := exec.Command("xdotool", args...)
	out, err := cmd.CombinedOutput()
	if err == nil {
		return nil
	}
	msg := strings.TrimSpace(string(out))
	if msg == "" {
		return fmt.Errorf("xdotool failed: %w", err)
	}
	return fmt.Errorf("xdotool failed: %s", msg)
}

func mouseButtonNumber(button string) string {
	switch strings.ToLower(strings.TrimSpace(button)) {
	case "", "left":
		return "1"
	case "middle":
		return "2"
	case "right":
		return "3"
	default:
		return ""
	}
}

func linuxKeyFromInput(key, code string) (string, bool) {
	if v, ok := linuxKeyByCode(strings.TrimSpace(code)); ok {
		return v, true
	}
	if v, ok := linuxKeyByName(strings.TrimSpace(key)); ok {
		return v, true
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", false
	}
	runes := []rune(key)
	if len(runes) == 1 {
		r := runes[0]
		if unicode.IsPrint(r) {
			return string(r), true
		}
	}
	return "", false
}

func linuxKeyByCode(code string) (string, bool) {
	if code == "" {
		return "", false
	}
	switch code {
	case "Enter", "NumpadEnter":
		return "Return", true
	case "Escape":
		return "Escape", true
	case "Tab":
		return "Tab", true
	case "Backspace":
		return "BackSpace", true
	case "Space":
		return "space", true
	case "ArrowUp":
		return "Up", true
	case "ArrowDown":
		return "Down", true
	case "ArrowLeft":
		return "Left", true
	case "ArrowRight":
		return "Right", true
	case "Delete":
		return "Delete", true
	case "Home":
		return "Home", true
	case "End":
		return "End", true
	case "PageUp":
		return "Page_Up", true
	case "PageDown":
		return "Page_Down", true
	case "ShiftLeft", "ShiftRight":
		return "Shift_L", true
	case "ControlLeft", "ControlRight":
		return "Control_L", true
	case "AltLeft", "AltRight":
		return "Alt_L", true
	case "MetaLeft", "MetaRight":
		return "Super_L", true
	}
	if strings.HasPrefix(code, "Key") && len(code) == 4 {
		r := unicode.ToLower(rune(code[3]))
		if r >= 'a' && r <= 'z' {
			return string(r), true
		}
	}
	if strings.HasPrefix(code, "Digit") && len(code) == 6 {
		r := rune(code[5])
		if r >= '0' && r <= '9' {
			return string(r), true
		}
	}
	if strings.HasPrefix(code, "F") {
		n := strings.TrimPrefix(code, "F")
		if _, err := strconv.Atoi(n); err == nil {
			return "F" + n, true
		}
	}
	return "", false
}

func linuxKeyByName(name string) (string, bool) {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "enter", "return":
		return "Return", true
	case "esc", "escape":
		return "Escape", true
	case "tab":
		return "Tab", true
	case "backspace":
		return "BackSpace", true
	case "space", " ":
		return "space", true
	case "shift":
		return "Shift_L", true
	case "ctrl", "control":
		return "Control_L", true
	case "alt":
		return "Alt_L", true
	}
	return "", false
}
