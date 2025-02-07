import json
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from gql.transport.exceptions import TransportQueryError


def test_multi_modal(client, default_multimodal_model, default_provider):
    key_image = "INTEG_TEST" + str(uuid.uuid4()) + ".jpeg"
    key_document = "INTEG_TEST" + str(uuid.uuid4()) + ".txt"

    current_dir = os.path.dirname(os.path.realpath(__file__))
    upload_file(
        client,
        key_image,
        Path(current_dir + "/resources/powered-by-aws.png").read_bytes(),
    )
    upload_file(
        client,
        key_document,
        Path(current_dir + "/resources/aws-description.txt").read_bytes(),
    )

    session_id = str(uuid.uuid4())

    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "chain",
            "text": 'What is the image text? If the image is related to the document, say "Image is related" in the second sentence.',  # noqa: E501
            "images": [{"key": key_image, "provider": "s3", "modality": "IMAGE"}],
            "documents": [
                {"key": key_document, "provider": "s3", "modality": "DOCUMENT"}
            ],
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
    assert "image is related" in content

    # Verify it can get the file
    url = client.get_file_url(key_image)
    assert url.startswith("https://")
    url = client.get_file_url(key_document)
    assert url.startswith("https://")

    client.delete_session(session_id)

    # Should delete the files
    match = "File does not exist"
    with pytest.raises(TransportQueryError, match=match):
        client.get_file_url(key_image)
    with pytest.raises(TransportQueryError, match=match):
        client.get_file_url(key_document)


def upload_file(client, key: str, data: bytes):
    result = client.add_file(
        input={
            "fileName": key,
        }
    )

    fields = result.get("fields")
    cleaned_fields = fields.replace("{", "").replace("}", "")
    pairs = [pair.strip() for pair in cleaned_fields.split(",")]
    fields_dict = dict(pair.split("=", 1) for pair in pairs)
    files = {"file": data}
    response = requests.post(result.get("url"), data=fields_dict, files=files)
    assert response.status_code == 204


def test_unknown_file(client):
    with pytest.raises(TransportQueryError, match="File does not exist"):
        client.get_file_url("file")
