import os
import logging
from typing import Any, List

from ..base import ModelAdapter
from genai_core.registry import registry
import genai_core.clients

from aws_lambda_powertools import Logger

from langchain_core.messages import BaseMessage
from langchain_core.messages.ai import AIMessage
from langchain_core.messages.human import HumanMessage
from langchain_aws import ChatBedrockConverse
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.prompts.prompt import PromptTemplate
from adapters.shared.prompts.system_prompts import prompts, lang  # Import prompts and language

# Configure logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def get_guardrails() -> dict:
    if "BEDROCK_GUARDRAILS_ID" in os.environ:
        logger.info("Guardrails ID found in environment variables.")
        return {
            "guardrailIdentifier": os.environ["BEDROCK_GUARDRAILS_ID"],
            "guardrailVersion": os.environ.get("BEDROCK_GUARDRAILS_VERSION", "DRAFT"),
        }
    logger.info("No guardrails ID found.")
    return {}


class BedrockChatAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id
        logger.info(f"Initializing BedrockChatAdapter with model_id: {model_id}")
        super().__init__(*args, **kwargs)

    def get_qa_prompt(self):
        # Fetch the QA prompt based on the current language
        qa_system_prompt = prompts[lang]['qa_prompt']
        # Append the context placeholder if needed
        qa_system_prompt_with_context = qa_system_prompt + "\n\n{context}"
        logger.info(f"Generating QA prompt template with: {qa_system_prompt_with_context}")

        # Create the ChatPromptTemplate
        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", qa_system_prompt_with_context),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )

        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")

        return chat_prompt_template

    def get_prompt(self):
        # Fetch the conversation prompt based on the current language
        conversation_prompt = prompts[lang]['conversation_prompt']
        logger.info("Generating general conversation prompt template.")
        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", conversation_prompt),
                MessagesPlaceholder(variable_name="chat_history"),
                ("human", "{input}"),
            ]
        )
        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")
        return chat_prompt_template

    def get_condense_question_prompt(self):
        # Fetch the prompt based on the current language
        contextualize_q_system_prompt = prompts[lang]['contextualize_q_system_prompt']
        logger.info("Generating condense question prompt template.")
        chat_prompt_template = ChatPromptTemplate.from_messages(
            [
                ("system", contextualize_q_system_prompt),
                MessagesPlaceholder("chat_history"),
                ("human", "{input}"),
            ]
        )
        # Trace the ChatPromptTemplate by logging its content
        logger.debug(f"ChatPromptTemplate messages: {chat_prompt_template.messages}")
        return chat_prompt_template

    def get_llm(self, model_kwargs={}, extra={}):
        bedrock = genai_core.clients.get_bedrock_client()
        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
            logger.info(f"Temperature set to: {model_kwargs['temperature']}")
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
            logger.info(f"topP set to: {model_kwargs['topP']}")
        if "maxTokens" in model_kwargs:
            params["max_tokens"] = model_kwargs["maxTokens"]
            logger.info(f"maxTokens set to: {model_kwargs['maxTokens']}")

        guardrails = get_guardrails()
        if len(guardrails.keys()) > 0:
            params["guardrails"] = guardrails
            logger.info(f"Guardrails applied: {guardrails}")

        logger.info(f"Fetching LLM model: {self.model_id}")
        return ChatBedrockConverse(
            client=bedrock,
            model=self.model_id,
            disable_streaming=model_kwargs.get("streaming", False) == False
            or self.disable_streaming,
            callbacks=[self.callback_handler],
            **params,
            **extra,
        )


class BedrockChatNoStreamingAdapter(BedrockChatAdapter):
    """Some models do not support system streaming using the converse API"""

    def __init__(self, *args, **kwargs):
        logger.info("Initializing BedrockChatNoStreamingAdapter with disabled streaming.")
        super().__init__(disable_streaming=True, *args, **kwargs)


class BedrockChatNoSystemPromptAdapter(BedrockChatAdapter):
    """Some models do not support system and message history in the conversation API"""

    def get_prompt(self):
        # Fetch the conversation prompt and translated words based on the current language
        conversation_prompt = prompts[lang]['conversation_prompt']
        question_word = prompts[lang]['question_word']
        assistant_word = prompts[lang]['assistant_word']
        logger.info("Generating no-system-prompt template for conversation.")

        # Combine conversation prompt, chat history, and input into the template
        template = f"""{conversation_prompt}

{{chat_history}}

{question_word}: {{input}}

{assistant_word}:"""

        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template

    def get_condense_question_prompt(self):
        # Change le niveau global à DEBUG
        # Fetch the prompt and translated words based on the current language
        contextualize_q_system_prompt = prompts[lang]['contextualize_q_system_prompt']
        logger.info(f"contextualize_q_system_prompt: {contextualize_q_system_prompt}")
        
        follow_up_input_word = prompts[lang]['follow_up_input_word']
        logger.info(f"follow_up_input_word: {follow_up_input_word}")
        
        standalone_question_word = prompts[lang]['standalone_question_word']
        logger.info(f"standalone_question_word: {standalone_question_word}")
        
        chat_history_word = prompts[lang]['chat_history_word']
        logger.info(f"chat_history_word: {chat_history_word}")

        logger.info("Generating no-system-prompt template for condensing question.")
    
        # Combine the prompt with placeholders
        template = f"""{contextualize_q_system_prompt}
{chat_history_word}:    
{{chat_history}}
{follow_up_input_word}: {{input}}
{standalone_question_word}:"""
        # Log the content of template
        logger.info(f"get_condense_question_prompt: Template content: {template}")    
        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "chat_history"], template=template
        )
    
        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")
   
        return prompt_template

    def get_qa_prompt(self):
        # Fetch the QA prompt and translated words based on the current language
        qa_system_prompt = prompts[lang]['qa_prompt']
        question_word = prompts[lang]['question_word']
        helpful_answer_word = prompts[lang]['helpful_answer_word']
        logger.info("Generating no-system-prompt QA template.")

        # Append the context placeholder if needed

        # Combine the prompt with placeholders
        template = f"""{qa_system_prompt}

{{context}}

{question_word}: {{input}}
{helpful_answer_word}:"""

        # Create the PromptTemplateWithHistory instance
        prompt_template = PromptTemplateWithHistory(
            input_variables=["input", "context"], template=template
        )

        # Log the content of PromptTemplateWithHistory before returning
        logger.debug(f"PromptTemplateWithHistory template: {prompt_template.template}")

        return prompt_template


class BedrockChatNoStreamingNoSystemPromptAdapter(BedrockChatNoSystemPromptAdapter):
    """Some models do not support system streaming using the converse API"""

    def __init__(self, *args, **kwargs):
        super().__init__(disable_streaming=True, *args, **kwargs)


# Register the adapters
registry.register(r"^bedrock.ai21.jamba*", BedrockChatAdapter)
registry.register(r"^bedrock.ai21.j2*", BedrockChatNoStreamingNoSystemPromptAdapter)
registry.register(r"^bedrock\.cohere\.command-(text|light-text).*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock\.cohere\.command-r.*", BedrockChatAdapter)
registry.register(r"^bedrock.anthropic.claude*", BedrockChatAdapter)
registry.register(r"^bedrock.meta.llama*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-large*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-small*", BedrockChatAdapter)
registry.register(r"^bedrock.mistral.mistral-7b-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.mistral.mixtral-*", BedrockChatNoSystemPromptAdapter)
registry.register(r"^bedrock.amazon.titan-t*", BedrockChatNoSystemPromptAdapter)


class PromptTemplateWithHistory(PromptTemplate):
    def format(self, **kwargs: Any) -> str:
        chat_history = kwargs["chat_history"]
        if isinstance(chat_history, List):
            # RunnableWithMessageHistory is provided a list of BaseMessage as a history
            # Since this model does not support history, we format the common prompt to
            # list the history
            chat_history_str = ""
            for message in chat_history:
                if isinstance(message, BaseMessage):
                    prefix = ""
                    if isinstance(message, AIMessage):
                        prefix = "AI: "
                    elif isinstance(message, HumanMessage):
                        prefix = "Human: "
                    chat_history_str += prefix + message.content + "\n"
            kwargs["chat_history"] = chat_history_str
        return super().format(**kwargs)
