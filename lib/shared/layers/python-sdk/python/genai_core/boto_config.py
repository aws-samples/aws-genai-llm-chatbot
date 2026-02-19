"""Centralized boto3 configuration with telemetry support."""
import boto3
from botocore import client as botocore_client

APP_NAME = "genai-chatbot-on-aws"
APP_VERSION = "5.0.0"
USER_AGENT = f"{APP_NAME}/{APP_VERSION}"

# Global flag to track if event handler is registered
_event_handler_registered = False

# Store original make_request method
_original_make_request = None


def _make_request_with_telemetry(self, operation_model, request_dict, request_context):
    """Wrapper for make_request that adds custom user-agent."""
    # Add custom user-agent to headers
    if 'headers' not in request_dict:
        request_dict['headers'] = {}
    
    existing_ua = request_dict['headers'].get('User-Agent', '')
    if USER_AGENT not in existing_ua:
        if existing_ua:
            request_dict['headers']['User-Agent'] = f"{existing_ua} {USER_AGENT}"
        else:
            request_dict['headers']['User-Agent'] = USER_AGENT
    
    # Call original make_request
    return _original_make_request(self, operation_model, request_dict, request_context)


def setup_telemetry():
    """
    Setup global telemetry for all boto3 clients.
    Patches botocore's BaseClient to inject user-agent into all requests.
    """
    global _event_handler_registered, _original_make_request
    
    if not _event_handler_registered:
        # Patch the BaseClient make_request method
        _original_make_request = botocore_client.BaseClient._make_request
        botocore_client.BaseClient._make_request = _make_request_with_telemetry
        _event_handler_registered = True


# Auto-setup telemetry on module import
setup_telemetry()
