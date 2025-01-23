from functools import wraps


def get_user_id(router):
    user_id = router.current_event.get("identity", {}).get("sub")

    return user_id


def get_user_roles(router):
    user_groups = (
        router.current_event.get("identity", {}).get("claims").get("cognito:groups")
    )

    return user_groups


class UserPermissions:
    """Responsible for validating the user's permissions for API calls
    Args:
        router (aws_lambda_powertools.event_handler.api_gateway.Router): The lambda powertools router defined for the API endpoints
    Valid Roles:
        - `ADMIN_ROLE` = `admin`
        - `WORKSPACES_MANAGER_ROLE` = `workspace_manager`
        - `CHATBOT_USER_ROLE` = `chatbot_user`
    """  # noqa: E501

    ADMIN_ROLE = "admin"
    WORKSPACES_MANAGER_ROLE = "workspace_manager"
    CHATBOT_USER_ROLE = "chatbot_user"

    VALID_ROLES = [
        ADMIN_ROLE,
        WORKSPACES_MANAGER_ROLE,
        CHATBOT_USER_ROLE,
    ]

    def __init__(self, router):
        self.router = router

    def __get_user_role(self):
        user_groups = get_user_roles(self.router)
        if user_groups is not None and len(user_groups) > 0:
            if self.ADMIN_ROLE in user_groups:
                return self.ADMIN_ROLE
            elif self.WORKSPACES_MANAGER_ROLE in user_groups:
                return self.WORKSPACES_MANAGER_ROLE
            elif self.CHATBOT_USER_ROLE in user_groups:
                return self.CHATBOT_USER_ROLE
            else:
                return None

    def approved_roles(self, roles: []):
        """Validates the user calling the endpoint
        has a user role set that is approved for the endpoint
        Args:
            roles (list): list of roles that are approved for the endpoint
        Valid Roles:
            - `ADMIN_ROLE` = `chatbot_admin`
            - `WORKSPACES_MANAGER_ROLE` = `chatbot_workspace_manager`
            - `CHATBOT_USER_ROLE` = `chatbot_user`
        Returns:
            function: If the user is approved, the function being called will be returned for execution
            dict: If the user is not approved, a response of `{"ok": False, "error": "Unauthorized"}` will be returned
            as the response.
        Examples:
        ```
            from aws_lambda_powertools.event_handler.api_gateway import Router
            from genai_core.auth import UserPermissions
            router = Router()
            permissions = UserPermissions(router)
            @router.get("/sample/endpoint")
            @permissions.approved_roles(
                [
                    permissions.ADMIN_ROLE,
                    permissions.WORKSPACES_MANAGER_ROLE
                ]
            )
            def sample_endpoint():
                pass
        ```"""  # noqa: E501

        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kargs):
                user_role = self.__get_user_role()
                if user_role in roles:
                    return func(*args, **kargs)
                else:
                    return {"error": "Unauthorized"}

            return wrapper

        return decorator

    def admin_only(self, func):
        """Validates the user calling the endpoint is an admin
        and returns the function being called for execution
        Returns:
            function: If the user is an admin, the function being called will be returned for execution
            dict: If the user is not an admin, a response of `{"ok": False, "error": "Unauthorized"}` will be returned
            as the response."""  # noqa: E501
        return self.approved_roles([self.ADMIN_ROLE])(func)
