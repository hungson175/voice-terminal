"""Kitty terminal remote control: read pane text and send commands."""

import os
import subprocess


def get_socket_path() -> str:
    """Read Kitty socket path from $KITTY_LISTEN_ON."""
    path = os.environ.get("KITTY_LISTEN_ON", "")
    if not path:
        raise RuntimeError(
            "KITTY_LISTEN_ON not set. Run inside Kitty with allow_remote_control yes"
        )
    return path


def get_text(socket_path: str) -> str:
    """Capture current pane text from Kitty."""
    result = subprocess.run(
        ["kitty", "@", "--to", socket_path, "get-text"],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def send_command(socket_path: str, text: str) -> None:
    """Send text to Kitty and press Return."""
    subprocess.run(
        ["kitty", "@", "--to", socket_path, "send-text", text],
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["kitty", "@", "--to", socket_path, "send-key", "Return"],
        capture_output=True,
        check=True,
    )
