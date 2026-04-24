"""RevTel telemetry support via User-Agent injection for AWS API calls."""

import logging

from botocore import client as botocore_client

logger = logging.getLogger(__name__)

SOLUTION_ID = "genai-chatbot-on-aws"
USER_AGENT = SOLUTION_ID


class _TelemetryState:
    registered = False


def _patch_botocore():
    """Patch botocore to inject user-agent into all boto3 requests."""
    # Access private method for monkey-patching
    orig = botocore_client.BaseClient._make_request  # noqa: SLF001

    def make_request_with_telemetry(
        self, operation_model, request_dict, request_context
    ):
        if "headers" not in request_dict:
            request_dict["headers"] = {}

        existing_ua = request_dict["headers"].get("User-Agent", "")
        if USER_AGENT not in existing_ua:
            new_ua = f"{existing_ua} {USER_AGENT}".strip()
            request_dict["headers"]["User-Agent"] = new_ua

        logger.info(
            "RevTel: boto3 %s.%s",
            self._service_model.service_name,
            operation_model.name,
        )

        return orig(self, operation_model, request_dict, request_context)

    botocore_client.BaseClient._make_request = make_request_with_telemetry  # noqa


def setup_telemetry():
    """Setup telemetry for all boto3 AWS API calls."""
    if not _TelemetryState.registered:
        _patch_botocore()
        _TelemetryState.registered = True
        logger.info("RevTel telemetry initialized: %s", USER_AGENT)


# Auto-setup telemetry on module import
setup_telemetry()
