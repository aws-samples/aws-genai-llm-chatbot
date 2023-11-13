import genai_core.clients

from langchain.llms import Bedrock
from langchain.prompts.prompt import PromptTemplate

from ..base import ModelAdapter
from ..registry import registry


class BedrockClaudeAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_tokens_to_sample"] = model_kwargs["maxTokens"]

        return Bedrock(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )

    def get_qa_prompt(self):
        template = """
        Mens: Dit is een vriendschappelijk gesprek tussen een mens en een AI. 
        De AI is spraakzaam en geeft specifieke details uit zijn context, maar beperkt dit tot 240 tokens.
        Als de AI het antwoord op een vraag niet weet, zegt hij eerlijk dat hij het niet weet. 
        het niet weet.

        Assistent: OK, begrepen, ik zal een spraakzame waarheidsgetrouwe AI-assistent zijn.

        Mens: Hier zijn een paar documenten in <documenten> tags:
        <documenten>
        {context}
        </documenten>
        Geef op basis van de bovenstaande documenten een gedetailleerd antwoord op {question}. 
        Antwoord "weet niet" indien niet aanwezig in het document. 

        Assistent:
        """

        return PromptTemplate(
            template=template, input_variables=["context", "question"]
        )

    def get_prompt(self):
        template = """Het volgende is een vriendschappelijk gesprek tussen een mens en een AI. Als de AI het antwoord op een vraag niet weet, zegt hij eerlijk dat hij het niet weet.

        Huidig gesprek:
        {chat_history}

        Vraag: {input}
        
        Assistent: """

        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template

    def get_condense_question_prompt(self):
        template = """{chat_history}
        Mens:
        Gegeven het vorige gesprek en een vervolgvraag hieronder, herformuleer de vervolgvraag
        zodat het een op zichzelf staande vraag wordt.

        Vervolgvraag: {question}
        Op zichzelf staande vraag:

        Assistent:"""

        return PromptTemplate(
            input_variables=["chat_history", "question"],
            chat_history="{chat_history}",
            template=template,
        )


# Register the adapter
registry.register(r"^bedrock.anthropic.claude*", BedrockClaudeAdapter)
