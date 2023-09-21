import { Header, HeaderProps } from "@cloudscape-design/components";

interface EnginesPageHeaderProps extends HeaderProps {
  title?: string;
}

export function EnginesPageHeader({
  title = "Engines",
  ...props
}: EnginesPageHeaderProps) {
  return (
    <Header
      variant="awsui-h1-sticky"
      {...props}
      description="Aurora Serverless v2 PostgreSQL utilizes pgvector, Amazon OpenSearch Serverless uses a vector engine. Kendra uses the Retrieve API."
    >
      {title}
    </Header>
  );
}
