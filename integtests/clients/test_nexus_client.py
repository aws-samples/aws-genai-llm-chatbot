"""Integration tests for Nexus Gateway Client"""

import os
import pytest
import sys

from genai_core.model_providers.nexus.nexus_client import NexusGatewayClient
from genai_core.model_providers.nexus.types import NexusGatewayConfig

# Add the python-sdk to the path
sys.path.insert(
    0, os.path.join(os.path.dirname(__file__), "../lib/shared/layers/python-sdk/python")
)


class TestNexusGatewayClientIntegration:
    """Real integration tests for NexusGatewayClient"""

    @pytest.fixture
    def nexus_config(self):
        """Create configuration from environment variables"""
        return NexusGatewayConfig(
            gateway_url=os.getenv("NEXUS_GATEWAY_URL"),
            client_id=os.getenv("NEXUS_AUTH_CLIENT_ID"),
            client_secret=os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
            token_url=os.getenv("NEXUS_AUTH_TOKEN_URL"),
            enabled=True,
        )

    @pytest.fixture
    def nexus_client(self, nexus_config):
        """Create NexusGatewayClient instance"""
        return NexusGatewayClient(nexus_config)

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
            ]
        ),
        reason="Real Nexus credentials not provided",
    )
    def test_real_token_request(self, nexus_client):
        """Test real token request to Nexus Gateway"""
        token = nexus_client.get_access_token()
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
        print(f"Successfully obtained token: {token[:20]}...")

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
            ]
        ),
        reason="Real Nexus credentials not provided",
    )
    def test_real_list_application_models(self, nexus_client):
        """Test real list_application_models request"""
        models = nexus_client.list_application_models()
        assert isinstance(models, list)
        print(f"Found {len(models)} models")
        if models:
            print(f"First model: {models[0]}")

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
                os.getenv("NEXUS_TEST_MODEL_ID"),
            ]
        ),
        reason="Real Nexus credentials and test model not provided",
    )
    def test_real_bedrock_converse(self, nexus_client):
        """Test real bedrock converse request"""
        model_id = os.getenv("NEXUS_TEST_MODEL_ID")
        body = {
            "messages": [
                {"role": "user", "content": [{"text": "Hello, how are you?"}]}
            ],
            "inferenceConfig": {"maxTokens": 100, "temperature": 0.7},
        }

        response = nexus_client.invoke_bedrock_converse(model_id, body)
        print(f"Response: {response}")

        assert response is not None
        assert "output" in response

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
                os.getenv("NEXUS_TEST_MODEL_ID"),
            ]
        ),
        reason="Real Nexus credentials and test model not provided",
    )
    def test_real_openai_chat(self, nexus_client):
        """Test real openai chat request"""
        model_id = os.getenv("NEXUS_TEST_MODEL_ID")
        body = {
            "messages": [{"role": "user", "content": "Hello, how are you?"}],
            "model": model_id,
            "max_tokens": 100,
            "temperature": 0.7,
        }

        response = nexus_client.invoke_openai_chat(body)
        print(f"Response: {response}")

        assert response is not None
        assert "choices" in response
        assert len(response["choices"]) > 0
        assert "message" in response["choices"][0]
        assert "content" in response["choices"][0]["message"]
        print(f"Response content: {response['choices'][0]['message']['content']}")

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
                os.getenv("NEXUS_TEST_MODEL_ID"),
            ]
        ),
        reason="Real Nexus credentials and test model not provided",
    )
    def test_real_openai_chat_stream(self, nexus_client):
        """Test real openai chat request"""
        model_id = os.getenv("NEXUS_TEST_MODEL_ID")
        body = {
            "messages": [
                {"role": "user", "content": "Hello, Im John"},
                {"role": "assistant", "content": ""},
                {"role": "user", "content": "what's your name?"},
            ],
            "model": model_id,
            "max_completion_tokens": 512,
            "temperature": 0.7,
            "top_p": 0.9,
            "stream": True,
        }

        response = nexus_client.invoke_openai_stream_chat(body)
        print(f"Response: {response}")

        assert response is not None
        if "chunks" in response:
            chunks = response["chunks"]
            print(f"Received {len(chunks)} chunks")
            combined_content = "".join(chunks)
            print(f"Combined content: {combined_content}")
            assert len(chunks) > 0

    @pytest.mark.skipif(
        not all(
            [
                os.getenv("NEXUS_GATEWAY_URL"),
                os.getenv("NEXUS_AUTH_CLIENT_ID"),
                os.getenv("NEXUS_AUTH_CLIENT_SECRET"),
                os.getenv("NEXUS_AUTH_TOKEN_URL"),
                os.getenv("NEXUS_TEST_MODEL_ID"),
            ]
        ),
        reason="Real Nexus credentials and test model not provided",
    )
    def test_real_bedrock_converse_stream(self, nexus_client):
        """Test real bedrock converse stream request"""
        model_id = os.getenv("NEXUS_TEST_MODEL_ID")
        body = {
            "messages": [{"role": "user", "content": [{"text": "Count from 1 to 3"}]}],
            "inferenceConfig": {"maxTokens": 100, "temperature": 0.7},
        }

        response = nexus_client.invoke_bedrock_converse_stream(model_id, body)
        print(f"Streaming response: {response}")

        assert response is not None
        full_response = ""

        # Handle different streaming response formats
        if "stream" in response:
            stream_resp = response["stream"]
            try:
                import json

                # Read the raw content and extract text from contentBlockDelta events
                content = stream_resp.content
                if content:
                    content_str = content.decode("utf-8", errors="ignore")

                    # Split by contentBlockDelta to find JSON chunks
                    parts = content_str.split("contentBlockDelta")
                    for part in parts[1:]:  # Skip first empty part
                        # Find JSON object in this part
                        json_start = part.find('{"contentBlockIndex"')
                        if json_start >= 0:
                            # Find the end of the JSON object
                            brace_count = 0
                            json_end = json_start
                            for i, char in enumerate(part[json_start:], json_start):
                                if char == "{":
                                    brace_count += 1
                                elif char == "}":
                                    brace_count -= 1
                                    if brace_count == 0:
                                        json_end = i + 1
                                        break

                            try:
                                json_str = part[json_start:json_end]
                                data = json.loads(json_str)
                                if "delta" in data and "text" in data["delta"]:
                                    full_response += data["delta"]["text"]
                            except json.JSONDecodeError:
                                continue

                    print(f"Parsed streaming response: {full_response}")
                else:
                    print("No content in streaming response")
            except Exception as e:
                print(f"Error processing streaming response: {e}")
                # Fallback: return raw content
                full_response = str(response)
        else:
            # Handle regular response
            assert isinstance(response, dict)
        print(f"Response: {response}")
