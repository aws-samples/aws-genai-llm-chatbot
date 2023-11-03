import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AWS GenAI LLM Chatbot",
  description: "Deploying a Multi-Model and Multi-RAG Powered Chatbot Using AWS CDK on AWS",
  base: "/aws-genai-llm-chatbot/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'GitHub', link: 'https://github.com/aws-samples/aws-genai-llm-chatbot' }
    ],
  }
})
