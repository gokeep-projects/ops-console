//go:build !windows && !linux

package monitor

func getProductID() string {
	return ""
}
