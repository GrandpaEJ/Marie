import requests
from .base import Tool

class WebFetchTool(Tool):
    def __init__(self):
        super().__init__(
            name="web_fetch",
            description="Fetch the content of a URL and return as text (max 5000 chars).",
            parameters={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to fetch"}
                },
                "required": ["url"]
            },
            safe=True
        )

    def run(self, url):
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            text = response.text
            if len(text) > 5000:
                text = text[:5000] + "... (truncated)"
            return text
        except Exception as e:
            return f"Error fetching URL: {str(e)}"
