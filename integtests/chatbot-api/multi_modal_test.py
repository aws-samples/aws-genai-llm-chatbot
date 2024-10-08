import json
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from gql.transport.exceptions import TransportQueryError


def test_multi_modal(client, default_multimodal_model, default_provider):

    key = "INTEG_TEST" + str(uuid.uuid4()) + ".jpeg"
    result = client.add_file(
        input={
            "fileName": key,
        }
    )

    fields = result.get("fields")
    cleaned_fields = fields.replace("{", "").replace("}", "")
    pairs = [pair.strip() for pair in cleaned_fields.split(",")]
    fields_dict = dict(pair.split("=", 1) for pair in pairs)
    current_dir = os.path.dirname(os.path.realpath(__file__))
    files = {"file": Path(current_dir + "/resources/powered-by-aws.png").read_bytes()}
    response = requests.post(result.get("url"), data=fields_dict, files=files)
    assert response.status_code == 204

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

    # Verify it can get the file
    url = client.get_file_url(key)
    assert url.startswith("https://")


def test_unknown_file(client):
    with pytest.raises(TransportQueryError, match="File does not exist"):
        client.get_file_url("file")
