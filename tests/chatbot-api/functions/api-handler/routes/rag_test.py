from routes.rag import engines


def test_engines(mocker):
    mocker.patch(
        "genai_core.parameters.get_config",
        return_value={"rag": {"engines": {"aurora": {"enabled": True}}}},
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
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


def test_engines_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = engines()
    assert response.get("error") == "Unauthorized"
