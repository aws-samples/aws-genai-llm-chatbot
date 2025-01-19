from datetime import datetime
from pydantic import ValidationError
import pytest
from routes.applications import list_applications
from routes.applications import get_application
from routes.applications import delete_application
from routes.applications import create_application
from routes.applications import update_application
from genai_core.types import CommonError

now = datetime.utcnow()

application = {
    "Id": "application_id",
    "Name": "name two",
    "Model": "model",
    "Workspace": "workspace",
    "OutputModalities": "outputModalities",
    "SystemPrompt": "system prompt",
    "SystemPromptRag": "system prompt rag",
    "CondenseSystemPrompt": "condense system prompt",
    "Roles": ["role1", "role2"],
    "AllowImageInput": True,
    "AllowVideoInput": True,
    "AllowDocumentInput": False,
    "EnableGuardrails": False,
    "Streaming": False,
    "Temperature": 0.7,
    "TopP": 1.0,
    "MaxTokens": 1024,
    "CreateTime": now,
    "UpdateTime": now,
}

create_application_input = {
    "name": "name two",
    "model": "model",
    "workspace": "workspace",
    "systemPrompt": "system prompt",
    "systemPromptRag": "system prompt rag",
    "condenseSystemPrompt": "condense system prompt",
    "roles": ["role1", "role2"],
    "allowImageInput": True,
    "allowVideoInput": True,
    "allowDocumentInput": False,
    "enableGuardrails": False,
    "streaming": False,
    "temperature": 0.7,
    "topP": 1.0,
    "maxTokens": 1024,
}


def test_list_applications(mocker):
    mocker.patch(
        "genai_core.applications.list_applications", return_value=[application]
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = list_applications()

    assert len(response) == 1
    assert response[0].get("id") == application.get("Id")
    assert response[0].get("name") == application.get("Name")
    assert response[0].get("model") == application.get("Model")
    assert response[0].get("workspace") == application.get("Workspace")
    assert response[0].get("outputModalities") == application.get("OutputModalities")
    assert response[0].get("roles") == application.get("Roles")
    assert response[0].get("systemPrompt") == application.get("SystemPrompt")
    assert response[0].get("allowImageInput") == application.get("AllowImageInput")
    assert response[0].get("allowVideoInput") == application.get("AllowVideoInput")
    assert response[0].get("enableGuardrails") == application.get("EnableGuardrails")
    assert response[0].get("streaming") == application.get("Streaming")
    assert response[0].get("temperature") == application.get("Temperature")
    assert response[0].get("topP") == application.get("TopP")
    assert response[0].get("maxTokens") == application.get("MaxTokens")
    assert response[0].get("createTime") == application.get("CreateTime")
    assert response[0].get("updateTime") == application.get("UpdateTime")


def test_get_application(mocker):
    mocker.patch("genai_core.applications.get_application", return_value=application)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = get_application("id")
    assert response.get("id") == application.get("Id")
    assert response.get("name") == application.get("Name")
    assert response.get("model") == application.get("Model")
    assert response.get("workspace") == application.get("Workspace")
    assert response.get("outputModalities") == application.get("OutputModalities")
    assert response.get("roles") == application.get("Roles")
    assert response.get("systemPrompt") == application.get("SystemPrompt")
    assert response.get("allowImageInput") == application.get("AllowImageInput")
    assert response.get("allowVideoInput") == application.get("AllowVideoInput")
    assert response.get("enableGuardrails") == application.get("EnableGuardrails")
    assert response.get("streaming") == application.get("Streaming")
    assert response.get("temperature") == application.get("Temperature")
    assert response.get("topP") == application.get("TopP")
    assert response.get("maxTokens") == application.get("MaxTokens")
    assert response.get("createTime") == application.get("CreateTime")
    assert response.get("updateTime") == application.get("UpdateTime")


def test_get_application_unauthorized(mocker):
    mocker.patch("genai_core.applications.get_application", return_value=application)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    with pytest.raises(CommonError, match="Unauthorized"):
        get_application("id")


def test_get_application_not_found(mocker):
    mocker.patch("genai_core.applications.get_application", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert get_application("id") == None


def test_delete_application(mocker):
    mock = mocker.patch("genai_core.applications.delete_application")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    delete_application("id")
    assert mock.call_count == 1


def test_delete_application_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = delete_application("id")
    assert response.get("error") == "Unauthorized"


def test_create_application(mocker):
    mock = mocker.patch(
        "genai_core.applications.create_application", return_value=application
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = create_application(create_application_input.copy())
    assert response.get("id") != None
    assert response.get("name") == create_application_input.get("name")
    assert mock.call_count == 1


def test_create_application_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])

    response = create_application(create_application_input.copy())
    assert response.get("error") == "Unauthorized"


def test_update_application(mocker):
    mock = mocker.patch(
        "genai_core.applications.update_application", return_value=application
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    update_application_input = create_application_input.copy()
    update_application_input["id"] = "id"
    update_application_input["createTime"] = now.isoformat()

    response = update_application(update_application_input)
    assert response.get("id") == application.get("Id")
    assert response.get("createTime") == now
    assert mock.call_count == 1


def test_update_application_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])

    update_application_input = create_application_input.copy()
    update_application_input["id"] = "id"
    update_application_input["createTime"] = now.isoformat()

    response = update_application(update_application_input)
    assert response.get("error") == "Unauthorized"


def test_create_application_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    invalid_input_1 = create_application_input.copy()
    invalid_input_1["name"] = "name=two"
    with pytest.raises(ValidationError) as exc_info:
        create_application(invalid_input_1)
    error_messages = str(exc_info.value)
    assert "String should match pattern '^[\\w\\s+_-]+$'" in error_messages
    assert "name=two" in error_messages

    invalid_input_2 = create_application_input.copy()
    invalid_input_2["model"] = None
    with pytest.raises(ValidationError) as exc_info:
        create_application(invalid_input_2)
    error_messages = str(exc_info.value)
    assert "Input should be a valid string" in error_messages
    assert "type=string_type, input_value=None, input_type=NoneType" in error_messages

    invalid_input_3 = create_application_input.copy()
    invalid_input_3["roles"] = None
    with pytest.raises(ValidationError) as exc_info:
        create_application(invalid_input_3)
    error_messages = str(exc_info.value)
    assert "Input should be a valid list" in error_messages
    assert "type=list_type, input_value=None, input_type=NoneType" in error_messages

    with pytest.raises(ValidationError, match="10 validation error"):
        create_application({})

    with pytest.raises(ValidationError, match="3 validation error"):
        invalid_input_4 = create_application_input.copy()
        invalid_input_4["systemPrompt"] = ">"
        invalid_input_4["systemPromptRag"] = ">"
        invalid_input_4["condenseSystemPrompt"] = ">"
        create_application(invalid_input_4)
