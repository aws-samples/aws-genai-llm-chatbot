# AgentCore Integration

AgentCore enables the chatbot to interact with Amazon Bedrock Agents, providing advanced reasoning capabilities with visible thinking processes.

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
- **Thinking Steps**: Click the expandable "Thinking..." section to see the agent's reasoning process
- **Streaming**: Responses stream in real-time as the agent processes

## Interface Between Agent and Chatbot

### Request Format
The chatbot sends the entire request record as JSON payload to `invoke_agent_runtime()`:
```python
{
    "userId": "user-id",
    "userGroups": ["group1", "group2"],
    "data": {
        "text": "User message",
        "agentRuntimeArn": "arn:aws:bedrock-agentcore:region:account:runtime/agent-id",
        "sessionId": "session-uuid",
        "conversation_history": [
            # Previous messages from DynamoDB
        ]
    }
}
```

### Response Format
The Bedrock Agent Runtime returns streaming data that the chatbot processes:

**Streaming Response Chunks:**
```python
{
    "thinking": "Agent's reasoning step",  # Triggers THINKING_STEP action
    "event": "Response text chunk"        # Triggers LLM_NEW_TOKEN action
}
```

**Non-streaming Response:**
```python
{
    "result": {
        "content": [
            {"text": "Agent's response text"}
        ]
    }
}
```

The chatbot extracts:
- **Thinking Steps**: From `thinking` fields, sent as `THINKING_STEP` actions
- **Response Content**: From `event` fields (streaming) or `result.content[].text` (non-streaming)
- **Final Response**: Accumulated content sent as `FINAL_RESPONSE` action

### Security
- **ARN Validation**: Only accepts ARNs matching `^arn:aws:bedrock-agentcore:[a-z0-9-]+:\d{12}:runtime/[a-zA-Z0-9_-]+$`
- **Session Isolation**: Each conversation maintains separate session state
- **Error Handling**: Graceful fallback with error recovery for session history

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
