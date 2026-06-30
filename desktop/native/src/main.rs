use std::env;
use std::ffi::c_void;
use std::ptr::null_mut;

use windows_sys::Win32::Foundation::{GetLastError, SetLastError, ERROR_SUCCESS, HWND};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    FindWindowW, SetParent, SetProcessDPIAware, SetWindowPos, SWP_NOACTIVATE, SWP_SHOWWINDOW,
};

const WINDOW_FLAGS: u32 = SWP_NOACTIVATE | SWP_SHOWWINDOW;

fn parse_window_handle(value: &str) -> Result<HWND, String> {
    let handle = value
        .parse::<u64>()
        .map_err(|_| "Invalid window handle argument.".to_string())?;
    Ok(handle as usize as *mut c_void)
}

fn parse_i32(value: &str) -> Result<i32, String> {
    value
        .parse::<i32>()
        .map_err(|_| "Invalid numeric argument.".to_string())
}

fn wide_null(value: &str) -> Vec<u16> {
    value.encode_utf16().chain([0]).collect()
}

fn attach(args: &[String], child: HWND) -> Result<(), String> {
    if args.len() != 6 {
        return Err("Attach expects a handle, x, width, and height.".to_string());
    }

    let taskbar_class = wide_null("Shell_TrayWnd");
    let taskbar = unsafe { FindWindowW(taskbar_class.as_ptr(), null_mut()) };
    if taskbar.is_null() {
        return Err("Windows taskbar window was not found.".to_string());
    }

    unsafe {
        SetLastError(ERROR_SUCCESS);
        let previous_parent = SetParent(child, taskbar);
        if previous_parent.is_null() && GetLastError() != ERROR_SUCCESS {
            return Err("Could not attach the timer to the Windows taskbar.".to_string());
        }

        let positioned = SetWindowPos(
            child,
            null_mut(),
            parse_i32(&args[3])?,
            0,
            parse_i32(&args[4])?,
            parse_i32(&args[5])?,
            WINDOW_FLAGS,
        );
        if positioned == 0 {
            return Err("Could not position the timer inside the Windows taskbar.".to_string());
        }
    }

    Ok(())
}

fn detach(child: HWND) -> Result<(), String> {
    unsafe {
        SetLastError(ERROR_SUCCESS);
        let previous_parent = SetParent(child, null_mut());
        if previous_parent.is_null() && GetLastError() != ERROR_SUCCESS {
            return Err("Could not detach the timer from the taskbar.".to_string());
        }
    }

    Ok(())
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    if args.len() < 3 {
        return Err("Expected attach or detach arguments.".to_string());
    }

    unsafe {
        SetProcessDPIAware();
    }

    let child = parse_window_handle(&args[2])?;
    match args[1].as_str() {
        "attach" => attach(&args, child),
        "detach" => detach(child),
        _ => Err("Unknown taskbar helper command.".to_string()),
    }
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
