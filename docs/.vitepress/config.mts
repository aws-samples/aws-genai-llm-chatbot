import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "AWS GenAI LLM Chatbot",
  description: "Deploying a Multi-Model and Multi-RAG Powered Chatbot Using AWS CDK on AWS",
  base: "/aws-genai-llm-chatbot/",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    search: {
      provider: 'local'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/aws-samples/aws-genai-llm-chatbot' }
    ],
    nav: [
      { text: 'Home', link: '/' },
      { text: 'About', link: '/about/welcome' },
      {
        text: 'Guide',
        items: [
          { text: 'Deploy', link: '/guide/deploy' },
          { text: 'Developer Guide', link: '/guide/developers' },
        ]
      },
      { text: 'Documentation', link: '/documentation/model-requirements' }
    ],
    sidebar: [
      {
        text: 'About', items: [
          { text: 'The Project', link: '/about/welcome' },
          { text: 'Features', link: '/about/features' },
          {
            text: 'Architecture', items: [
              { text: 'Architecture Diagram', link: '/about/architecture' },
              { text: 'AWS Resources Overview', link: '/about/aws-resources-deployed' },
            ]
          },
          { text: 'Authors & Credits', link: '/about/authors' },
          { text: 'License Information', link: '/about/license' },
        ]
      },
      {
        text: 'Guide',
        items: [
          { text: 'Deploy', link: '/guide/deploy' },
          { text: 'Developer Guide', link: '/guide/developers' },
          { text: 'Development Prioritization', link: '/guide/prioritization' },
        ]
      },
      {
        text: 'Documentation',
        items: [
          { text: 'AppSync', link: '/documentation/appsync' },
          { text: 'CloudFront Geo Restriction', link: '/documentation/cf-geo-restriction' },
          {
            text: 'Cognito Federation', items: [
              { text: 'Cognito Overview', link: '/documentation/cognito/overview' },
              { text: 'Keycloak SAML example', link: '/documentation/cognito/keycloak-saml' },
              { text: 'Keycloak OIDC example', link: '/documentation/cognito/keycloak-oidc' },
            ]
          },
          { text: 'Custom Public Domain', link: '/documentation/custom-public-domain' },
          { text: 'Document Retrieval', link: '/documentation/retriever' },
          { text: 'Inference Script', link: '/documentation/inference-script' },
          { text: 'Model Requirements', link: '/documentation/model-requirements' },
          { text: 'Precautions', link: '/documentation/precautions' },
          { text: 'Private Chatbot', link: '/documentation/private-chatbot' },
          { text: 'SageMaker Schedule', link: '/documentation/sagemaker-schedule' },
          { text: 'Security', link: '/documentation/vulnerability-scanning' },
          { text: 'Self-hosted models', link: '/documentation/self-hosted-models' },
        ]
      }
    ],
    footer: {
      message: 'This library is licensed under the MIT-0 License.'
    }
  }
})
