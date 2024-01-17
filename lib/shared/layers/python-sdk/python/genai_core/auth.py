def get_user_id(router):
    user_id = router.current_event.get("identity", {}).get("sub")

    return user_id
