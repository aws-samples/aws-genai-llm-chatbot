from pydantic import ValidationError
import pytest
from genai_core.types import CommonError
from routes.workspaces import list_workspaces
from routes.workspaces import get_workspace
from routes.workspaces import delete_workspace
from routes.workspaces import create_aurora_workspace
from routes.workspaces import create_open_search_workspace
from routes.workspaces import create_kendra_workspace

workspace = {
    "workspace_id": "workspace_id",
    "object_type": "workspace",
    "format_version": 1,
    "name": "name",
    "engine": "aurora",
    "status": "submitted",
    "embeddings_model_provider": "provider",
    "embeddings_model_name": "name",
    "embeddings_model_dimensions": 1,
    "cross_encoder_model_provider": "provider",
    "cross_encoder_model_name": "name",
    "languages": ["en"],
    "metric": "l2",
    "aoss_engine": "nmslib",
    "hybrid_search": "",
    "chunking_strategy": "",
    "chunk_size": 1,
    "chunk_overlap": "",
    "documents": 0,
    "vectors": 0,
    "size_in_bytes": 0,
    "created_at": 1,
    "updated_at": 1,
}

create_base_input = {
    "kind": "kind",
    "name": "name",
    "embeddingsModelProvider": "bedrock",
    "embeddingsModelName": "embded",
    "crossEncoderModelProvider": "bedrock",
    "crossEncoderModelName": "encoder",
    "languages": ["en"],
    "metric": "inner",
    "index": True,
    "hybridSearch": True,
    "chunkingStrategy": "recursive",
    "chunkSize": 101,
    "chunkOverlap": 1,
    "kendraIndexId": "1",
    "useAllData": True,
}

config = {
    "rag": {
        "embeddingsModels": [
            {
                "provider": "bedrock",
                "name": "embded",
                "dimensions": 1024,
            },
        ],
        "crossEncoderModels": [
            {
                "provider": "bedrock",
                "name": "encoder",
                "default": True,
            }
        ],
    }
}


def test_list_workspaces(mocker):
    mocker.patch("genai_core.workspaces.list_workspaces", return_value=[workspace])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = list_workspaces()
    assert len(response) == 1
    assert response[0].get("id") == workspace.get("workspace_id")
    assert response[0].get("name") == workspace.get("name")
    assert response[0].get("index") == None
    assert response[0].get("kendraUseAllData") == None
    assert response[0].get("kendraIndexExternal") == None


def test_list_workspaces_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = list_workspaces()
    assert response.get("error") == "Unauthorized"


def test_get_workspace(mocker):
    mocker.patch("genai_core.workspaces.get_workspace", return_value=workspace)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = get_workspace("id")
    assert response.get("id") == workspace.get("workspace_id")


def test_get_workspace_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = get_workspace("id")
    assert response.get("error") == "Unauthorized"


def test_get_workspace_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="1 validation error"):
        get_workspace("")
    with pytest.raises(ValidationError, match="1 validation error"):
        get_workspace(None)


def test_get_workspace_not_found(mocker):
    mocker.patch("genai_core.workspaces.get_workspace", return_value=None)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert get_workspace("id") == None


def test_delete_workspace(mocker):
    mock = mocker.patch("genai_core.workspaces.delete_workspace")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    delete_workspace("id")
    assert mock.call_count == 1


def test_delete_workspace_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = delete_workspace("id")
    assert response.get("error") == "Unauthorized"


def test_delete_workspace_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_workspace("")
    with pytest.raises(ValidationError, match="1 validation error"):
        delete_workspace(None)


def test_create_aurora_workspace(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mock = mocker.patch(
        "genai_core.workspaces.create_workspace_aurora", return_value=workspace
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = create_aurora_workspace(create_base_input.copy())
    assert response.get("id") == workspace.get("workspace_id")
    assert mock.call_count == 1


def test_create_aurora_workspace_unauthorized(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])

    response = create_aurora_workspace(create_base_input.copy())
    assert response.get("error") == "Unauthorized"


def test_create_aurora_workspace_invalid_input(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    input = create_base_input.copy()
    input["metric"] = "invalid"
    with pytest.raises(CommonError, match="Invalid metric"):
        create_aurora_workspace(input)
    verifiy_common_invalid_inputs(create_aurora_workspace)


def test_create_open_search_workspace(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mock = mocker.patch(
        "genai_core.workspaces.create_workspace_open_search", return_value=workspace
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    response = create_open_search_workspace(create_base_input.copy())
    assert response.get("id") == workspace.get("workspace_id")
    assert mock.call_count == 1


def test_create_open_search_workspace_unauthorized(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])

    response = create_open_search_workspace(create_base_input.copy())
    assert response.get("error") == "Unauthorized"


def test_create_open_search_workspace_invalid_input(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    verifiy_common_invalid_inputs(create_open_search_workspace)


def test_create_kendra_workspace(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.kendra.get_kendra_indexes", return_value=[{"id": "1"}])
    mock = mocker.patch(
        "genai_core.workspaces.create_workspace_kendra", return_value=workspace
    )
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    input = create_base_input.copy()
    response = create_kendra_workspace(input)
    assert response.get("id") == workspace.get("workspace_id")
    assert mock.call_count == 1


def test_create_kendra_workspace_unauthorized(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.kendra.get_kendra_indexes", return_value=[{"id": "1"}])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])

    input = create_base_input.copy()
    response = create_kendra_workspace(input)
    assert response.get("error") == "Unauthorized"


def test_create_kendra_workspace_invalid_input(mocker):
    mocker.patch("genai_core.parameters.get_config", return_value=config)
    mocker.patch("genai_core.kendra.get_kendra_indexes", return_value=[])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])

    input = create_base_input.copy()
    input["name"] = ""
    with pytest.raises(ValidationError, match="1 validation error"):
        create_kendra_workspace(input)
    input = create_base_input.copy()
    with pytest.raises(CommonError, match="Kendra index not found"):
        create_kendra_workspace(input)


def verifiy_common_invalid_inputs(method):
    input = create_base_input.copy()
    input["embeddingsModelProvider"] = "unkown"
    with pytest.raises(CommonError, match="Embeddings model not found"):
        method(input)
    input = create_base_input.copy()
    input["crossEncoderModelProvider"] = "unkown"
    with pytest.raises(CommonError, match="Cross encoder model not found"):
        method(input)
    input = create_base_input.copy()
    input["name"] = ""
    with pytest.raises(ValidationError, match="1 validation error"):
        method(input)
    input = create_base_input.copy()
    input["languages"] = ["a", "b", "c", "d"]
    with pytest.raises(CommonError, match="Invalid languages"):
        method(input)
    input = create_base_input.copy()
    input["languages"] = []
    with pytest.raises(CommonError, match="Invalid languages"):
        method(input)
    input = create_base_input.copy()
    input["chunkingStrategy"] = "invalid"
    with pytest.raises(CommonError, match="Invalid chunking strategy"):
        method(input)
    input = create_base_input.copy()
    input["chunkSize"] = -1
    with pytest.raises(ValidationError, match="1 validation error"):
        method(input)
    input = create_base_input.copy()
    input["chunkOverlap"] = -1
    with pytest.raises(ValidationError, match="1 validation error"):
        method(input)
    input = create_base_input.copy()
    input["chunkSize"] = 101
    input["chunkOverlap"] = 102
    with pytest.raises(CommonError, match="Invalid chunk overlap"):
        method(input)
