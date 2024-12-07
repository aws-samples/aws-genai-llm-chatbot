# recipe_context.py
class RecipeContextProvider:
    @staticmethod
    def get_phase_context(phase: str) -> str:
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
            # ... [rest of the phase contexts]
        }
        return phase_contexts.get(phase, "Phase context not specified")

    @staticmethod
    def get_phase_guidance(phase: str) -> str:
        """Return specific guidance based on user's current phase."""
        phase_guidance = {
            "elimination": """
                - Flag ALL potential trigger ingredients, even in trace amounts
                - Suggest alternatives for every flagged ingredient
                - Identify high-risk preparation methods
                - Recommend safest preparation approaches""",
            # ... [rest of the phase guidance]
        }
        return phase_guidance.get(phase, "Phase guidance not specified")

    @staticmethod
    def get_trigger_details(trigger: str) -> str:
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
            # ... [rest of the trigger details]
        }
        return trigger_details.get(trigger, "Trigger details not specified")

    @staticmethod
    def get_ingredient_reference(triggers: List[str]) -> str:
        """Return personalized ingredient reference focused on user's triggers."""
        reference = ""
        for trigger in triggers:
            reference += f"""
            {trigger.upper()} - Common Sources:
            {RecipeContextProvider.get_trigger_details(trigger)}
            """
        return reference
