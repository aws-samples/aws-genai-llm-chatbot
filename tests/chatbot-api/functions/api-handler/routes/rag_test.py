from routes.rag import engines


def test_engines(mocker):
    mocker.patch(
        "genai_core.parameters.get_config",
        return_value={"rag": {"engines": {"aurora": {"enabled": True}}}},
    )
    response = engines()
    assert len(response) == 4
    assert response[0].get("enabled") == True
    assert response[1].get("enabled") == False
    assert response[2].get("enabled") == False
    assert response[3].get("enabled") == False
    assert response[0].get("id") == "aurora"
    assert response[1].get("id") == "opensearch"
    assert response[2].get("id") == "kendra"
    assert response[3].get("id") == "bedrock_kb"
