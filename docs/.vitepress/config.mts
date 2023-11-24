import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AWS GenAI LLM Chatbot",
  description: "Deploying a Multi-Model and Multi-RAG Powered Chatbot Using AWS CDK on AWS",
  base: "/aws-genai-llm-chatbot/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    socialLinks: [
      { icon: 'github', link: 'https://github.com/aws-samples/aws-genai-llm-chatbot' }
    ],
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' }
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Welcome', link: '/guide/getting-started' }
        ]
      },
      {
        text: 'Example',
        items: [
          { text: 'Lipsum', link: '/guide/lipsum' },
          { text: 'Lipsum 2', link: '/guide/lipsum2' }
        ]
      }
    ],
    footer: {
      message: 'This library is licensed under the MIT-0 License.'
    }
  }
})
