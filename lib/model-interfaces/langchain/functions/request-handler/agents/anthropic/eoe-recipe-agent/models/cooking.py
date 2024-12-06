from dataclasses import dataclass
from typing import List, Optional, Dict
from .base import JsonDataclass
from enum import Enum

class CookingMethod(str, Enum):
    BAKING = "baking"
    GRILLING = "grilling"
    SAUTEING = "sauteing"
    FRYING = "frying"
    ROASTING = "roasting"
    BROILING = "broiling"
    STEAMING = "steaming"
    BRAISING = "braising"
    SLOW_COOKING = "slow_cooking"
    NO_COOK = "no_cook"
    UNKNOWN = "unknown"


@dataclass
class CookingContext(JsonDataclass):
    """Represents the cooking context including method, temperature, duration, and equipment."""
    primary_method: CookingMethod = CookingMethod.UNKNOWN
    temperature: Optional[float] = None
    duration: Optional[str] = None
    equipment: Optional[List[str]] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'CookingContext':
        """Create a CookingContext instance from a dictionary."""
        # Convert string method to enum if present
        if method_str := data.get('primary_method'):
            try:
                method = CookingMethod(method_str.lower())
            except ValueError:
                method = CookingMethod.UNKNOWN
        else:
            method = CookingMethod.UNKNOWN

        return cls(
            primary_method=method,
            temperature=data.get('temperature'),
            duration=data.get('duration'),
            equipment=data.get('equipment')
        )


@dataclass
class ContextualSubstitution(JsonDataclass):
    substitution: str
    notes: str
    cooking_adjustments: Optional[str] = None