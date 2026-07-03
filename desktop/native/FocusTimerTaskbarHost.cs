using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Threading;

internal static class FocusTimerTaskbarHost
{
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;
    private const int VkRightAlt = 0xA5;
    private const int KeyDownMask = 0x8000;

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int virtualKey);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr child, IntPtr parent);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr after,
        int x,
        int y,
        int width,
        int height,
        uint flags
    );

    [DllImport("kernel32.dll", EntryPoint = "SetLastError")]
    private static extern void SetLastErrorCode(uint errorCode);

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length < 1)
            {
                throw new ArgumentException("Expected a helper command.");
            }

            if (args[0] == "allow-shortcut")
            {
                if (args.Length != 1)
                {
                    throw new ArgumentException(
                        "allow-shortcut does not accept arguments."
                    );
                }
                return RightAltDown() ? 1 : 0;
            }

            if (args[0] == "monitor-right-alt")
            {
                if (args.Length != 1)
                {
                    throw new ArgumentException(
                        "monitor-right-alt does not accept arguments."
                    );
                }
                return MonitorRightAlt();
            }

            if (args.Length < 2)
            {
                throw new ArgumentException("Expected attach or detach arguments.");
            }

            SetProcessDPIAware();
            IntPtr child = new IntPtr(ParseLong(args[1]));

            if (args[0] == "attach")
            {
                if (args.Length != 5)
                {
                    throw new ArgumentException(
                        "Attach expects a handle, x, width, and height."
                    );
                }

                IntPtr taskbar = FindWindow("Shell_TrayWnd", null);
                if (taskbar == IntPtr.Zero)
                {
                    throw new InvalidOperationException(
                        "Windows taskbar window was not found."
                    );
                }

                ChangeParent(
                    child,
                    taskbar,
                    "Could not attach the timer to the Windows taskbar."
                );
                if (!SetWindowPos(
                    child,
                    IntPtr.Zero,
                    ParseInt(args[2]),
                    0,
                    ParseInt(args[3]),
                    ParseInt(args[4]),
                    SwpNoActivate | SwpShowWindow
                ))
                {
                    throw new Win32Exception(
                        Marshal.GetLastWin32Error(),
                        "Could not position the timer inside the Windows taskbar."
                    );
                }
                return 0;
            }

            if (args[0] == "detach")
            {
                if (args.Length != 2)
                {
                    throw new ArgumentException("Detach expects a window handle.");
                }
                ChangeParent(
                    child,
                    IntPtr.Zero,
                    "Could not detach the timer from the taskbar."
                );
                return 0;
            }

            throw new ArgumentException("Unknown taskbar helper command.");
        }
        catch (Exception error)
        {
            Console.Error.WriteLine(error.Message);
            return 1;
        }
    }

    private static int MonitorRightAlt()
    {
        bool lastState = RightAltDown();
        WriteRightAltState(lastState);

        while (true)
        {
            Thread.Sleep(5);
            bool currentState = RightAltDown();
            if (currentState != lastState)
            {
                WriteRightAltState(currentState);
                lastState = currentState;
            }
        }
    }

    private static void WriteRightAltState(bool down)
    {
        Console.Out.WriteLine(down ? "down" : "up");
        Console.Out.Flush();
    }

    private static bool RightAltDown()
    {
        return (GetAsyncKeyState(VkRightAlt) & KeyDownMask) != 0;
    }

    private static void ChangeParent(IntPtr child, IntPtr parent, string message)
    {
        SetLastErrorCode(0);
        IntPtr previousParent = SetParent(child, parent);
        int errorCode = Marshal.GetLastWin32Error();
        if (previousParent == IntPtr.Zero && errorCode != 0)
        {
            throw new Win32Exception(errorCode, message);
        }
    }

    private static long ParseLong(string value)
    {
        return long.Parse(value, CultureInfo.InvariantCulture);
    }

    private static int ParseInt(string value)
    {
        return int.Parse(value, CultureInfo.InvariantCulture);
    }
}
