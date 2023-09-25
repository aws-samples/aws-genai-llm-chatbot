def get_user_id(router):
    user_id = (
        router.current_event.get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
        .get("cognito:username")
    )

    return user_id
