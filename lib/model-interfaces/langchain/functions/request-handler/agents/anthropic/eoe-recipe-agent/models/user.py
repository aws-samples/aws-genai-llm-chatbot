from dataclasses import dataclass
from typing import List
from .base import JsonDataclass

@dataclass
class UserProfile(JsonDataclass):
    """User dietary profile"""
    name: str
    triggers: List[str]
    phase: str

    @classmethod
    def from_dict(cls, data: dict) -> 'UserProfile':
        return cls(
            name=data["name"],
            triggers=data.get("triggers", []),
            phase=data["phase"]
        )