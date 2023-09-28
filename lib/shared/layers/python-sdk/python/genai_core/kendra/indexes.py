import os
import genai_core.parameters

DEFAULT_KENDRA_INDEX_ID = os.environ.get("DEFAULT_KENDRA_INDEX_ID", "")
DEFAULT_KENDRA_INDEX_NAME = os.environ.get("DEFAULT_KENDRA_INDEX_NAME", "")


def get_kendra_indexes():
    config = genai_core.parameters.get_config()
    kendra_config = config.get("rag", {}).get("engines", {}).get("kendra", {})
    external = kendra_config.get("external", {})

    ret_value = []
    if DEFAULT_KENDRA_INDEX_ID and DEFAULT_KENDRA_INDEX_NAME:
        ret_value.append(
            {
                "id": DEFAULT_KENDRA_INDEX_ID,
                "name": DEFAULT_KENDRA_INDEX_NAME,
                "external": False,
            }
        )

    for kendraIndex in external:
        current_id = kendraIndex.get("kendraId", "")
        current_name = kendraIndex.get("name", "")

        if not current_id or not current_name:
            continue

        ret_value.append(
            {
                "id": current_id,
                "name": current_name,
                "external": True,
            }
        )

    return ret_value
