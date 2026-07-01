package main

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"syscall"
	"unsafe"
)

const (
	swpNoActivate = 0x0010
	swpShowWindow = 0x0040
	vkRightAlt    = 0xA5
	keyDownMask   = 0x8000
)

var (
	user32             = syscall.NewLazyDLL("user32.dll")
	kernel32           = syscall.NewLazyDLL("kernel32.dll")
	findWindowW        = user32.NewProc("FindWindowW")
	getAsyncKeyState   = user32.NewProc("GetAsyncKeyState")
	setParent          = user32.NewProc("SetParent")
	setProcessDPIAware = user32.NewProc("SetProcessDPIAware")
	setWindowPos       = user32.NewProc("SetWindowPos")
	setLastError       = kernel32.NewProc("SetLastError")
)

func main() {
	if err := run(os.Args); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) < 2 {
		return errors.New("expected a helper command")
	}

	if args[1] == "allow-shortcut" {
		if len(args) != 2 {
			return errors.New("allow-shortcut does not accept arguments")
		}
		if rightAltDown() {
			return errors.New("right Alt is active")
		}
		return nil
	}

	if len(args) < 3 {
		return errors.New("expected attach or detach arguments")
	}

	setProcessDPIAware.Call()
	child, err := parseUintptr(args[2])
	if err != nil {
		return errors.New("invalid window handle argument")
	}

	switch args[1] {
	case "attach":
		return attach(args, child)
	case "detach":
		return detach(child)
	default:
		return errors.New("unknown taskbar helper command")
	}
}

func rightAltDown() bool {
	state, _, _ := getAsyncKeyState.Call(vkRightAlt)
	return state&keyDownMask != 0
}

func attach(args []string, child uintptr) error {
	if len(args) != 6 {
		return errors.New("attach expects a handle, x, width, and height")
	}

	taskbarClass, err := syscall.UTF16PtrFromString("Shell_TrayWnd")
	if err != nil {
		return err
	}
	taskbar, _, _ := findWindowW.Call(uintptr(unsafe.Pointer(taskbarClass)), 0)
	if taskbar == 0 {
		return errors.New("Windows taskbar window was not found")
	}

	if err := changeParent(child, taskbar); err != nil {
		return errors.New("could not attach the timer to the Windows taskbar")
	}

	x, err := parseInt32(args[3])
	if err != nil {
		return errors.New("invalid x position argument")
	}
	width, err := parseInt32(args[4])
	if err != nil {
		return errors.New("invalid width argument")
	}
	height, err := parseInt32(args[5])
	if err != nil {
		return errors.New("invalid height argument")
	}

	positioned, _, callErr := setWindowPos.Call(
		child,
		0,
		uintptr(x),
		0,
		uintptr(width),
		uintptr(height),
		swpNoActivate|swpShowWindow,
	)
	if positioned == 0 {
		return fmt.Errorf("could not position the timer inside the Windows taskbar: %w", callErr)
	}

	return nil
}

func detach(child uintptr) error {
	if err := changeParent(child, 0); err != nil {
		return errors.New("could not detach the timer from the taskbar")
	}
	return nil
}

func changeParent(child, parent uintptr) error {
	setLastError.Call(0)
	previousParent, _, callErr := setParent.Call(child, parent)
	if previousParent == 0 && !errors.Is(callErr, syscall.Errno(0)) {
		return callErr
	}
	return nil
}

func parseUintptr(value string) (uintptr, error) {
	parsed, err := strconv.ParseUint(value, 10, 64)
	return uintptr(parsed), err
}

func parseInt32(value string) (int32, error) {
	parsed, err := strconv.ParseInt(value, 10, 32)
	return int32(parsed), err
}
