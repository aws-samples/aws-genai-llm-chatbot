import json
import re
import anthropic
from langchain_core.messages import HumanMessage
from typing import Dict, List, Optional, Tuple, Type, TypeVar, Any
from enum import Enum
from dataclasses import dataclass, asdict
from datetime import datetime
from models.recipe import RecipeAnalysis, IngredientSubstitution, ModifiedRecipe
from models.cooking import CookingContext, ContextualSubstitution
from models.user import UserProfile

T = TypeVar('T')

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


def extract_json(text):
    # Find the position of first '{' and last '}'
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        return None

    # Extract potential JSON substring
    json_str = text[start:end + 1]

    try:
        # Validate and parse JSON
        return json.loads(json_str)
    except json.JSONDecodeError:
        return None

class EOERecipeAssistant:
    def __init__(self, api_key: str, preferred_substitutions: Optional[Dict[str, Dict[CookingMethod, ContextualSubstitution]]] = None):
        self.client = anthropic.Anthropic(api_key=api_key)

        self.preferred_substitutions = preferred_substitutions or {
            "butter": {
                CookingMethod.BAKING: ContextualSubstitution(
                    substitution="ghee",
                    notes="Use clarified butter/ghee for similar richness while avoiding dairy proteins",
                    cooking_adjustments="Reduce amount by 10-15% as ghee is more concentrated"
                ),
                CookingMethod.GRILLING: ContextualSubstitution(
                    substitution="olive oil",
                    notes="Use high-quality olive oil for flavor and moisture",
                    cooking_adjustments="Use about 3/4 the amount of oil compared to butter"
                ),
                CookingMethod.SAUTEING: ContextualSubstitution(
                    substitution="coconut oil",
                    notes="Use refined coconut oil for higher smoke point",
                    cooking_adjustments="1:1 substitution ratio"
                )
            },
        }

        self._cooking_method_cache = {}

    async def _detect_cooking_method_llm(self, recipe_context: str) -> CookingContext:
        """Use Anthropic's Claude to analyze recipe context and determine cooking methods and parameters."""
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

            # Use the Anthropic client to create a message
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=1000,
                    temperature=0,
                    messages=[{"role": "user", "content": prompt}]
                )
            )

            data = extract_json(response.content[0].text)

            if data is None:
                raise ValueError("Detect cooking method from LLM is none")

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

    async def analyze_recipe_with_context(
        self,
        recipe: str,
        user_profile: UserProfile
    ) -> Tuple[RecipeAnalysis, CookingContext]:
        """Analyze recipe and detect cooking context concurrently."""

        def check_result(result: Any, expected_type: Type[T]) -> T:
            if isinstance(result, BaseException):
                raise result
            if not isinstance(result, expected_type):
                raise TypeError(f"Expected {expected_type.__name__}, got {type(result).__name__}")
            return result

        # Run both operations concurrently
        analysis_task = asyncio.create_task(
            self.analyze_recipe(recipe, user_profile)
        )
        context_task = asyncio.create_task(
            self._detect_cooking_method_llm(recipe)
        )

        # Wait for both tasks to complete
        analysis, context = await asyncio.gather(
            analysis_task,
            context_task,
            return_exceptions=True
        )

        return (
            check_result(analysis, RecipeAnalysis),
            check_result(context, CookingContext)
        )

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

            prompt = f"""As an expert in EOE-safe recipe modification, create a modified version of this recipe
            incorporating all substitutions while maintaining recipe structure and clarity.

            Recipe Analysis:
            {analysis}

            Original Recipe:
            {original_recipe}

            Required Substitutions:
            {subs_context}

            Cooking Context:
            Method: {cooking_context.primary_method.value}
            Temperature: {f"{cooking_context.temperature}°F" if cooking_context.temperature else "Not specified"}
            Duration: {cooking_context.duration if cooking_context.duration else "Not specified"}

            Return ONLY a JSON object in this exact format with no additional text:
            {{
                "modified_recipe": "complete modified recipe text",
                "modification_notes": ["list", "of", "important", "notes", "about", "modifications"]
            }}"""

            # Use the Anthropic client to create a message
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=2000,
                    temperature=0,
                    messages=[{"role": "user", "content": prompt}]
                )
            )

            data = extract_json(response.content[0].text)

            if data is None:
                raise ValueError("Modify recipe is none")

            return ModifiedRecipe(
                original_text=original_recipe,
                modified_text=data["modified_recipe"],
                substitutions_used=substitutions,
                modification_notes=data["modification_notes"]
            )

        except Exception as e:
            raise ValueError(f"Failed to generate modified recipe: {str(e)}")

    async def analyze_recipe(self, recipe: str, user_profile: UserProfile) -> RecipeAnalysis:
        """Analyze a recipe based on user's specific EOE triggers and current phase. Returns a structured analysis
        using the Anthropic API with JSON-focused messaging."""
        try:
            # Build our rich context as a structured message
            expert_context = {
                "type": "text",
                "text": """You are an expert in personalized EOE (Eosinophilic Esophagitis) dietary management.
                Your primary focus is on helping individuals navigate their EOE journey based on their known triggers and current phase."""
            }

            user_context = {
                "type": "text",
                "text": f"""USER PROFILE:
                Current Phase: {user_profile.phase}
                Known Triggers: {', '.join(user_profile.triggers)}

                CONTEXT BASED ON USER'S PHASE:
                {self.get_phase_context(user_profile.phase)}"""
            }

            recipe_content = {
                "type": "text",
                "text": f"""Recipe to Analyze:
                {recipe}

                {self.get_analysis_priorities(user_profile)}"""
            }

            json_schema = {
                "type": "text",
                "text": """{
                    "trigger_ingredients": ["list", "of", "trigger", "ingredients"],
                    "safe_ingredients": ["list", "of", "safe", "ingredients"],
                    "uncertain_ingredients": ["list", "of", "uncertain", "ingredients"],
                    "modification_needed": true or false,
                    "trigger_categories": ["list", "of", "trigger", "categories"],
                    "notes": {
                        "ingredient_name": "reason for concern or uncertainty"
                    },
                    "cross_contamination_risks": ["list", "of", "possible", "risks"],
                    "phase_specific_concerns": ["list", "of", "concerns", "based", "on", "current", "phase"],
                    "substitution_suggestions": {
                        "ingredient": "suggested_replacement"
                    }
                }"""
            }

            # Create a structured message for the API
            messages = [
                {
                    "role": "user",
                    "content": [
                        expert_context,
                        user_context,
                        recipe_content,
                        {
                            "type": "text",
                            "text": "Analyze the recipe and return a JSON object matching exactly this schema:"
                        },
                        json_schema
                    ]
                }
            ]

            # Make the API call with structured messaging and strong JSON enforcement
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=1500,
                    temperature=0,
                    system="You are a recipe analysis expert. Return only valid JSON matching the provided schema, with no additional text.",
                    messages=messages
                )
            )

            try:
                # Parse the response directly as JSON
                recipe_analysis = json.loads(response.content[0].text)
                return RecipeAnalysis.from_dict(recipe_analysis)
            except json.JSONDecodeError as e:
                raise ValueError(f"Failed to parse JSON response: {e}. Response was: {response.content[0].text}")


        except Exception as e:
            raise ValueError(f"Failed to analyze recipe: {str(e)}")

    def get_analysis_priorities(self, user_profile: UserProfile) -> str:
        """Helper method to generate analysis priorities based on user profile."""
        return f"""
        ANALYSIS PRIORITIES:
        1. PRIMARY FOCUS - User's Known Triggers:
        - Carefully check for ANY form of {', '.join(user_profile.triggers)}
        - Consider both obvious and hidden sources of these specific triggers
        - Flag ingredients that commonly cross-react with known triggers
        - Identify potential cross-contamination risks for known triggers

        2. Phase-Appropriate Considerations:
        {self.get_phase_guidance(user_profile.phase)}

        3. Additional Watchpoints:
        - If in elimination phase: Also check standard EOE triggers not yet tested
        - If in reintroduction phase: Pay special attention to ingredients related to foods being tested
        - If in maintenance phase: Focus on known triggers while allowing safe foods

        Common Foods and Ingredients Reference:
        {self.get_ingredient_reference(user_profile.triggers)}"""

    def get_phase_context(self, phase: str) -> str:
        """Return context-specific guidance based on user's current phase."""
        phase_contexts = {
            "elimination": """
                You are in the elimination phase, which means:
                - Requires elimination of multiple common foods (dairy, wheat, eggs, soy, fish/shellfish, nuts)
                - Strictly avoiding all identified trigger foods
                - Being extra cautious about cross-contamination risks
                - Looking for hidden sources of trigger ingredients
                - Maintaining a detailed food and symptom diary
                Goals: Identify safe foods and establish baseline symptoms""",

            "reintroduction": """
                You are in the reintroduction phase, which means:
                - Carefully testing one food category at a time
                - Paying special attention to symptoms
                - Maintaining strict elimination of other trigger foods
                - Documenting all reactions
                Goals: Systematically identify specific trigger foods""",

            "maintenance": """
                You are in the maintenance phase, which means:
                - Avoiding confirmed trigger foods
                - Having more flexibility with proven safe foods
                - Monitoring for any changes in reactions
                - Being prepared for occasional challenges
                Goals: Long-term management while maintaining quality of life"""
        }
        return phase_contexts.get(phase, "Phase context not specified")

    def get_phase_guidance(self, phase: str) -> str:
        """Return specific guidance based on user's current phase."""
        phase_guidance = {
            "elimination": """
                - Flag ALL potential trigger ingredients, even in trace amounts
                - Suggest alternatives for every flagged ingredient
                - Identify high-risk preparation methods
                - Recommend safest preparation approaches""",

            "reintroduction": """
                - Focus especially on ingredients related to current test food
                - Note potential cross-reactive ingredients
                - Suggest modifications to isolate test ingredient
                - Flag ingredients that might confound test results""",

            "maintenance": """
                - Focus on confirmed trigger ingredients
                - Allow known safe ingredients
                - Note any new ingredients that might need testing
                - Suggest modifications based on established safe alternatives"""
        }
        return phase_guidance.get(phase, "Phase guidance not specified")

    def get_ingredient_reference(self, triggers: List[str]) -> str:
        """Return personalized ingredient reference focused on user's triggers."""
        # Build custom reference focusing on user's specific triggers
        reference = ""
        for trigger in triggers:
            reference += f"""
            {trigger.upper()} - Common Sources:
            {self.get_trigger_details(trigger)}
            """
        return reference

    def get_trigger_details(self, trigger: str) -> str:
        """Return detailed information about specific trigger foods."""
        trigger_details = {
            "wheat": """
                Common Foods:
                - Breads, pizza crust, pasta, cereals
                - Most flours, Baked goods, crackers
                - Soy sauce, gravies, couscous

                Ingredients:
                - Barley, Malt, Durum, Farina,
                - Kamut, Matzah, Semolina, Spelt, Rye""",
            "dairy": """
                Common Foods:
                - Cheese, butter, cream, custard
                - Cow and goats milk, half-and-half
                - yogurt, ice cream, sour cream, pudding

                Ingredients:
                - Whey, Casein, Rennet Casein, Lactose
                - Diacetyl, Lactalbunim, Llactoferrin
                - Recaldent, Tagatose""",
            "eggs": """
                Common Foods:
                - Eggs, Egg substitutes, Eggnog
                - Meringue, Mayonnaise, Baked goods

                Ingredients:
                - Albumim, Lysozyme, Lecithin
                - Ovalbumin, Ovovitellin, Globulin""",
            "soy": """
                Common Foods:
                - Miso, Edamame, Tofu, Soy sauce
                - Natto, Shoyu, Soybean, Tamari
                - Tempeh, Quorn

                Ingredients:
                - Soy, Soy fiber, Soy flour, Soy protein
                - Textured, vegetable protein""",
            "Fish and shell fish": """
                Common Foods:
                - ALL fish
                - ALL shellfish

                Ingredients:
                - Imitation fish, Fish stock/sauce
                - Seafood flavoring, Surimi, Bouillabaisse""",
             "Peanuts and tree nuts": """
                Common Foods:
                - ALL NUTS, Lychee

                Incredients:
                - Peanut oil, Nut meal, Nut meat
                - Nut milk, Nut Extracts, Nut Paste
             """
            # Add other trigger details similarly
        }
        return trigger_details.get(trigger, "Trigger details not specified")

    async def suggest_substitution(
        self,
        recipe_context: str,
        ingredient: str,
        user_profile: UserProfile,
        cooking_context: Optional[CookingContext] = None
    ) -> IngredientSubstitution:
        """Suggest substitution based on cooking context analysis."""
        ingredient_lower = ingredient.lower()

        if not cooking_context:
            cooking_context = await self._detect_cooking_method_llm(recipe_context)

        if ingredient_lower in self.preferred_substitutions:
            sub_info = self.preferred_substitutions[ingredient_lower].get(
                cooking_context.primary_method
            )

            # If no direct match for cooking method, try to find a high-temperature alternative
            if not sub_info and cooking_context and cooking_context.temperature:
                if cooking_context.temperature >= 400:
                    sub_info = self.preferred_substitutions[ingredient_lower].get(
                        CookingMethod.ROASTING
                    )

            # If we found a preferred substitution, return it with context-specific notes
            if sub_info:
                context_notes = f"{sub_info.notes}"
                if cooking_context and cooking_context.temperature:
                    context_notes += f"\nFor {cooking_context.temperature}°F cooking temperature"

                return IngredientSubstitution(
                    original_ingredient=ingredient,
                    substitution=sub_info.substitution,
                    notes=context_notes,
                    cooking_adjustments=sub_info.cooking_adjustments
                )

        # If no preferred substitution found, use Claude to suggest one
        try:
            # Get cooking context if not provided
            if not cooking_context:
                cooking_context = await self._detect_cooking_method_llm(recipe_context)

            prompt = f"""You are an expert in EOE dietary management and recipe modification.
            Please suggest substitutions for the following ingredient, considering the specific cooking context.

            Recipe Context: {recipe_context}
            Cooking Method: {cooking_context.primary_method.value}
            Temperature: {f"{cooking_context.temperature}°F" if cooking_context.temperature else "Not specified"}
            Duration: {cooking_context.duration if cooking_context.duration else "Not specified"}

            Ingredient to Substitute: {ingredient}
            Current Diet Phase: {user_profile.phase}

            Return ONLY a JSON object in this exact format with no additional text or explanation:
            {{
                "original_ingredient": "ingredient name",
                "substitution": "recommended substitution",
                "notes": "notes about the substitution",
                "cooking_adjustments": "any necessary cooking adjustments"
            }}"""

            # Use the Anthropic client to create a message
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.messages.create(
                    model="claude-3-5-haiku-20241022",
                    max_tokens=1000,
                    temperature=0,
                    messages=[{"role": "user", "content": prompt}]
                )
            )

            data = extract_json(response.content[0].text)

            if data is None:
                raise ValueError("Ingredient substitution is none")

            return IngredientSubstitution.from_dict(data)

        except Exception as e:
            raise ValueError(f"Failed to suggest substitution: {str(e)}")

    async def process_substitutions(
        self,
        recipe: str,
        analysis: RecipeAnalysis,
        user_profile: UserProfile,
        cooking_context: CookingContext
    ) -> List[IngredientSubstitution]:
        """Process all substitutions concurrently."""
        substitution_tasks = [
            self.suggest_substitution(
                recipe_context=recipe,
                ingredient=ingredient,
                user_profile=user_profile,
                cooking_context=cooking_context
            )
            for ingredient in analysis.trigger_ingredients
        ]

        # Process all substitutions concurrently with error handling
        results = await asyncio.gather(*substitution_tasks, return_exceptions=True)

        # Handle any errors and collect successful substitutions
        substitutions = []
        errors = []

        for ingredient, result in zip(analysis.trigger_ingredients, results):
            if isinstance(result, Exception):
                errors.append(f"Failed to get substitution for {ingredient}: {str(result)}")
            else:
                substitutions.append(result)

        if errors:
            print("Substitution warnings:", "\n".join(errors))

        return substitutions

# Example usage
async def main():
    from dotenv import load_dotenv
    import os

    load_dotenv()
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not found in environment variables")

    assistant = EOERecipeAssistant(api_key)
    user = UserProfile(
        name="Greg",
        triggers=["dairy", "wheat","eggs" ],
        phase="elimination"  # elimination, reintroduction, maintenance
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
        # Get analysis and substitutions as before
        analysis, cooking_context = await assistant.analyze_recipe_with_context(recipe, user)

        print("\nRecipe Analysis:")
        print(analysis.to_json_pretty())

        # print(f"Trigger Ingredients: {analysis.trigger_ingredients}")
        # print(f"Safe Ingredients: {analysis.safe_ingredients}")
        # print(f"Uncertain Ingredients: {analysis.uncertain_ingredients}")
        # print(f"Modification Needed: {analysis.modification_needed}")
        # print(f"Trigger Categories: {analysis.trigger_categories}")
        # print(f"Notes: {analysis.notes}")
        # print(f"Cross Contamination Risks: {analysis.cross_contamination_risks}")
        # print(f"Phase specific concerns: {analysis.phase_specific_concerns}")
        # print(f"Substitution suggestions: {analysis.substitution_suggestions}")


        print(f"\nCooking Context:")
        print(f"Method: {cooking_context.primary_method.value}")
        print(f"Temperature: {cooking_context.temperature}°F")
        print(f"Duration: {cooking_context.duration}")
        print(f"Equipment: {cooking_context.equipment}")


         # Concurrent substitution processing
        substitutions = await assistant.process_substitutions(
            recipe, analysis, user, cooking_context
        )

        print("\nSubstitution Suggestions:")
        for sub in substitutions:
            print(f"\nOriginal: {sub.original_ingredient}")
            print(f"Substitute with: {sub.substitution}")
            print(f"Notes: {sub.notes}")
            if sub.cooking_adjustments:
                print(f"Cooking Adjustments: {sub.cooking_adjustments}")


        # Generate modified recipe
        modified_recipe = await assistant.generate_modified_recipe(
            original_recipe=recipe,
            analysis=analysis,
            substitutions=substitutions,
            cooking_context=cooking_context
        )

        print("\nModified Recipe:")
        print(modified_recipe.modified_text)
        print("\nModification Notes:")
        for note in modified_recipe.modification_notes:
            print(f"- {note}")

    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())