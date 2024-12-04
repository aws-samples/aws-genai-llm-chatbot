from dataclasses import dataclass, asdict
from datetime import datetime
import json
from typing import Dict

@dataclass
class JsonDataclass:
    """Base dataclass that provides JSON serialization methods for all child classes."""

    def to_dict(self) -> Dict:
        data = asdict(self)
        data['timestamp'] = datetime.now().isoformat()
        data['version'] = '1.0'
        return data

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    def to_json_pretty(self) -> str:
        return json.dumps(self.to_dict(), indent=2, sort_keys=True)
