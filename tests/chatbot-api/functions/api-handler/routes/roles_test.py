from routes.roles import list_roles

role = {
    "id": "test-role-1",
    "name": "test-role-1",
}


def test_list_roles(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[role])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    response = list_roles()
    assert len(response) == 1
    assert response[0].get("id") == role.get("id")
    assert response[0].get("name") == role.get("name")


def test_roles_empty_list(mocker):
    mocker.patch("genai_core.roles.list_roles", return_value=[])
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user", "admin"])
    assert list_roles() == []


def test_list_roles_unauthorized(mocker):
    mocker.patch("genai_core.auth.get_user_roles", return_value=["user"])
    response = list_roles()
    assert response.get("error") == "Unauthorized"
