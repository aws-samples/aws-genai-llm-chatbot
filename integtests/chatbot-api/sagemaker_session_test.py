# This test will only run if the dolly sagemaker endpoint was create.
# It aims to validate the sagemaker flow
import json
import time
import uuid

import pytest


def test_jumpstart_sagemaker_endpoint(client):
    model_name = "mistralai/Mistral-7B-Instruct-v0.3"
    models = client.list_models()
    model = next((i for i in models if i.get("name") == model_name), None)
    if model is None:
        pytest.skip("Mistra v0.3 is not enabled.")
    session_id = str(uuid.uuid4())
    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": "The plant is yellow",
            "files": [],
            "modelName": model_name,
            "provider": "sagemaker",
            "sessionId": session_id,
        },
        "modelKwargs": {"maxTokens": 150, "temperature": 0.1},
    }

    client.send_query(json.dumps(request))

    found = False
    retries = 0
    while not found and retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if (
            session != None
            and len(session.get("history")) == 2
            and "plant" in session.get("history")[1].get("content").lower()
        ):
            found = True
            break
    assert found == True

    request = request.copy()
    # The goal here is to test the conversation history
    request["data"]["text"] = "What is the plant color?"

    client.send_query(json.dumps(request))

    found = False
    retries = 0
    while not found and retries < 20:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)

        if (
            session != None
            and len(session.get("history")) == 4
            and "yellow" in session.get("history")[3].get("content").lower()
        ):
            found = True
            break

    assert found == True
