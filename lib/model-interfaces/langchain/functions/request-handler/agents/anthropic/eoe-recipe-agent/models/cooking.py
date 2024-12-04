from dataclasses import dataclass
from typing import List, Optional
from .base import JsonDataclass

@dataclass
class CookingContext(JsonDataclass):
    """Structured cooking information extracted from recipe context"""
    primary_method: str
    temperature: Optional[int] = None
    duration: Optional[str] = None
    equipment: Optional[List[str]] = None

@dataclass
class ContextualSubstitution(JsonDataclass):
    substitution: str
    notes: str
    cooking_adjustments: Optional[str] = None
