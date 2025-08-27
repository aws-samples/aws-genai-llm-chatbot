# AgentCore Integration

AgentCore enables the chatbot to interact with Amazon Bedrock Agents, providing advanced reasoning capabilities with visible thinking processes.

![AgentCore Demo](assets/agent-demo.gif)

## Prerequisites

1. **Deploy Bedrock Agents** in your AWS account
2. **Agent ARNs**: Must be in format `arn:aws:bedrock-agentcore:region:account:runtime/agent-id`

The CDK deployment automatically configures the required IAM permissions (`bedrock-agentcore:InvokeAgentRuntime` and `bedrock-agentcore:ListAgentRuntimes`).

## Using AgentCore

### 1. Agent Discovery

Agents are automatically discovered using the `listAgents` GraphQL query, which calls `list_agent_runtimes()` on the bedrock-agentcore-control client. Only users with `admin` or `workspace_manager` roles can access this query.

### 2. Agent Selection

In the chat interface:

- Agents appear in a separate dropdown labeled "Select an agent (optional)"
- Agents display using `agentRuntimeName` (or `agentRuntimeId` as fallback) as the label
- The `agentRuntimeArn` is used as the value
- Agent selection is optional - you can use regular models instead

### 3. Conversation

- When an agent is selected, the system uses `modelInterface: "agent"`
- **Thinking Steps**: The agent's reasoning process is displayed in a collapsible section with:
  - Compact vertical timeline layout with connecting lines
  - Real-time updates during streaming responses
  - Visual indicators (emojis) for different agent actions
  - Click to expand/collapse the full thinking process
- **Streaming**: Both thinking steps and response content stream in real-time
- **Tool Usage**: When agents use tools, thinking steps show tool invocation and execution

## Interface Between Agent and Chatbot

### Request Format

The chatbot sends the complete request record as JSON payload to the agent's `@app.entrypoint` function:

```python
{
    "userId": "user-id",
    "userGroups": ["group1", "group2"],
    "data": {
        "text": "User message",
        "agentRuntimeArn": "arn:aws:bedrock-agentcore:region:account:runtime/agent-id",
        "sessionId": "session-uuid",
        "conversation_history": [
            {"role": "user", "content": "Previous user message"},
            {"role": "assistant", "content": "Previous assistant response"}
        ],
        # Additional fields from original request...
        "modelName": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "modelKwargs": {
            "temperature": 0.7,
            "topP": 0.9,
            "maxTokens": 4000,
            "streaming": true
        }
    }
}
```

**Key Fields:**

- `userId`: User identifier from the chatbot session
- `userGroups`: User's group memberships for authorization
- `data.text`: The user's current message
- `data.agentRuntimeArn`: The selected agent's ARN
- `data.sessionId`: Session identifier for conversation continuity
- `data.conversation_history`: Array of previous messages with `role` and `content` fields (up to 20 recent messages)
- `data.modelName`: Bedrock model identifier (if provided)
- `data.modelKwargs`: Model configuration including streaming preference

**Important Notes:**

- The `conversation_history` is automatically added by the handler from DynamoDB
- Messages are converted to simple `{role, content}` objects
- The entire original request record is passed through, so agents receive all original fields

### Response Format

The agent returns Server-Sent Events (SSE) streaming data that the chatbot processes:

**Streaming SSE Format:**

```python
# Thinking steps (agent reasoning)
data: {"type": "thinking", "content": "💭 Assistant starting..."}
data: {"type": "thinking", "content": "🔧 Calling calculator..."}
data: {"type": "thinking", "content": "🧠 Analyzing the calculation..."}
data: {"type": "thinking", "content": "✅ Block complete"}

# Response content (actual answer)
data: {"type": "content", "content": "The result is "}
data: {"type": "content", "content": "42"}
```

**Non-streaming Response:**

```python
{
    "result": "Agent's complete response text"
}
```

**Event Processing:**

- **Thinking Events**: `type: "thinking"` events are displayed in the expandable thinking steps section
- **Content Events**: `type: "content"` events are accumulated to build the final response
- **Visual Indicators**: Thinking steps include emoji indicators for different agent actions:
  - 💭 Message start/thinking
  - 🔧 Tool usage
  - 🧠 Reasoning content
  - 📚 Citations
  - ✅ Completion markers
  - ⏸️ Tool execution
  - 🏁 Response complete

### Security

- **ARN Validation**: Only accepts ARNs matching `^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime/[a-zA-Z0-9_-]+$`
- **Session Isolation**: Each conversation maintains separate session state
- **Error Handling**: Graceful fallback with error recovery for session history

## Simple Agent Example

Here's a minimal agent implementation that demonstrates the core concepts:

```python
import boto3
import json
from bedrock_agentcore import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel
from strands_tools import calculator, current_time

app = BedrockAgentCoreApp()
session = boto3.Session()
bedrock_model = BedrockModel(boto_session=session)

agent = Agent(
    system_prompt="You are a helpful AI assistant that can use tools to answer questions.",
    model=bedrock_model,
    tools=[calculator, current_time],
)

@app.entrypoint
async def invoke(payload, context):
    """Main agent function with streaming support"""
    # Extract request data
    user_message = payload["data"]["text"]
    conversation_history = payload["data"].get("conversation_history", [])
    is_streaming = payload["data"].get("modelKwargs", {}).get("streaming", False)

    # Configure model from payload (if provided)
    if "modelName" in payload["data"]:
        bedrock_model.update_config(
            model_id=payload["data"]["modelName"],
            temperature=payload["data"]["modelKwargs"].get("temperature", 0.7),
            streaming=is_streaming,
        )

    if is_streaming:
        async def generate_sse():
            async for event in agent.stream_async(user_message):
                if "event" in event:
                    bedrock_event = event["event"]

                    # Handle different event types
                    if "contentBlockDelta" in bedrock_event:
                        delta = bedrock_event["contentBlockDelta"]["delta"]

                        if "text" in delta:
                            # Stream response content
                            sse_data = json.dumps({"type": "content", "content": delta["text"]})
                            yield f"data: {sse_data}\n\n"

                        elif "reasoningContent" in delta:
                            # Stream thinking steps
                            reasoning = delta["reasoningContent"]["text"]
                            sse_data = json.dumps({"type": "thinking", "content": f"🧠 {reasoning}"})
                            yield f"data: {sse_data}\n\n"

                    elif "contentBlockStart" in bedrock_event:
                        start_data = bedrock_event["contentBlockStart"]["start"]
                        if "toolUse" in start_data:
                            tool_name = start_data["toolUse"]["name"]
                            sse_data = json.dumps({"type": "thinking", "content": f"🔧 Using {tool_name}"})
                            yield f"data: {sse_data}\n\n"

        return generate_sse()
    else:
        # Non-streaming response
        result = agent(user_message)
        return {"result": result.message}

if __name__ == "__main__":
    app.run()
```

**Key Components:**

- `BedrockAgentCoreApp()`: Main application wrapper
- `Agent()`: Core agent with system prompt, model, and tools
- `@app.entrypoint`: Decorator for the main handler function
- **Streaming**: Uses `agent.stream_async()` for real-time responses
- **Event Processing**: Handles Bedrock events to extract thinking and content
- **SSE Format**: Returns properly formatted Server-Sent Events

## Troubleshooting

### Agent Not Available

- Verify agent is deployed and active in Bedrock
- Confirm agent ARN matches the exact pattern required
- Check that your user has `admin` or `workspace_manager` role

### Streaming Issues

- Check WebSocket connection in browser developer tools
- Verify session management in CloudWatch logs
- Ensure agent provides data in expected `thinking`/`event` format

### Performance

- Agents may take longer than standard models due to reasoning complexity
- Monitor CloudWatch metrics for agent invocation times
- Conversation history is limited to prevent payload size issues
