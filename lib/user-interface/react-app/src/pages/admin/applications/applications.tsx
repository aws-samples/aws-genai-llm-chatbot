import { BreadcrumbGroup } from "@cloudscape-design/components";
import useOnFollow from "../../../common/hooks/use-on-follow";

import BaseAppLayout from "../../../components/base-app-layout";
import { CHATBOT_NAME } from "../../../common/constants";
import ApplicationTable from "./application-table";

export default function Applications() {
  const onFollow = useOnFollow();

  return (
    <BaseAppLayout
      contentType="table"
      breadcrumbs={
        <BreadcrumbGroup
          onFollow={onFollow}
          items={[
            {
              text: CHATBOT_NAME,
              href: "/",
            },
            {
              text: "Applications",
              href: "/admin/applications",
            },
          ]}
        />
      }
      content={<ApplicationTable />}
    />
  );
}
