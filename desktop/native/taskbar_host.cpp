#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

#include <charconv>
#include <chrono>
#include <cstdint>
#include <iostream>
#include <limits>
#include <string>
#include <string_view>
#include <system_error>
#include <thread>
#include <vector>

namespace {

constexpr UINT kSwpNoActivate = 0x0010;
constexpr UINT kSwpShowWindow = 0x0040;
constexpr int kRightAlt = VK_RMENU;
constexpr SHORT kKeyDownMask = static_cast<SHORT>(0x8000);

struct ParsedInt32 {
  int value = 0;
  bool ok = false;
};

bool rightAltDown() {
  return (GetAsyncKeyState(kRightAlt) & kKeyDownMask) != 0;
}

bool parseUintPtr(std::string_view value, uintptr_t& output) {
  if (value.empty() || value.front() == '-') {
    return false;
  }

  uint64_t parsed = 0;
  const auto result = std::from_chars(
    value.data(),
    value.data() + value.size(),
    parsed
  );
  if (result.ec != std::errc() || result.ptr != value.data() + value.size()) {
    return false;
  }

  output = static_cast<uintptr_t>(parsed);
  return static_cast<uint64_t>(output) == parsed;
}

ParsedInt32 parseInt32(std::string_view value) {
  if (value.empty()) {
    return {};
  }

  int64_t parsed = 0;
  const auto result = std::from_chars(
    value.data(),
    value.data() + value.size(),
    parsed
  );
  if (
    result.ec != std::errc() ||
    result.ptr != value.data() + value.size() ||
    parsed < std::numeric_limits<int32_t>::min() ||
    parsed > std::numeric_limits<int32_t>::max()
  ) {
    return {};
  }

  return { static_cast<int>(parsed), true };
}

void writeError(std::string_view message) {
  std::cerr << message << '\n';
}

int monitorRightAlt() {
  bool lastState = rightAltDown();
  std::cout << (lastState ? "down" : "up") << std::endl;

  for (;;) {
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
    const bool currentState = rightAltDown();
    if (currentState == lastState) {
      continue;
    }
    std::cout << (currentState ? "down" : "up") << std::endl;
    lastState = currentState;
  }
}

bool changeParent(HWND child, HWND parent) {
  SetLastError(ERROR_SUCCESS);
  const HWND previousParent = SetParent(child, parent);
  const DWORD error = GetLastError();
  return previousParent != nullptr || error == ERROR_SUCCESS;
}

int attach(const std::vector<std::string>& args, HWND child) {
  if (args.size() != 6) {
    writeError("attach expects a handle, x, width, and height");
    return 1;
  }

  const HWND taskbar = FindWindowW(L"Shell_TrayWnd", nullptr);
  if (taskbar == nullptr) {
    writeError("Windows taskbar window was not found");
    return 1;
  }

  if (!changeParent(child, taskbar)) {
    writeError("could not attach the timer to the Windows taskbar");
    return 1;
  }

  const ParsedInt32 x = parseInt32(args[3]);
  if (!x.ok) {
    writeError("invalid x position argument");
    return 1;
  }
  const ParsedInt32 width = parseInt32(args[4]);
  if (!width.ok) {
    writeError("invalid width argument");
    return 1;
  }
  const ParsedInt32 height = parseInt32(args[5]);
  if (!height.ok) {
    writeError("invalid height argument");
    return 1;
  }

  if (
    !SetWindowPos(
      child,
      nullptr,
      x.value,
      0,
      width.value,
      height.value,
      kSwpNoActivate | kSwpShowWindow
    )
  ) {
    writeError("could not position the timer inside the Windows taskbar");
    return 1;
  }

  return 0;
}

int detach(HWND child) {
  if (!changeParent(child, nullptr)) {
    writeError("could not detach the timer from the taskbar");
    return 1;
  }
  return 0;
}

int run(const std::vector<std::string>& args) {
  if (args.size() < 2) {
    writeError("expected a helper command");
    return 1;
  }

  if (args[1] == "allow-shortcut") {
    if (args.size() != 2) {
      writeError("allow-shortcut does not accept arguments");
      return 1;
    }
    if (rightAltDown()) {
      writeError("right Alt is active");
      return 1;
    }
    return 0;
  }

  if (args[1] == "monitor-right-alt") {
    if (args.size() != 2) {
      writeError("monitor-right-alt does not accept arguments");
      return 1;
    }
    return monitorRightAlt();
  }

  if (args.size() < 3) {
    writeError("expected attach or detach arguments");
    return 1;
  }

  SetProcessDPIAware();

  uintptr_t rawChild = 0;
  if (!parseUintPtr(args[2], rawChild)) {
    writeError("invalid window handle argument");
    return 1;
  }

  const HWND child = reinterpret_cast<HWND>(rawChild);
  if (args[1] == "attach") {
    return attach(args, child);
  }
  if (args[1] == "detach") {
    return detach(child);
  }

  writeError("unknown taskbar helper command");
  return 1;
}

bool expectFailure(std::vector<std::string> args) {
  return run(args) != 0;
}

int runSelfTest() {
  if (!expectFailure({ "helper" })) {
    writeError("self-test failed: missing command");
    return 1;
  }
  if (!expectFailure({ "helper", "detach", "invalid" })) {
    writeError("self-test failed: invalid handle");
    return 1;
  }
  if (!expectFailure({ "helper", "unknown", "1" })) {
    writeError("self-test failed: unknown command");
    return 1;
  }
  if (!expectFailure({ "helper", "allow-shortcut", "extra" })) {
    writeError("self-test failed: allow-shortcut arguments");
    return 1;
  }
  if (!expectFailure({ "helper", "monitor-right-alt", "extra" })) {
    writeError("self-test failed: monitor arguments");
    return 1;
  }

  const std::vector<std::pair<std::string, int>> validInts = {
    { "0", 0 },
    { "-25", -25 },
    { "2147483647", 2147483647 },
  };
  for (const auto& [value, expected] : validInts) {
    const ParsedInt32 parsed = parseInt32(value);
    if (!parsed.ok || parsed.value != expected) {
      writeError("self-test failed: valid int parsing");
      return 1;
    }
  }

  for (const std::string& value : { "2147483648", "1.5", "" }) {
    if (parseInt32(value).ok) {
      writeError("self-test failed: invalid int parsing");
      return 1;
    }
  }

  return 0;
}

}  // namespace

int main(int argc, char* argv[]) {
  std::vector<std::string> args;
  args.reserve(static_cast<size_t>(argc));
  for (int index = 0; index < argc; ++index) {
    args.emplace_back(argv[index]);
  }

  if (args.size() == 2 && args[1] == "--self-test") {
    return runSelfTest();
  }

  return run(args);
}
