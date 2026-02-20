"""Site customization - automatically imported by Python on startup."""
# This file is automatically imported by Python before any user code runs
# Perfect place to set up telemetry that needs to be active before boto3 is used

try:
    from genai_core import boto_config  # noqa: F401
except ImportError:
    # genai_core not available (e.g., in build environments)
    pass
