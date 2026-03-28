//go:build windows

package web

import (
	"fmt"
	"strings"
	"unicode"

	"golang.org/x/sys/windows"
)

const (
	mouseeventfMove       = 0x0001
	mouseeventfLeftDown   = 0x0002
	mouseeventfLeftUp     = 0x0004
	mouseeventfRightDown  = 0x0008
	mouseeventfRightUp    = 0x0010
	mouseeventfMiddleDown = 0x0020
	mouseeventfMiddleUp   = 0x0040
	mouseeventfWheel      = 0x0800

	keyeventfKeyUp = 0x0002
)

var (
	user32             = windows.NewLazySystemDLL("user32.dll")
	procSetCursorPos   = user32.NewProc("SetCursorPos")
	procMouseEvent     = user32.NewProc("mouse_event")
	procKeybdEvent     = user32.NewProc("keybd_event")
	procVkKeyScanW     = user32.NewProc("VkKeyScanW")
	procMapVirtualKeyW = user32.NewProc("MapVirtualKeyW")
)

func remoteInputSupported() bool { return true }

func remoteInputMove(x, y int) error {
	r1, _, err := procSetCursorPos.Call(uintptr(x), uintptr(y))
	if r1 == 0 {
		if err != windows.ERROR_SUCCESS {
			return err
		}
		return fmt.Errorf("SetCursorPos failed")
	}
	return nil
}

func remoteInputMouseButton(button string, down bool) error {
	b := strings.ToLower(strings.TrimSpace(button))
	if b == "" {
		b = "left"
	}
	flag := uintptr(0)
	switch b {
	case "left":
		if down {
			flag = mouseeventfLeftDown
		} else {
			flag = mouseeventfLeftUp
		}
	case "right":
		if down {
			flag = mouseeventfRightDown
		} else {
			flag = mouseeventfRightUp
		}
	case "middle":
		if down {
			flag = mouseeventfMiddleDown
		} else {
			flag = mouseeventfMiddleUp
		}
	default:
		return fmt.Errorf("unsupported mouse button: %s", button)
	}
	procMouseEvent.Call(flag, 0, 0, 0, 0)
	return nil
}

func remoteInputWheel(delta int) error {
	if delta == 0 {
		return nil
	}
	steps := int32(delta * 120)
	procMouseEvent.Call(mouseeventfWheel, 0, 0, uintptr(uint32(steps)), 0)
	return nil
}

func remoteInputKeyTap(key, code string) error {
	if err := remoteInputKey(key, code, true); err != nil {
		return err
	}
	return remoteInputKey(key, code, false)
}

func remoteInputKey(key, code string, down bool) error {
	vk, needShift, ok := virtualKeyFromInput(key, code)
	if !ok {
		return fmt.Errorf("unsupported key: %s/%s", key, code)
	}
	if needShift && down {
		emitKeyEvent(0x10, true)
	}
	emitKeyEvent(vk, down)
	if needShift && !down {
		emitKeyEvent(0x10, false)
	}
	return nil
}

func emitKeyEvent(vk uint16, down bool) {
	scan, _, _ := procMapVirtualKeyW.Call(uintptr(vk), 0)
	flags := uintptr(0)
	if !down {
		flags = keyeventfKeyUp
	}
	procKeybdEvent.Call(uintptr(vk), scan, flags, 0)
}

func virtualKeyFromInput(key, code string) (uint16, bool, bool) {
	if vk, ok := virtualKeyByCode(strings.TrimSpace(code)); ok {
		return vk, false, true
	}
	if vk, ok := virtualKeyByName(strings.TrimSpace(key)); ok {
		return vk, false, true
	}
	runes := []rune(strings.TrimSpace(key))
	if len(runes) == 1 {
		r := runes[0]
		ret, _, _ := procVkKeyScanW.Call(uintptr(r))
		v := int16(ret)
		if v == -1 {
			return 0, false, false
		}
		vk := uint16(v & 0xff)
		mods := uint16((v >> 8) & 0xff)
		needShift := (mods & 0x01) != 0
		return vk, needShift, true
	}
	return 0, false, false
}

func virtualKeyByCode(code string) (uint16, bool) {
	if code == "" {
		return 0, false
	}
	switch code {
	case "Enter", "NumpadEnter":
		return 0x0D, true
	case "Escape":
		return 0x1B, true
	case "Tab":
		return 0x09, true
	case "Backspace":
		return 0x08, true
	case "Space":
		return 0x20, true
	case "ArrowUp":
		return 0x26, true
	case "ArrowDown":
		return 0x28, true
	case "ArrowLeft":
		return 0x25, true
	case "ArrowRight":
		return 0x27, true
	case "Delete":
		return 0x2E, true
	case "Home":
		return 0x24, true
	case "End":
		return 0x23, true
	case "PageUp":
		return 0x21, true
	case "PageDown":
		return 0x22, true
	case "ShiftLeft", "ShiftRight":
		return 0x10, true
	case "ControlLeft", "ControlRight":
		return 0x11, true
	case "AltLeft", "AltRight":
		return 0x12, true
	case "MetaLeft", "MetaRight":
		return 0x5B, true
	}
	if strings.HasPrefix(code, "Key") && len(code) == 4 {
		r := unicode.ToUpper(rune(code[3]))
		if r >= 'A' && r <= 'Z' {
			return uint16(r), true
		}
	}
	if strings.HasPrefix(code, "Digit") && len(code) == 6 {
		r := rune(code[5])
		if r >= '0' && r <= '9' {
			return uint16(r), true
		}
	}
	if strings.HasPrefix(code, "F") {
		n := strings.TrimPrefix(code, "F")
		switch n {
		case "1":
			return 0x70, true
		case "2":
			return 0x71, true
		case "3":
			return 0x72, true
		case "4":
			return 0x73, true
		case "5":
			return 0x74, true
		case "6":
			return 0x75, true
		case "7":
			return 0x76, true
		case "8":
			return 0x77, true
		case "9":
			return 0x78, true
		case "10":
			return 0x79, true
		case "11":
			return 0x7A, true
		case "12":
			return 0x7B, true
		}
	}
	return 0, false
}

func virtualKeyByName(name string) (uint16, bool) {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "enter", "return":
		return 0x0D, true
	case "esc", "escape":
		return 0x1B, true
	case "tab":
		return 0x09, true
	case "backspace":
		return 0x08, true
	case "space", " ":
		return 0x20, true
	case "shift":
		return 0x10, true
	case "ctrl", "control":
		return 0x11, true
	case "alt":
		return 0x12, true
	}
	return 0, false
}
