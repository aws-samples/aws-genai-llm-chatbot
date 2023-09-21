import uuid


def convert_types(data):
    if isinstance(data, dict):
        return {k: convert_types(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [convert_types(v) for v in data]
    elif isinstance(data, uuid.UUID):
        return str(data)
    else:
        return data
