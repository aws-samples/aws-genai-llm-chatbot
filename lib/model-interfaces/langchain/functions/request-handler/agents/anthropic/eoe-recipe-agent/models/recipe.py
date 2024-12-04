from dataclasses import dataclass
from typing import Dict, List, Optional
from .base import JsonDataclass

@dataclass
class RecipeAnalysis(JsonDataclass):
    """Structured analysis of recipe for EOE triggers with phase-specific context"""
    trigger_ingredients: List[str]
    safe_ingredients: List[str]
    uncertain_ingredients: List[str]
    modification_needed: bool
    trigger_categories: List[str]
    notes: Dict[str, str]
    cross_contamination_risks: List[str]
    phase_specific_concerns: List[str]
    substitution_suggestions: Dict[str, str]

    @classmethod
    def from_dict(cls, data: Dict) -> 'RecipeAnalysis':
        return cls(
            trigger_ingredients=data["trigger_ingredients"],
            safe_ingredients=data["safe_ingredients"],
            uncertain_ingredients=data["uncertain_ingredients"],
            modification_needed=data["modification_needed"],
            trigger_categories=data.get("trigger_categories", []),
            notes=data.get("notes", {}),
            cross_contamination_risks=data.get("cross_contamination_risks", []),
            phase_specific_concerns=data.get("phase_specific_concerns", []),
            substitution_suggestions=data.get("substitution_suggestions", {})
        )

@dataclass
class IngredientSubstitution(JsonDataclass):
    """Structured substitution recommendation"""
    original_ingredient: str
    substitution: str
    notes: str
    cooking_adjustments: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> 'IngredientSubstitution':
        return cls(
            original_ingredient=data["original_ingredient"],
            substitution=data["substitution"],
            notes=data["notes"],
            cooking_adjustments=data.get("cooking_adjustments")
        )

@dataclass
class ModifiedRecipe(JsonDataclass):
    """Structured representation of a modified recipe"""
    original_text: str
    modified_text: str
    substitutions_used: List[IngredientSubstitution]
    modification_notes: List[str]

    @classmethod
    def from_dict(cls, data: dict) -> 'ModifiedRecipe':
        # Convert each substitution dictionary to an IngredientSubstitution object
        substitutions = [
            IngredientSubstitution.from_dict(sub)
            for sub in data.get("substitutions_used", [])
        ] if data.get("substitutions_used") else []

        return cls(
            original_text=data["original_text"],            # Comma added
            modified_text=data["modified_text"],            # Comma added
            substitutions_used=substitutions,               # Properly converted list
            modification_notes=data.get("modification_notes", [])  # Default empty list
        )