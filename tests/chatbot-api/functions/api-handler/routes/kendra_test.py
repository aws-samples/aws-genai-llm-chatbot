from pydantic import ValidationError
import pytest
from routes.kendra import kendra_indexes
from routes.kendra import kendra_data_sync
from routes.kendra import kendra_is_syncing


def test_kendra_indexes(mocker):
    mock = mocker.patch("genai_core.kendra.get_kendra_indexes", return_value=[])
    assert kendra_indexes() == []
    assert mock.call_count == 1


def test_kendra_data_sync(mocker):
    mock = mocker.patch("genai_core.kendra.start_kendra_data_sync")
    assert kendra_data_sync("id") == True
    mock.assert_called_once_with(workspace_id="id")


def test_kendra_is_syncing(mocker):
    mock = mocker.patch("genai_core.kendra.kendra_is_syncing", return_value=False)
    assert kendra_is_syncing("id") == False
    mock.assert_called_once_with(workspace_id="id")


def test_kendra_is_syncing_invalid_input():
    with pytest.raises(ValidationError, match="1 validation error"):
        kendra_is_syncing("")
    with pytest.raises(ValidationError, match="1 validation error"):
        kendra_is_syncing(None)
