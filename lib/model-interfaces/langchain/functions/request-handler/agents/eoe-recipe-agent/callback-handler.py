from langchain.agents import BaseCallbackHandler

class EOEAgentCallbackHandler(BaseCallbackHandler):
    def on_llm_start(self, serialized, prompts, **kwargs):
        # Called when LLM starts processing
        print("Starting to think...")

    def on_llm_end(self, response, **kwargs):
        # Called when LLM finishes processing
        print("Finished thinking!")

    def on_tool_start(self, serialized, input_str, **kwargs):
        # Called when a tool (like recipe analysis) starts
        print(f"Starting to use tool: {serialized['name']}")

