from langchain_core.callbacks import BaseCallbackHandler
from typing import Any, Dict, List
import json

class ToolMonitoringCallback(BaseCallbackHandler):
    """Callback handler for monitoring individual tool executions."""

    def __init__(self):
        # Initialize storage for tool outputs
        self.tool_outputs = {
            "analyze_recipe": [],
            "suggest_substitution": [],
            "modify_recipe": []
        }
        self.current_tool = None
        self.metrics = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0
        }

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        **kwargs: Any
    ) -> None:
        """Called when a tool starts executing."""
        self.current_tool = serialized["name"]
        self.metrics["total_calls"] += 1
        print(f"\n🔧 Starting tool: {self.current_tool}")
        print(f"Input: {input_str}")

    def on_tool_end(
        self,
        output: str,
        **kwargs: Any,
    ) -> None:
        """Called when a tool finishes executing."""
        if self.current_tool:
            try:
                # Parse the output as JSON for better formatting
                parsed_output = json.loads(output)
                formatted_output = json.dumps(parsed_output, indent=2)
            except json.JSONDecodeError:
                formatted_output = output

            print(f"\n✅ Tool completed: {self.current_tool}")
            print(f"Output:\n{formatted_output}")

            # Store the output
            self.tool_outputs[self.current_tool].append(output)
            self.metrics["successful_calls"] += 1
            self.current_tool = None

    def on_tool_error(
        self,
        error: Exception,
        **kwargs: Any,
    ) -> None:
        """Called when a tool errors during execution."""
        if self.current_tool:
            print(f"\n❌ Tool error in {self.current_tool}: {str(error)}")
            self.metrics["failed_calls"] += 1
            self.current_tool = None

    def get_tool_history(self, tool_name: str) -> List[str]:
        """Retrieve the history of outputs for a specific tool."""
        return self.tool_outputs.get(tool_name, [])

    def summarize_execution(self) -> Dict[str, int]:
        """Summarize the number of times each tool was used."""
        return {
            tool: len(outputs)
            for tool, outputs in self.tool_outputs.items()
        }

    def get_metrics(self) -> Dict[str, int]:
        """Get the current metrics for tool execution.

        Returns:
            Dict[str, int]: A dictionary containing metrics such as total calls,
                           successful calls, and failed calls.
        """
        return self.metrics