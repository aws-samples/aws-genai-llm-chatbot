from pydantic import ValidationError
import pytest
from routes.kendra import kendra_indexes
from routes.kendra import kendra_data_sync
from routes.kendra import kendra_is_syncing


def test_kendra_indexes(mocker):
    mock = mocker.patch("genai_core.kendra.get_kendra_indexes", return_value=[])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert kendra_indexes() == []
    assert mock.call_count == 1


def test_kendra_indexes_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = kendra_indexes()
    assert response.get("error") == "Unauthorized"


def test_kendra_data_sync(mocker):
    mock = mocker.patch("genai_core.kendra.start_kendra_data_sync")
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert kendra_data_sync("id") == True
    mock.assert_called_once_with(workspace_id="id")


def test_kendra_data_sync_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = kendra_data_sync("id")
    assert response.get("error") == "Unauthorized"


def test_kendra_is_syncing(mocker):
    mock = mocker.patch("genai_core.kendra.kendra_is_syncing", return_value=False)
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert kendra_is_syncing("id") == False
    mock.assert_called_once_with(workspace_id="id")


def test_kendra_is_syncing_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = kendra_is_syncing("id")
    assert response.get("error") == "Unauthorized"


def test_kendra_is_syncing_invalid_input(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    with pytest.raises(ValidationError, match="1 validation error"):
        kendra_is_syncing("")
    with pytest.raises(ValidationError, match="1 validation error"):
        kendra_is_syncing(None)
