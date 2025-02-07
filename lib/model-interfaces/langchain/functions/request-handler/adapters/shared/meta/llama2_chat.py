from langchain.schema import AIMessage, HumanMessage
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate


Llama2ChatPrompt = """<s>[INST] <<SYS>>
{system_prompt}
<</SYS>>

{chat_history}<s>[INST] Context: {input} [/INST]"""  # noqa:E501

Llama2ChatQAPrompt = """<s>[INST] <<SYS>>
{system_prompt}
<</SYS>>

{chat_history}<s>[INST] Context: {context}

{question} [/INST]"""  # noqa:E501

Llama2ChatCondensedQAPrompt = """<s>[INST] <<SYS>>
{system_prompt}
<</SYS>>

{chat_history}<s>[INST] {question} [/INST]"""  # noqa:E501


def get_llama2_chat_template(custom_prompt: str) -> PromptTemplate:
    if custom_prompt:
        system_prompt = custom_prompt
    else:
        system_prompt = "You are an helpful assistant that provides concise answers to user questions with as little sentences as possible and at maximum 3 sentences. You do not repeat yourself. You avoid bulleted list or emojis."  # noqa: E501
    return PromptTemplate.from_template(Llama2ChatPrompt).partial(
        system_prompt=system_prompt
    )


def get_llama2_chat_qa_template(custom_prompt: str) -> PromptTemplate:
    if custom_prompt:
        system_prompt = custom_prompt
    else:
        system_prompt = "Use the following conversation history and pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. You do not repeat yourself. You avoid bulleted list or emojis."  # noqa: E501
    return PromptTemplate.from_template(Llama2ChatQAPrompt).partial(
        system_prompt=system_prompt
    )


def get_llama2_chat_condensed_qa_template(custom_prompt: str) -> PromptTemplate:
    if custom_prompt:
        system_prompt = custom_prompt
    else:
        system_prompt = "Given the following conversation and the question at the end, rephrase the follow up input to be a standalone question, in the same language as the follow up input. You do not repeat yourself. You avoid bulleted list or emojis."  # noqa: E501
    return PromptTemplate.from_template(Llama2ChatCondensedQAPrompt).partial(
        system_prompt=system_prompt
    )


class Llama2ConversationBufferMemory(ConversationBufferMemory):
    @property
    def buffer_as_str(self) -> str:
        return self.get_buffer_string()

    def get_buffer_string(self) -> str:
        """modified version of https://github.com/langchain-ai/langchain/blob/bed06a4f4ab802bedb3533021da920c05a736810/libs/langchain/langchain/schema/messages.py#L14"""  # noqa: E501
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
