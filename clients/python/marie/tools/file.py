import os
from .base import Tool

class FileReadTool(Tool):
    def __init__(self):
        super().__init__(
            name="file_read",
            description="Read the contents of a local file.",
            parameters={
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Absolute or relative path to the file"}
                },
                "required": ["path"]
            },
            safe=True
        )

    def run(self, path):
        try:
            if not os.path.exists(path):
                return f"Error: File '{path}' not found."
            with open(path, 'r', encoding='utf-8') as f:
                return f.read(2000) # Limit to 2k chars
        except Exception as e:
            return f"Error reading file: {str(e)}"
