import json
import time
import uuid

import pytest
from gql.transport.exceptions import TransportQueryError


def test_media_generation_modal(
    client, default_image_generation_model, default_provider
):
    session_id = str(uuid.uuid4())

    request = {
        "action": "run",
        "modelInterface": "langchain",
        "data": {
            "mode": "image_generation",
            "text": "Generate a test image",
            "images": [],
            "documents": [],
            "modelName": default_image_generation_model,
            "provider": default_provider,
            "sessionId": session_id,
        },
    }

    client.send_query(json.dumps(request))

    retries = 0
    key_image = None
    while retries < 30:
        time.sleep(1)
        retries += 1
        session = client.get_session(session_id)
        if not session or len(session.get("history", [])) != 2:
            continue
        try:
            metadata = json.loads(session["history"][1].get("metadata", "{}"))
            images = metadata.get("images", [])
            if images and isinstance(images, list):
                key_image = images[0].get("key")
                break
        except json.JSONDecodeError:
            continue

    assert key_image != None
    assert key_image.endswith(".png")

    # Verify that image exist
    url = client.get_file_url(key_image)
    assert url.startswith("https://")

    # Cleanup
    client.delete_session(session_id)

    # Should delete the files
    match = "File does not exist"
    with pytest.raises(TransportQueryError, match=match):
        client.get_file_url(key_image)
