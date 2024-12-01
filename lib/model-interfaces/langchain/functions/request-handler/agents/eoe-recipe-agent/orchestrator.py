from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
from langchain_core.agents import AgentAction, AgentFinish
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_anthropic import ChatAnthropic
from langchain.agents import AgentExecutor
from langchain_core.tools import BaseTool
from langchain.agents.format_scratchpad import format_to_openai_function_messages
from langchain.agents.output_parsers import OpenAIFunctionsAgentOutputParser
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools.render import format_tool_to_openai_function
import json
import re

def extract_json(text: str) -> Dict[str, Any]:
    """Extract and parse JSON from text."""
    try:
        # Find the position of first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}')
        if start == -1 or end == -1:
            raise ValueError("No JSON object found in text")

        # Extract potential JSON substring
        json_str = text[start:end + 1]
        return json.loads(json_str)
    except (json.JSONDecodeError, ValueError) as e:
        raise ValueError(f"Failed to extract JSON: {str(e)}")

class CookingMethod(Enum):
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
    NOT_SURE = "not_sure"

@dataclass
class ContextualSubstitution:
    substitution: str
    notes: str
    cooking_adjustments: Optional[str] = None

@dataclass
class CookingContext:
    primary_method: CookingMethod
    temperature: Optional[int] = None
    duration: Optional[str] = None
    equipment: Optional[List[str]] = None

@dataclass
class UserProfile:
    name: str
    triggers: List[str]
    phase: str

@dataclass
class RecipeAnalysis:
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
    def from_dict(cls, data: dict) -> 'RecipeAnalysis':
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
class IngredientSubstitution:
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
class ModifiedRecipe:
    """Structured representation of a modified recipe"""
    original_text: str
    modified_text: str
    substitutions_used: List[IngredientSubstitution]
    modification_notes: List[str]

class EOERecipeAssistant:
    def __init__(self, api_key: str):
        # Initialize LLM
        self.llm = ChatAnthropic(
            anthropic_api_key=api_key,
            model_name="claude-3-5-haiku-20241022"
        )

        # Initialize cooking method cache
        self._cooking_method_cache = {}

        # Initialize preferred substitutions
        self.preferred_substitutions = {
            "butter": {
                CookingMethod.BAKING: ContextualSubstitution(
                    substitution="ghee",
                    notes="Use clarified butter/ghee for similar richness while avoiding dairy proteins",
                    cooking_adjustments="Reduce amount by 10-15% as ghee is more concentrated"
                ),
            },
        }

    async def _detect_cooking_method_llm(self, recipe_context: str) -> CookingContext:
        """Use LLM to analyze recipe context and determine cooking methods and parameters."""
        cache_key = hash(recipe_context)
        if cache_key in self._cooking_method_cache:
            return self._cooking_method_cache[cache_key]

        try:
            prompt = f"""As a culinary expert, analyze this recipe context and identify the cooking method and parameters.

            Recipe Context:
            {recipe_context}

            Return ONLY a JSON object with this exact format, no additional text:
            {{
                "primary_method": "one of: baking, grilling, sauteing, frying, roasting, no_cook",
                "temperature": null or temperature in Fahrenheit if specified,
                "duration": null or cooking duration if specified,
                "equipment": ["list", "of", "cooking", "equipment"]
            }}"""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            data = extract_json(response.content)

            context = CookingContext(
                primary_method=CookingMethod(data["primary_method"]),
                temperature=data.get("temperature"),
                duration=data.get("duration"),
                equipment=data.get("equipment")
            )

            self._cooking_method_cache[cache_key] = context
            return context

        except Exception as e:
            print(f"LLM cooking method detection failed: {str(e)}")
            return self._detect_cooking_method_basic(recipe_context)

    def _detect_cooking_method_basic(self, recipe_context: str) -> CookingContext:
        """Fallback method using basic keyword matching."""
        context_lower = recipe_context.lower()

        method_keywords = {
            CookingMethod.BAKING: ["bake", "baking", "oven", "350 degrees", "375 degrees"],
            CookingMethod.GRILLING: ["grill", "grilling", "barbecue", "bbq"],
            CookingMethod.SAUTEING: ["saute", "sauteing", "pan-fry", "skillet"],
            CookingMethod.FRYING: ["fry", "deep-fry", "deep fry"],
            CookingMethod.ROASTING: ["roast", "roasting"]
        }

        temp_match = re.search(r'(\d+)\s*degrees?(?:\s*[Ff])?', context_lower)
        temperature = int(temp_match.group(1)) if temp_match else None

        duration_match = re.search(r'(\d+[-\s]?\d*)\s*(minutes?|hours?)', context_lower)
        duration = duration_match.group(0) if duration_match else None

        primary_method = CookingMethod.NO_COOK
        for method, keywords in method_keywords.items():
            if any(keyword in context_lower for keyword in keywords):
                primary_method = method
                break

        return CookingContext(
            primary_method=primary_method,
            temperature=temperature,
            duration=duration,
            equipment=None
        )

    async def analyze_recipe(self, recipe: str, user_profile: UserProfile) -> RecipeAnalysis:
        """Analyze a recipe based on user's specific EOE triggers and current phase."""
        try:
            prompt = f"""You are an expert in personalized EOE dietary management.
            Analyze this recipe for {user_profile.name}'s triggers: {', '.join(user_profile.triggers)}
            Current phase: {user_profile.phase}

            Recipe:
            {recipe}

            Return ONLY a JSON object with analysis results matching the RecipeAnalysis structure."""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            data = extract_json(response.content)
            return RecipeAnalysis.from_dict(data)

        except Exception as e:
            raise ValueError(f"Failed to analyze recipe: {str(e)}")

    async def analyze_recipe_with_context(
        self,
        recipe: str,
        user_profile: UserProfile
    ) -> Tuple[RecipeAnalysis, CookingContext]:
        """Analyze a recipe and return both analysis and cooking context."""
        analysis = await self.analyze_recipe(recipe, user_profile)
        cooking_context = await self._detect_cooking_method_llm(recipe)
        return analysis, cooking_context

    async def suggest_substitution(
        self,
        recipe_context: str,
        ingredient: str,
        user_profile: UserProfile,
        cooking_context: Optional[CookingContext] = None
    ) -> IngredientSubstitution:
        """Suggest substitution based on cooking context analysis."""
        if not cooking_context:
            cooking_context = await self._detect_cooking_method_llm(recipe_context)

        try:
            prompt = f"""Suggest a substitution for {ingredient} in this recipe context:
            {recipe_context}

            Cooking method: {cooking_context.primary_method.value}
            Temperature: {f"{cooking_context.temperature}°F" if cooking_context.temperature else "Not specified"}

            User is in {user_profile.phase} phase

            Return ONLY a JSON object with substitution details."""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            data = extract_json(response.content)
            return IngredientSubstitution.from_dict(data)

        except Exception as e:
            raise ValueError(f"Failed to suggest substitution: {str(e)}")

    async def generate_modified_recipe(
        self,
        original_recipe: str,
        analysis: RecipeAnalysis,
        substitutions: List[IngredientSubstitution],
        cooking_context: CookingContext
    ) -> ModifiedRecipe:
        """Generate a modified version of the recipe using analysis and substitutions."""
        try:
            subs_context = "\n".join([
                f"- Replace {sub.original_ingredient} with {sub.substitution}"
                f" ({sub.cooking_adjustments if sub.cooking_adjustments else 'no adjustment needed'})"
                for sub in substitutions
            ])

            prompt = f"""Modify this recipe applying these substitutions:

            Original Recipe:
            {original_recipe}

            Substitutions:
            {subs_context}

            Return ONLY a JSON object with the modified recipe and notes."""

            response = await self.llm.ainvoke([HumanMessage(content=prompt)])
            data = extract_json(response.content)

            return ModifiedRecipe(
                original_text=original_recipe,
                modified_text=data["modified_recipe"],
                substitutions_used=substitutions,
                modification_notes=data.get("modification_notes", [])
            )

        except Exception as e:
            raise ValueError(f"Failed to generate modified recipe: {str(e)}")

class AnalyzeRecipeTool(BaseTool):
    name: str = "analyze_recipe"
    description: str = "Analyzes a recipe for EOE triggers and provides detailed analysis"
    assistant: Any

    def __init__(self, eoe_assistant):
        super().__init__(assistant=eoe_assistant)
        self.assistant = eoe_assistant

    def _run(self, recipe: str, user_profile: Dict[str, Any]) -> Dict[str, Any]:
        profile = UserProfile(
            name=user_profile["name"],
            triggers=user_profile["triggers"],
            phase=user_profile["phase"]
        )
        analysis, context = self.assistant.analyze_recipe_with_context(recipe, profile)
        return {
            "analysis": analysis.__dict__,
            "cooking_context": {
                "method": context.primary_method.value,
                "temperature": context.temperature,
                "duration": context.duration,
                "equipment": context.equipment
            }
        }

class SuggestSubstitutionTool(BaseTool):
    name: str = "suggest_substitution"
    description: str = "Suggests substitutions for trigger ingredients in a recipe"
    assistant: Any  # Add this line

    def __init__(self, eoe_assistant):
        super().__init__(assistant=eoe_assistant)
        self.assistant = eoe_assistant

    def _run(self, recipe_context: str, ingredient: str, user_profile: Dict[str, Any], cooking_context: Dict[str, Any]) -> Dict[str, Any]:
        profile = UserProfile(
            name=user_profile["name"],
            triggers=user_profile["triggers"],
            phase=user_profile["phase"]
        )
        context = CookingContext(
            primary_method=CookingMethod(cooking_context["method"]),
            temperature=cooking_context.get("temperature"),
            duration=cooking_context.get("duration"),
            equipment=cooking_context.get("equipment")
        )
        substitution = self.assistant.suggest_substitution(
            recipe_context=recipe_context,
            ingredient=ingredient,
            user_profile=profile,
            cooking_context=context
        )
        return substitution.__dict__


class ModifyRecipeTool(BaseTool):
    name: str = "modify_recipe"
    description: str = "Generates a modified version of the recipe using analysis and substitutions"
    assistant: Any  # Add this line

    def __init__(self, eoe_assistant):
        super().__init__(assistant=eoe_assistant)
        self.assistant = eoe_assistant

    def _run(self, original_recipe: str, analysis: Dict[str, Any], substitutions: List[Dict[str, Any]], cooking_context: Dict[str, Any]) -> Dict[str, Any]:
        context = CookingContext(
            primary_method=CookingMethod(cooking_context["method"]),
            temperature=cooking_context.get("temperature"),
            duration=cooking_context.get("duration"),
            equipment=cooking_context.get("equipment")
        )
        modified = self.assistant.generate_modified_recipe(
            original_recipe=original_recipe,
            analysis=RecipeAnalysis.from_dict(analysis),
            substitutions=[IngredientSubstitution.from_dict(s) for s in substitutions],
            cooking_context=context
        )
        return modified.__dict__

class EOERecipeAgent:
    def __init__(self, api_key: str):
        # Initialize the EOERecipeAssistant
        self.eoe_assistant = EOERecipeAssistant(api_key)

        # Initialize tools
        self.tools = [
            AnalyzeRecipeTool(self.eoe_assistant),
            SuggestSubstitutionTool(self.eoe_assistant),
            ModifyRecipeTool(self.eoe_assistant)
        ]

        # Initialize LLM
        self.llm = ChatAnthropic(
            anthropic_api_key=api_key,
            model_name="claude-3-5-haiku-20241022"
        )

        # Create prompt template
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert EOE (Eosinophilic Esophagitis) recipe assistant.
            Your goal is to help users modify recipes to be safe for their specific EOE triggers and dietary phase.
            Use the available tools to analyze recipes, suggest substitutions, and create modified versions.

            Always think step by step:
            1. First analyze the recipe to identify triggers
            2. Then suggest appropriate substitutions
            3. Finally generate a modified version

            Remember to consider:
            - The user's specific triggers
            - Their current dietary phase
            - Cooking methods and temperatures
            - Cross-contamination risks
            - Hidden sources of triggers"""),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad")
        ])

        # Set up agent
        self.agent = (
            {
                "input": lambda x: x["input"],
                "agent_scratchpad": lambda x: format_to_openai_function_messages(
                    x["intermediate_steps"]
                )
            }
            | self.prompt
            | self.llm
            | OpenAIFunctionsAgentOutputParser()
        )

        # Create executor
        self.agent_executor = AgentExecutor(
            agent=self.agent,
            tools=self.tools,
            verbose=True,
            handle_parsing_errors=True
        )

    async def process_recipe(self, recipe: str, user_profile: UserProfile) -> Dict:
        """Process a recipe for the given user profile."""
        result = await self.agent_executor.ainvoke(
            {
                "input": f"""Please analyze and modify this recipe for {user_profile.name} who has
                the following EOE triggers: {', '.join(user_profile.triggers)} and is in the {user_profile.phase} phase.

                Recipe:
                {recipe}
                """
            }
        )
        return result

# Example usage
async def main():
    from dotenv import load_dotenv
    import os

    load_dotenv()
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    agent = EOERecipeAgent(api_key)

    user = UserProfile(
        name="John",
        triggers=["dairy", "wheat", "eggs"],
        phase="elimination"
    )

    recipe = """
    Classic Chocolate Chip Cookies
    Ingredients:
    - 2 1/4 cups all-purpose flour
    - 1 cup butter, softened
    - 2 large eggs
    - 3/4 cup granulated sugar
    - 3/4 cup packed brown sugar
    - 1 teaspoon vanilla extract
    - 1 teaspoon baking soda
    - 1/2 teaspoon salt
    - 2 cups semisweet chocolate chips
    Instructions:
    - Bake at 350 degrees
    """

    try:
        result = await agent.process_recipe(recipe, user)
        print("Agent Result:", json.dumps(result, indent=2))

    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())