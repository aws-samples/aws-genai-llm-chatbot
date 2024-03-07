import json

from langchain.schema import AIMessage, HumanMessage
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate


Llama2ChatPrompt = """<s>[INST] <<SYS>>
You are an helpful assistant that provides concise answers to user questions with as little sentences as possible and at maximum 3 sentences. You do not repeat yourself. You avoid bulleted list or emojis.
<</SYS>>

{chat_history}<s>[INST] Context: {input} [/INST]"""

Llama2ChatQAPrompt = """<s>[INST] <<SYS>>
Use the following conversation history and pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. You do not repeat yourself. You avoid bulleted list or emojis.
<</SYS>>

{chat_history}<s>[INST] Context: {context}

{question} [/INST]"""

Llama2ChatCondensedQAPrompt = """<s>[INST] <<SYS>>
Given the following conversation and the question at the end, rephrase the follow up input to be a standalone question, in the same language as the follow up input. You do not repeat yourself. You avoid bulleted list or emojis.
<</SYS>>

{chat_history}<s>[INST] {question} [/INST]"""


Llama2ChatPromptTemplate = PromptTemplate.from_template(Llama2ChatPrompt)
Llama2ChatQAPromptTemplate = PromptTemplate.from_template(Llama2ChatQAPrompt)
Llama2ChatCondensedQAPromptTemplate = PromptTemplate.from_template(
    Llama2ChatCondensedQAPrompt
)


class Llama2ConversationBufferMemory(ConversationBufferMemory):
    @property
    def buffer_as_str(self) -> str:
        return self.get_buffer_string()

    def get_buffer_string(self) -> str:
        """modified version of https://github.com/langchain-ai/langchain/blob/bed06a4f4ab802bedb3533021da920c05a736810/libs/langchain/langchain/schema/messages.py#L14"""
        human_message_cnt = 0
        string_messages = []
        for m in self.chat_memory.messages:
            if isinstance(m, HumanMessage):
                if human_message_cnt == 0:
                    message = f"{m.content} [/INST]"
                else:
                    message = f"<s>[INST] {m.content} [/INST]"
                human_message_cnt += 1
            elif isinstance(m, AIMessage):
                message = f"{m.content} </s>"
            else:
                raise ValueError(f"Got unsupported message type: {m}")
            string_messages.append(message)

        return "".join(string_messages)
