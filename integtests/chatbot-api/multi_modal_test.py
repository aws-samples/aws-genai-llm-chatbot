import json
import os
import time
import uuid
import boto3
from pathlib import Path

import pytest


def test_multi_modal(
    client, config, cognito_credentials, default_multimodal_model, default_provider
):
    bucket = config.get("Storage").get("AWSS3").get("bucket")
    s3 = boto3.resource(
        "s3",
        # Use identity pool credentials to verify it owrks
        aws_access_key_id=cognito_credentials.aws_access_key,
        aws_secret_access_key=cognito_credentials.aws_secret_key,
        aws_session_token=cognito_credentials.aws_token,
    )
    key = "INTEG_TEST" + str(uuid.uuid4()) + ".jpeg"
    object = s3.Object(bucket, "public/" + key)
    wrong_object = s3.Object(bucket, "private/notallowed/1.jpg")
    current_dir = os.path.dirname(os.path.realpath(__file__))
    object.put(Body=Path(current_dir + "/resources/powered-by-aws.png").read_bytes())
    with pytest.raises(Exception, match="AccessDenied"):
        wrong_object.put(
            Body=Path(current_dir + "/resources/powered-by-aws.png").read_bytes()
        )

    session_id = str(uuid.uuid4())

    request = {
        "action": "run",
        "modelInterface": "multimodal",
        "data": {
            "mode": "chain",
            "text": "What is this image?",
            "files": [{"key": key, "provider": "s3"}],
            "modelName": default_multimodal_model,
            "provider": default_provider,
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))

    content = None
    retries = 0
    while retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if session != None and len(session.get("history")) == 2:
            content = session.get("history")[1].get("content").lower()
            break

    assert "powered by" in content
    client.delete_session(session_id)
    object.delete()
