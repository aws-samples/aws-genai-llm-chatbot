import genai_core.parameters


def list_bedrock_kbs():
    config = genai_core.parameters.get_config()
    kb_config = config.get("rag", {}).get("engines", {}).get("knowledgeBase", {})
    external = kb_config.get("external", {})

    ret_value = []

    for kb in external:
        current_id = kb.get("knowledgeBaseId", "")
        current_name = kb.get("name", "")

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
