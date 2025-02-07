import os
import sys
from unittest.mock import patch

import pytest
from botocore.exceptions import ClientError

lambda_path = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        "../../../lib/authentication/lambda/addFederatedUserToUserGroup",
    )
)
sys.path.insert(0, lambda_path)

from index import (  # noqa: E402
    handler,
    get_user_groups,
    add_user_to_group,
    remove_user_from_group,
)


@pytest.fixture
def cognito_event():
    return {
        "request": {
            "userAttributes": {
                "sub": "test-user-123",
                "custom:chatbot_role": "TestGroup",
            }
        },
        "userPoolId": "us-east-1_testpool",
    }


@pytest.fixture
def mock_cognito():
    with patch("boto3.client") as mock_client:
        yield mock_client.return_value


def test_get_user_groups_success(mock_cognito):
    mock_cognito.admin_list_groups_for_user.return_value = {
        "Groups": [{"GroupName": "Group1"}, {"GroupName": "Group2"}]
    }

    groups = get_user_groups(mock_cognito, "test-user", "test-pool-id")

    assert groups == ["Group1", "Group2"]
    mock_cognito.admin_list_groups_for_user.assert_called_once_with(
        Username="test-user", UserPoolId="test-pool-id"
    )


def test_get_user_groups_with_pagination(mock_cognito):
    mock_cognito.admin_list_groups_for_user.side_effect = [
        {"Groups": [{"GroupName": "Group1"}], "NextToken": "token123"},
        {"Groups": [{"GroupName": "Group2"}]},
    ]

    groups = get_user_groups(mock_cognito, "test-user", "test-pool-id")

    assert groups == ["Group1", "Group2"]
    assert mock_cognito.admin_list_groups_for_user.call_count == 2


def test_get_user_groups_error(mock_cognito):
    mock_cognito.admin_list_groups_for_user.side_effect = ClientError(
        error_response={"Error": {"Code": "UserNotFoundException"}},
        operation_name="AdminListGroupsForUser",
    )

    with pytest.raises(ClientError):
        get_user_groups(mock_cognito, "test-user", "test-pool-id")


def test_add_user_to_group_success(mock_cognito):
    add_user_to_group(mock_cognito, "test-user", "test-group", "test-pool-id")

    mock_cognito.admin_add_user_to_group.assert_called_once_with(
        UserPoolId="test-pool-id", Username="test-user", GroupName="test-group"
    )


def test_remove_user_from_group_success(mock_cognito):
    remove_user_from_group(mock_cognito, "test-user", "test-group", "test-pool-id")

    mock_cognito.admin_remove_user_from_group.assert_called_once_with(
        UserPoolId="test-pool-id", Username="test-user", GroupName="test-group"
    )


def test_handler_new_group_assignment(mock_cognito):
    event = {
        "request": {
            "userAttributes": {
                "sub": "test-user-123",
                "custom:chatbot_role": "NewGroup",
            }
        },
        "userPoolId": "us-east-1_testpool",
    }

    mock_cognito.admin_list_groups_for_user.return_value = {
        "Groups": [{"GroupName": "OldGroup"}]
    }

    result = handler(event, None)

    assert result == event
    mock_cognito.admin_remove_user_from_group.assert_called_once()
    mock_cognito.admin_add_user_to_group.assert_called_once()


def test_handler_no_group_change(mock_cognito):
    event = {
        "request": {
            "userAttributes": {
                "sub": "test-user-123",
                "custom:chatbot_role": "ExistingGroup",
            }
        },
        "userPoolId": "us-east-1_testpool",
    }

    mock_cognito.admin_list_groups_for_user.return_value = {
        "Groups": [{"GroupName": "ExistingGroup"}]
    }

    result = handler(event, None)

    assert result == event
    mock_cognito.admin_remove_user_from_group.assert_not_called()
    mock_cognito.admin_add_user_to_group.assert_not_called()


def test_handler_no_chatbot_role(mock_cognito):
    event = {
        "request": {"userAttributes": {"sub": "test-user-123"}},
        "userPoolId": "us-east-1_testpool",
    }

    result = handler(event, None)

    assert result == event
    mock_cognito.admin_list_groups_for_user.assert_not_called()
