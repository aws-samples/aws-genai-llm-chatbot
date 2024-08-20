# This test will only run if the dolly sagemaker endpoint was create.
# It aims to validate the sagemaker flow
import json
import time
import uuid

import pytest


def test_sagemaker_endpoint(client):
    model_name = "dolly-v2-3b"
    models = client.list_models()
    model = next(i for i in models if i.get("name") == model_name)
    if model is None:
        pytest.skip("Dolly is not enabled.")
    session_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "Hello, my name is Tom.",
            "files": [],
            "modelName": model_name,
            "provider": "sagemaker",
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))

    found = False
    retries = 0
    while not found and retries < 15:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if (
            session != None
            and len(session.get("history")) == 2
            and "tom" in session.get("history")[1].get("content").lower()
        ):
            found = True
            break
    assert found == True
