#define UNICODE
#define _UNICODE

#include <windows.h>

#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {
constexpr UINT kWindowFlags = SWP_NOACTIVATE | SWP_SHOWWINDOW;

long long parseLongLong(const wchar_t* value) {
  wchar_t* end = nullptr;
  errno = 0;
  const long long result = std::wcstoll(value, &end, 10);
  if (errno != 0 || end == value || *end != L'\0') {
    throw std::invalid_argument("Invalid numeric argument.");
  }
  return result;
}

int parseInt(const wchar_t* value) {
  const long long result = parseLongLong(value);
  if (result < INT_MIN || result > INT_MAX) {
    throw std::out_of_range("Numeric argument is outside the integer range.");
  }
  return static_cast<int>(result);
}

void requireSuccess(BOOL result, const char* message) {
  if (!result) {
    throw std::runtime_error(message);
  }
}
}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  try {
    if (argc < 3) {
      throw std::invalid_argument("Expected attach or detach arguments.");
    }

    SetProcessDPIAware();
    HWND child = reinterpret_cast<HWND>(
        static_cast<intptr_t>(parseLongLong(argv[2])));

    const std::wstring command = argv[1];
    if (command == L"attach") {
      if (argc != 6) {
        throw std::invalid_argument(
            "Attach expects a handle, x, width, and height.");
      }

      HWND taskbar = FindWindowW(L"Shell_TrayWnd", nullptr);
      if (taskbar == nullptr) {
        throw std::runtime_error("Windows taskbar window was not found.");
      }

      SetLastError(ERROR_SUCCESS);
      HWND previousParent = SetParent(child, taskbar);
      if (previousParent == nullptr && GetLastError() != ERROR_SUCCESS) {
        throw std::runtime_error(
            "Could not attach the timer to the Windows taskbar.");
      }

      requireSuccess(
          SetWindowPos(child, nullptr, parseInt(argv[3]), 0, parseInt(argv[4]),
                       parseInt(argv[5]), kWindowFlags),
          "Could not position the timer inside the Windows taskbar.");
      return 0;
    }

    if (command == L"detach") {
      SetLastError(ERROR_SUCCESS);
      HWND previousParent = SetParent(child, nullptr);
      if (previousParent == nullptr && GetLastError() != ERROR_SUCCESS) {
        throw std::runtime_error("Could not detach the timer from the taskbar.");
      }
      return 0;
    }

    throw std::invalid_argument("Unknown taskbar helper command.");
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
