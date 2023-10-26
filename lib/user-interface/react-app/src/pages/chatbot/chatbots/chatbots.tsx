import { BreadcrumbGroup } from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";
import BaseAppLayout from "../../../components/base-app-layout";
import ChatBotsTable from "./chatbots-table";

export default function Chatbots() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      contentType="table"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: "AWS GenAI Chatbot",
              href: "/",
            },
            {
              text: "Chatbots",
              href: "/chatbot/chatbots",
            },
          ]}
        />
      }
      content={<ChatBotsTable />}
    />
  );
}
