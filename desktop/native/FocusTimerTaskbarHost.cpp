#define NOMINMAX

#include <windows.h>

#include <cerrno>
#include <climits>
#include <cstdint>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <string>

namespace {
constexpr UINT kWindowFlags = SWP_NOACTIVATE | SWP_SHOWWINDOW;

unsigned long long parseUnsignedLongLong(const wchar_t* value) {
  wchar_t* end = nullptr;
  errno = 0;
  const unsigned long long result = std::wcstoull(value, &end, 10);
  if (errno != 0 || end == value || *end != L'\0') {
    throw std::invalid_argument("Invalid numeric argument.");
  }
  return result;
}

HWND parseWindowHandle(const wchar_t* value) {
  const unsigned long long result = parseUnsignedLongLong(value);
  if (result > std::numeric_limits<uintptr_t>::max()) {
    throw std::out_of_range("Window handle is outside the pointer range.");
  }
  return reinterpret_cast<HWND>(static_cast<uintptr_t>(result));
}

int parseInt(const wchar_t* value) {
  wchar_t* end = nullptr;
  errno = 0;
  const long long result = std::wcstoll(value, &end, 10);
  if (errno != 0 || end == value || *end != L'\0' || result < INT_MIN ||
      result > INT_MAX) {
    throw std::invalid_argument("Invalid integer argument.");
  }
  return static_cast<int>(result);
}

bool rightAltDown() {
  return (GetAsyncKeyState(VK_RMENU) & 0x8000) != 0;
}

void writeRightAltState(bool down) {
  std::cout << (down ? "down" : "up") << std::endl;
}

int monitorRightAlt() {
  bool lastState = rightAltDown();
  writeRightAltState(lastState);

  while (std::cout.good()) {
    Sleep(5);
    const bool currentState = rightAltDown();
    if (currentState != lastState) {
      writeRightAltState(currentState);
      lastState = currentState;
    }
  }
  return 0;
}

void changeParent(HWND child, HWND parent, const char* message) {
  SetLastError(ERROR_SUCCESS);
  const HWND previousParent = SetParent(child, parent);
  if (previousParent == nullptr && GetLastError() != ERROR_SUCCESS) {
    throw std::runtime_error(message);
  }
}

void requireSuccess(BOOL result, const char* message) {
  if (!result) {
    throw std::runtime_error(message);
  }
}
}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  try {
    if (argc < 2) {
      throw std::invalid_argument("Expected a helper command.");
    }

    const std::wstring command = argv[1];
    if (command == L"allow-shortcut") {
      if (argc != 2) {
        throw std::invalid_argument(
            "allow-shortcut does not accept arguments.");
      }
      return rightAltDown() ? 1 : 0;
    }

    if (command == L"monitor-right-alt") {
      if (argc != 2) {
        throw std::invalid_argument(
            "monitor-right-alt does not accept arguments.");
      }
      return monitorRightAlt();
    }

    if (argc < 3) {
      throw std::invalid_argument("Expected attach or detach arguments.");
    }

    SetProcessDPIAware();
    const HWND child = parseWindowHandle(argv[2]);

    if (command == L"attach") {
      if (argc != 6) {
        throw std::invalid_argument(
            "Attach expects a handle, x, width, and height.");
      }

      const HWND taskbar = FindWindowW(L"Shell_TrayWnd", nullptr);
      if (taskbar == nullptr) {
        throw std::runtime_error("Windows taskbar window was not found.");
      }

      changeParent(child, taskbar,
                   "Could not attach the timer to the Windows taskbar.");
      requireSuccess(
          SetWindowPos(child, nullptr, parseInt(argv[3]), 0, parseInt(argv[4]),
                       parseInt(argv[5]), kWindowFlags),
          "Could not position the timer inside the Windows taskbar.");
      return 0;
    }

    if (command == L"detach") {
      if (argc != 3) {
        throw std::invalid_argument("Detach expects a window handle.");
      }
      changeParent(child, nullptr,
                   "Could not detach the timer from the taskbar.");
      return 0;
    }

    throw std::invalid_argument("Unknown taskbar helper command.");
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
