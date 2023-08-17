import Link from '@cloudscape-design/components/link';
import Cards from '@cloudscape-design/components/cards';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import { useNavigate } from 'react-router-dom';

import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          description="An opensource, modular and comprehensive solution to deploy a multi LLM powered chatbot using AWS CDK on AWS."
          actions={
            <div className="mt-8">
              <Button iconAlign="right" iconName="contact" onClick={() => navigate('/chatbot')} variant="primary">
                Start chatting
              </Button>
            </div>
          }
        >
          <div className="mt-5">AWS GenAI Chatbot</div>
        </Header>
      }
    >
      <Cards
        cardDefinition={{
          header: (item) => (
            <Link external={item.external} href={item.href} fontSize="heading-m">
              {item.name}
            </Link>
          ),
          sections: [
            {
              content: (item) => (
                <div className="card-section-image">
                  <img src={item.img} alt="Placeholder" />
                </div>
              ),
            },
            {
              content: (item) => (
                <div className="card-section-description">
                  <div>{item.description}</div>
                </div>
              ),
            },
            {
              id: 'type',
              header: 'Type',
              content: (item) => item.type,
            },
          ],
        }}
        cardsPerRow={[{ cards: 1 }, { minWidth: 700, cards: 3 }]}
        items={[
          {
            name: 'Amazon Bedrock',
            external: true,
            type: 'AWS Fully Managed',
            href: 'https://aws.amazon.com/bedrock/',
            img: '/img/welcome/amazon-bedrock.png',
            description: 'Amazon Bedrock is a fully managed service that makes foundation models (FMs) from Amazon and leading AI startups available through an API.',
          },
          {
            name: 'Amazon SageMaker',
            external: true,
            type: 'AWS Self hosted',
            href: 'https://aws.amazon.com/sagemaker/',
            img: '/img/welcome/self-hosted.jpg',
            description: 'CDK construct to deploy and run self hosted models on Amazon SageMaker. Deploy pre-trained models from SageMaker Foundation/Jumpstart and HuggingFace.',
          },
          {
            name: '3P Models',
            type: 'External API',
            href: '#',
            img: '/img/welcome/3p.png',
            description: 'Interface with 3rd party models via provided API. Such as AI21 Labs, OpenAI, HuggingFace Interface Endpoints etc.',
          },
        ]}
      />
      <div className="w-full mb-5 mt-5"></div>
      <Container
        media={{
          content: <img src="/img/welcome/ui-dark.png" alt="placeholder" />,
          width: 300,
          position: 'side',
        }}
      >
        <Header variant="h1" description="CDK construct available to deploy a React based webapp">
          Full fledged user interface
        </Header>
        <div className="mb-2"></div>
        The webcapp is hosted on{' '}
        <Link external href="https://aws.amazon.com/s3/">
          Amazon S3
        </Link>{' '}
        behind{' '}
        <Link external href="https://aws.amazon.com/cloudfront/">
          Amazon CloudFront
        </Link>{' '}
        with{' '}
        <Link external href="https://aws.amazon.com/cognito/">
          Cognito Authentication
        </Link>{' '}
        to help you interact and experiment with <strong>multiple LLMs</strong>, <strong>multiple RAG sources</strong>, <strong>conversational history support</strong> and <strong>documents upload</strong>.<div className="mb-2"></div>
        The interface layer between the UI and backend is build on top of{' '}
        <Link external href="https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html">
          Amazon API Gateway WebSocket APIs
        </Link>
        <div className="mb-2"></div>
        Build on top of{' '}
        <Link external href="https://cloudscape.design/">
          AWS Cloudscape design system
        </Link>
      </Container>
      <div className="w-full mb-5 mt-5"></div>
      <SpaceBetween direction="vertical" size="l">
        <Header variant="h1" description="You can optionally experiment with one or more of the following CDK constructs to implement RAG requests.">
          Retrieval Augmented Generation (RAG) sources
        </Header>
        <Cards
          cardDefinition={{
            header: (item) => (
              <Link href={item.href} external={item.external} fontSize="heading-m">
                {item.name}
              </Link>
            ),
            sections: [
              {
                content: (item) => (
                  <div className="card-section-description">
                    <div>{item.description}</div>
                  </div>
                ),
              },
              {
                id: 'type',
                header: 'Type',
                content: (item) => item.type,
              },
              {
                id: 'embeddings',
                header: 'Embeddings',
                content: (item) =>
                  item.embeddings ? (
                    <Link href={item.embeddingsHref} external={item.external} fontSize="heading-x">
                      {item.embeddings}
                    </Link>
                  ) : (
                    'N/A'
                  ),
              },
            ],
          }}
          cardsPerRow={[{ cards: 1 }, { minWidth: 700, cards: 3 }]}
          items={[
            {
              name: 'Amazon Aurora with pgvector',
              type: 'Vector Database',
              embeddings: 'sentence-transformers/all-MiniLM-L6-v2',
              embeddingsHref: 'https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2',
              external: true,
              href: 'https://aws.amazon.com/about-aws/whats-new/2023/07/amazon-aurora-postgresql-pgvector-vector-storage-similarity-search/',
              description: 'Amazon Aurora PostgreSQL-Compatible Edition now supports the pgvector extension to store embeddings from machine learning (ML) models in your database and to perform efficient similarity searches.',
              tags: ['Fully managed'],
            },
            {
              name: 'Amazon Opensearch VectorSearch',
              type: 'Vector Database',
              embeddings: 'Amazon Titan Embeddings',
              embeddingsHref: 'https://aws.amazon.com/bedrock/titan/',
              external: true,
              href: 'https://aws.amazon.com/blogs/big-data/amazon-opensearch-services-vector-database-capabilities-explained/',
              description: 'With OpenSearch Service’s vector database capabilities, you can implement semantic search, Retrieval Augmented Generation (RAG) with LLMs, recommendation engines, and search rich media.',
            },
            {
              name: 'Amazon Kendra',
              external: true,
              type: 'Search Engine',
              // embeddings: 'Amazon Titan Embeddings',
              // embeddingsHref: 'https://aws.amazon.com/bedrock/titan/',
              href: 'https://aws.amazon.com/kendra/',
              description: 'Amazon Kendra is an intelligent search service powered by machine learning (ML).',
            },
          ]}
        />
      </SpaceBetween>
      <SpaceBetween direction="vertical" size="m">
        <Header variant="h1" description="Prebuilt CDK constructs to interact with your underlying models and data source">
          Models Interface
        </Header>
        <Cards
          cardDefinition={{
            header: (item) => (
              <Link href={item.href} external={item.external} fontSize="heading-m">
                {item.name}
              </Link>
            ),
            sections: [
              {
                content: (item) => (
                  <div className="card-section-description">
                    <div>{item.description}</div>
                  </div>
                ),
              },
            ],
          }}
          cardsPerRow={[{ cards: 1 }]}
          items={[
            {
              name: 'Langchain',
              external: true,
              href: 'https://python.langchain.com/',
              description: 'LangChain is a framework designed to simplify the creation of applications using large language models.',
            },
          ]}
        />
      </SpaceBetween>
    </ContentLayout>
  );
}
