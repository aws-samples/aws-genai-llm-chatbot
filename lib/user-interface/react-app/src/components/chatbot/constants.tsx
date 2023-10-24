export const STREAMING = true
export const SHOW_METADATA = false
export const MAX_TOKENS = 512
export const TEMPERATURE = 0.6
export const TOP_P = 0.9
export const FILES = null

export const PROMPT_TEMPLATE: string = `Human: The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{chat_history}

Question: {input}

Assistant:`;

export const PROMPT_DESC =
<>
This Prompt Template is designed to give a Large Language Model (LLM) direction to shape its response to the input question.
The template can provide the model with illustrations or establish a certain tone.
Here are the following placeholders available for use in your template:
<ul>
<li>
<b>{'{input}'}</b> - <i>Mandatory</i> - this placeholder will be substituted with the
chat user's input message
</li>
<li>
<b>{'{chat_history}'}</b> - <i>Mandatory</i> - this placeholder will be substituted with the
chat history of the session
</li>
</ul>
</>

export const RAG_PROMPT_TEMPLATE: string = `Human: Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

{context}

Question: {question}

Assistant:`;

export const RAG_PROMPT_DESC = 
<>
The RAG Prompt Template guides the Large Language Model (LLM) to generate high-quality, relevant responses by conditioning it on retrieved knowledge sources; this allows integrating external information to enhance and contextualize the LLM's text generation.
Here are the following placeholders available for use in your template:
 <ul>
     <li>
         <b>{'{question}'}</b> - <i>Mandatory</i> - this placeholder will be substituted with the
         chat user's question
     </li>
     <li>
         <b>{'{context}'}</b> - <i>Mandatory</i> - this placeholder will be
         substituted with the document excerpts obtained from the configured knowledge base
     </li>
 </ul>
</>
  
export const RAG_SQ_PROMPT_TEMPLATE: string = `{chat_history}

Human: Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question, in its original language.
Follow Up Input: {question}

Assistant:`;

export const RAG_SQ_PROMPT_DESC = 
<>
A RAG Standalone Question Prompt Template presents an open-ended question to the language model without additional context. This allows the model to generate a response based on the question itself, relying on its own knowledge and reasoning.
Here are the following placeholders available for use in your template:
<ul>
<li>
<b>{'{question}'}</b> - <i>Mandatory</i> - this placeholder will be substituted with the
chat user's question
</li>
<li>
<b>{'{chat_history}'}</b> - <i>Mandatory</i> - this placeholder will be substituted with the
chat history of the session
</li>
</ul>
</>

