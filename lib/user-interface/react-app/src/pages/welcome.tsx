import {
  ContentLayout,
  Header,
  Cards,
  Container,
  SpaceBetween,
  Link,
  BreadcrumbGroup,
} from "@cloudscape-design/components";
import BaseAppLayout from "../components/base-app-layout";
import RouterButton from "../components/wrappers/router-button";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";

export default function Welcome() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
          ]}
        />
      }
      content={
        <ContentLayout
          header={
            <Header
              variant="h1"
              description="An opensource, modular and comprehensive solution to deploy a multi-model and multi-RAG powered chatbot using AWS CDK on AWS."
              actions={
                <RouterButton
                  iconAlign="right"
                  iconName="contact"
                  variant="primary"
                  href="/chatbot/playground"
                >
                  Getting Started
                </RouterButton>
              }
            >
              Chatbot Home
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Cards
              cardDefinition={{
                header: (item) => (
                  <Link
                    external={item.external}
                    href={item.href}
                    fontSize="heading-m"
                  >
                    {item.name}
                  </Link>
                ),
                sections: [
                  {
                    content: (item) => (
                      <div>
                        <img
                          src={item.img}
                          alt="Placeholder"
                          style={{ width: "100%" }}
                        />
                      </div>
                    ),
                  },
                  {
                    content: (item) => (
                      <div>
                        <div>{item.description}</div>
                      </div>
                    ),
                  },
                  {
                    id: "type",
                    header: "Type",
                    content: (item) => item.type,
                  },
                ],
              }}
              cardsPerRow={[{ cards: 1 }, { minWidth: 700, cards: 3 }]}
              items={[
                {
                  name: "Amazon Bedrock",
                  external: true,
                  type: "AWS Fully Managed",
                  href: "https://aws.amazon.com/bedrock/",
                  img: "/images/welcome/amazon-bedrock.png",
                  description:
                    "Amazon Bedrock is a fully managed service that makes foundation models (FMs) from Amazon and leading AI startups available through an API.",
                },
                {
                  name: "Amazon SageMaker",
                  external: true,
                  type: "AWS Self hosted",
                  href: "https://aws.amazon.com/sagemaker/",
                  img: "/images/welcome/self-hosted.jpg",
                  description:
                    "CDK construct to deploy and run self hosted models on Amazon SageMaker. Deploy pre-trained models from SageMaker Foundation/Jumpstart and HuggingFace.",
                },
                {
                  name: "3P Models",
                  type: "External API",
                  href: "#",
                  img: "/images/welcome/3p.png",
                  description:
                    "Interface with 3rd party models via provided API. Such as AI21 Labs, OpenAI, HuggingFace Interface Endpoints etc.",
                },
              ]}
            />
            <Container
              media={{
                content: (
                  <img src="/images/welcome/ui-dark.png" alt="placeholder" />
                ),
                width: 300,
                position: "side",
              }}
            >
              <Header
                variant="h1"
                description="CDK construct available to deploy a React based webapp"
              >
                Full-fledged user interface
              </Header>
              <p>
                The web app is hosted on{" "}
                <Link external href="https://aws.amazon.com/s3/">
                  Amazon S3
                </Link>{" "}
                behind{" "}
                <Link external href="https://aws.amazon.com/cloudfront/">
                  Amazon CloudFront
                </Link>{" "}
                with{" "}
                <Link external href="https://aws.amazon.com/cognito/">
                  Cognito Authentication
                </Link>{" "}
                to help you interact and experiment with{" "}
                <strong>multiple Models</strong>,{" "}
                <strong>multiple RAG sources</strong>,{" "}
                <strong>conversational history support</strong> and{" "}
                <strong>documents upload</strong>.
              </p>
              <p>
                The interface layer between the UI and backend is build on top
                of{" "}
                <Link
                  external
                  href="https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html"
                >
                  Amazon API Gateway WebSocket APIs
                </Link>
                <br />
                Build on top of{" "}
                <Link external href="https://cloudscape.design/">
                  AWS Cloudscape design system
                </Link>
              </p>
            </Container>
            <Header
              variant="h1"
              description="You can optionally experiment with one or more of the following CDK constructs to implement RAG requests."
            >
              Retrieval Augmented Generation (RAG) sources
            </Header>
            <Cards
              cardDefinition={{
                header: (item) => (
                  <Link
                    href={item.href}
                    external={item.external}
                    fontSize="heading-m"
                  >
                    {item.name}
                  </Link>
                ),
                sections: [
                  {
                    content: (item) => <div>{item.description}</div>,
                  },
                  {
                    id: "type",
                    header: "Type",
                    content: (item) => item.type,
                  },
                ],
              }}
              cardsPerRow={[{ cards: 1 }, { minWidth: 700, cards: 3 }]}
              items={[
                {
                  name: "Amazon Aurora with pgvector",
                  type: "Vector Database",
                  external: true,
                  href: "https://aws.amazon.com/about-aws/whats-new/2023/07/amazon-aurora-postgresql-pgvector-vector-storage-similarity-search/",
                  description:
                    "Amazon Aurora PostgreSQL-Compatible Edition now supports the pgvector extension to store embeddings from machine learning (ML) models in your database and to perform efficient similarity searches.",
                  tags: ["Fully managed"],
                },
                {
                  name: "Amazon Opensearch VectorSearch",
                  type: "Vector Database",
                  external: true,
                  href: "https://aws.amazon.com/blogs/big-data/amazon-opensearch-services-vector-database-capabilities-explained/",
                  description:
                    "With OpenSearch Service’s vector database capabilities, you can implement semantic search, Retrieval Augmented Generation (RAG) with LLMs, recommendation engines, and search rich media.",
                },
                {
                  name: "Amazon Kendra",
                  external: true,
                  type: "Search Engine",
                  href: "https://aws.amazon.com/kendra/",
                  description:
                    "Amazon Kendra is an intelligent search service powered by machine learning (ML).",
                },
              ]}
            />
          </SpaceBetween>
        </ContentLayout>
      }
    ></BaseAppLayout>
  );
}
