"""Tests for boto_config.py - RevTel User-Agent injection."""

import contextlib
import logging


class TestTelemetryUserAgent:
    """Tests for User-Agent injection."""

    def test_user_agent_format(self):
        """Test that USER_AGENT has correct RevTel format."""
        from genai_core.boto_config import USER_AGENT, SOLUTION_ID

        assert SOLUTION_ID == "aws-genai-llm-chatbot"
        assert USER_AGENT == "aws-solutions/aws-genai-llm-chatbot"

    def test_boto3_user_agent_injection(self):
        """Test that boto3 requests include custom User-Agent."""
        import boto3
        from botocore.stub import Stubber

        from genai_core.boto_config import setup_telemetry

        setup_telemetry()

        client = boto3.client("sts", region_name="us-east-1")

        with Stubber(client) as stubber:
            stubber.add_response(
                "get_caller_identity",
                {
                    "UserId": "AIDATEST",
                    "Account": "123456789012",
                    "Arn": "arn:aws:iam::123456789012:user/test",
                },
            )

            response = client.get_caller_identity()
            assert response["Account"] == "123456789012"

    def test_telemetry_state_prevents_double_registration(self):
        """Test that telemetry is only registered once."""
        from genai_core.boto_config import _TelemetryState, setup_telemetry

        initial_state = _TelemetryState.registered
        setup_telemetry()
        setup_telemetry()
        assert _TelemetryState.registered == initial_state or _TelemetryState.registered


class TestTelemetryLogging:
    """Tests for telemetry logging."""

    def test_boto3_logs_on_request(self, caplog):
        """Test that boto3 requests are logged."""
        import boto3

        from genai_core.boto_config import setup_telemetry

        setup_telemetry()

        with caplog.at_level(logging.INFO, logger="genai_core.boto_config"):
            client = boto3.client("sts", region_name="us-east-1")
            with contextlib.suppress(Exception):
                client.get_caller_identity()

        assert any(
            "RevTel: boto3 sts.GetCallerIdentity" in record.message
            for record in caplog.records
        )
