using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;

internal static class FocusTimerTaskbarHost
{
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;

    [DllImport("user32.dll")]
    private static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr FindWindow(string className, string windowName);

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

                bool positioned = SetWindowPos(
                    child,
                    IntPtr.Zero,
                    ParseInt(args[2]),
                    0,
                    ParseInt(args[3]),
                    ParseInt(args[4]),
                    SwpNoActivate | SwpShowWindow
                );
                if (!positioned)
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
