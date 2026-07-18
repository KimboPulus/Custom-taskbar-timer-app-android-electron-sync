package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

const (
	swpNoActivate = 0x0010
	swpShowWindow = 0x0040
	vkRightAlt    = 0xA5
	keyDownMask   = 0x8000
)

type virtualKeySet []uintptr

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
	if args[1] == "monitor-right-alt" {
		if len(args) != 2 {
			return errors.New("monitor-right-alt does not accept arguments")
		}
		return monitorRightAlt()
	}
	if args[1] == "wait-shortcut-release" {
		if len(args) != 3 {
			return errors.New("wait-shortcut-release expects an accelerator argument")
		}
		return waitShortcutRelease(args[2])
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

func monitorRightAlt() error {
	output := bufio.NewWriter(os.Stdout)
	lastState := rightAltDown()
	if err := writeRightAltState(output, lastState); err != nil {
		return err
	}

	for {
		time.Sleep(5 * time.Millisecond)
		currentState := rightAltDown()
		if currentState == lastState {
			continue
		}
		if err := writeRightAltState(output, currentState); err != nil {
			return err
		}
		lastState = currentState
	}
}

func waitShortcutRelease(accelerator string) error {
	keys, err := releaseKeysForAccelerator(accelerator)
	if err != nil {
		return err
	}

	for anyKeyDown(keys) {
		time.Sleep(10 * time.Millisecond)
	}
	return nil
}

func releaseKeysForAccelerator(accelerator string) (virtualKeySet, error) {
	tokens := strings.Split(accelerator, "+")
	for index := len(tokens) - 1; index >= 0; index-- {
		token := strings.TrimSpace(tokens[index])
		if token == "" || isAcceleratorModifier(token) {
			continue
		}
		keys, ok := virtualKeysForAcceleratorToken(token)
		if !ok {
			return nil, fmt.Errorf("unsupported shortcut key: %s", token)
		}
		return keys, nil
	}
	return nil, errors.New("shortcut accelerator has no release key")
}

func isAcceleratorModifier(token string) bool {
	switch strings.ToLower(strings.TrimSpace(token)) {
	case "alt", "control", "ctrl", "shift", "super", "meta", "command", "cmd", "commandorcontrol", "cmdorctrl":
		return true
	default:
		return false
	}
}

func virtualKeysForAcceleratorToken(token string) (virtualKeySet, bool) {
	normalized := strings.ToLower(strings.TrimSpace(token))
	switch normalized {
	case "space":
		return virtualKeySet{0x20}, true
	case "up":
		return virtualKeySet{0x26}, true
	case "down":
		return virtualKeySet{0x28}, true
	case "left":
		return virtualKeySet{0x25}, true
	case "right":
		return virtualKeySet{0x27}, true
	case "enter", "return":
		return virtualKeySet{0x0D}, true
	case "escape", "esc":
		return virtualKeySet{0x1B}, true
	case "tab":
		return virtualKeySet{0x09}, true
	case "backspace":
		return virtualKeySet{0x08}, true
	case "delete", "del":
		return virtualKeySet{0x2E}, true
	}

	if len(normalized) == 1 {
		key := normalized[0]
		if key >= 'a' && key <= 'z' {
			return virtualKeySet{uintptr(key - 'a' + 'A')}, true
		}
		if key >= '0' && key <= '9' {
			return virtualKeySet{uintptr(key)}, true
		}
	}

	if strings.HasPrefix(normalized, "f") {
		number, err := strconv.Atoi(normalized[1:])
		if err == nil && number >= 1 && number <= 24 {
			return virtualKeySet{uintptr(0x70 + number - 1)}, true
		}
	}

	return nil, false
}

func writeRightAltState(output *bufio.Writer, down bool) error {
	state := "up"
	if down {
		state = "down"
	}
	if _, err := fmt.Fprintln(output, state); err != nil {
		return err
	}
	return output.Flush()
}

func rightAltDown() bool {
	return keyDown(vkRightAlt)
}

func anyKeyDown(keys virtualKeySet) bool {
	for _, key := range keys {
		if keyDown(key) {
			return true
		}
	}
	return false
}

func keyDown(key uintptr) bool {
	state, _, _ := getAsyncKeyState.Call(key)
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
