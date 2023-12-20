import json
import uuid
import decimal


class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, decimal.Decimal):
            if "." in str(obj):
                return float(obj)
            return int(obj)

        if isinstance(obj, uuid.UUID):
            return str(obj)

        return super(CustomEncoder, self).default(obj)
