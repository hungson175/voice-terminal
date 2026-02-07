"""Tests for kitty module."""

from unittest.mock import patch
import pytest

from voice_terminal.kitty import get_socket_path, get_text, send_command


class TestGetSocketPath:
    def test_returns_env_var(self):
        with patch.dict("os.environ", {"KITTY_LISTEN_ON": "unix:/tmp/kitty.sock"}):
            assert get_socket_path() == "unix:/tmp/kitty.sock"

    def test_raises_when_not_set(self):
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(RuntimeError, match="KITTY_LISTEN_ON not set"):
                get_socket_path()

    def test_raises_when_empty(self):
        with patch.dict("os.environ", {"KITTY_LISTEN_ON": ""}):
            with pytest.raises(RuntimeError):
                get_socket_path()


class TestGetText:
    @patch("voice_terminal.kitty.subprocess.run")
    def test_returns_pane_text(self, mock_run):
        mock_run.return_value.stdout = "$ ls\nfile1.txt\nfile2.txt\n"
        result = get_text("unix:/tmp/kitty.sock")
        assert result == "$ ls\nfile1.txt\nfile2.txt\n"
        mock_run.assert_called_once_with(
            ["kitty", "@", "--to", "unix:/tmp/kitty.sock", "get-text"],
            capture_output=True,
            text=True,
            check=True,
        )


class TestSendCommand:
    @patch("voice_terminal.kitty.subprocess.run")
    def test_sends_text_and_return(self, mock_run):
        send_command("unix:/tmp/kitty.sock", "ls -la")
        assert mock_run.call_count == 2
        mock_run.assert_any_call(
            ["kitty", "@", "--to", "unix:/tmp/kitty.sock", "send-text", "ls -la"],
            capture_output=True,
            check=True,
        )
        mock_run.assert_any_call(
            ["kitty", "@", "--to", "unix:/tmp/kitty.sock", "send-key", "Return"],
            capture_output=True,
            check=True,
        )

    @patch("voice_terminal.kitty.subprocess.run")
    def test_send_text_called_before_send_key(self, mock_run):
        send_command("unix:/tmp/kitty.sock", "echo hello")
        calls = mock_run.call_args_list
        assert "send-text" in calls[0].args[0]
        assert "send-key" in calls[1].args[0]
