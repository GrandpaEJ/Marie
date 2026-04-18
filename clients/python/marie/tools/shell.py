import subprocess
from .base import Tool

class ShellTool(Tool):
    def __init__(self):
        super().__init__(
            name="shell",
            description="Execute a shell command and return stdout/stderr. Use for system tasks.",
            parameters={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The shell command to execute"}
                },
                "required": ["command"]
            },
            safe=False
        )

    def run(self, command):
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            output = f"exit_code: {result.returncode}\n"
            if result.stdout:
                output += f"stdout:\n{result.stdout}\n"
            if result.stderr:
                output += f"stderr:\n{result.stderr}\n"
            return output.strip()
        except subprocess.TimeoutExpired:
            return "Error: Command timed out after 30 seconds."
        except Exception as e:
            return f"Error executing shell: {str(e)}"
