//go:build !windows && !linux

package web

import "fmt"

func remoteInputSupported() bool { return false }

func remoteInputMove(x, y int) error { return fmt.Errorf("当前系统暂不支持网页输入控制") }

func remoteInputMouseButton(button string, down bool) error {
	return fmt.Errorf("当前系统暂不支持网页输入控制")
}

func remoteInputWheel(delta int) error {
	return fmt.Errorf("当前系统暂不支持网页输入控制")
}

func remoteInputKey(key, code string, down bool) error {
	return fmt.Errorf("当前系统暂不支持网页输入控制")
}

func remoteInputKeyTap(key, code string) error {
	return fmt.Errorf("当前系统暂不支持网页输入控制")
}
