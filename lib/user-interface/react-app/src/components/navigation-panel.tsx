import {
  SideNavigation,
  SideNavigationProps,
} from "@cloudscape-design/components";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import { useContext, useState } from "react";
import { CHATBOT_NAME } from "../common/constants";
import { UserContext } from "../common/user-context";
import { UserRole } from "../common/types";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [items] = useState<SideNavigationProps.Item[]>(() => {
    const items: SideNavigationProps.Item[] = [];
    if (
      userContext.userRoles.includes(UserRole.ADMIN) ||
      userContext.userRoles.includes(UserRole.WORKSPACE_MANAGER)
    ) {
      const adminAndWorkspaceManagerItems: SideNavigationProps.Item[] = [
        {
          type: "link",
          text: "Home",
          href: "/",
        },
        {
          type: "section",
          text: "Chatbot",
          items: [
            { type: "link", text: "Playground", href: "/chatbot/playground" },
            {
              type: "link",
              text: "Multi-chat playground",
              href: "/chatbot/multichat",
            },
            {
              type: "link",
              text: "Sessions",
              href: "/chatbot/sessions",
            },
            {
              type: "link",
              text: "Models",
              href: "/chatbot/models",
            },
          ],
        },
      ];
      items.push(...adminAndWorkspaceManagerItems);

      if (appContext?.config.rag_enabled) {
        const crossEncodersItems: SideNavigationProps.Item[] = appContext
          ?.config.cross_encoders_enabled
          ? [
              {
                type: "link",
                text: "Cross-encoders",
                href: "/rag/cross-encoders",
              },
            ]
          : [];

        items.push({
          type: "section",
          text: "Retrieval-Augmented Generation (RAG)",
          items: [
            { type: "link", text: "Dashboard", href: "/rag" },
            {
              type: "link",
              text: "Semantic search",
              href: "/rag/semantic-search",
            },
            { type: "link", text: "Workspaces", href: "/rag/workspaces" },
            {
              type: "link",
              text: "Embeddings",
              href: "/rag/embeddings",
            },
            ...crossEncodersItems,
            { type: "link", text: "Engines", href: "/rag/engines" },
          ],
        });
      }
    }

    if (userContext.userRoles.includes(UserRole.ADMIN)) {
      items.push({
        type: "section",
        text: "Admin",
        items: [
          {
            type: "link",
            text: "Applications",
            href: "/admin/applications",
          },
        ],
      });

      items.push(
        { type: "divider" },
        {
          type: "link",
          text: "Documentation",
          href: "https://aws-samples.github.io/aws-genai-llm-chatbot/",
          external: true,
        }
      );
    }

    return items;
  });

  const onChange = ({
    detail,
  }: {
    detail: SideNavigationProps.ChangeDetail;
  }) => {
    const sectionIndex = items.indexOf(detail.item);
    setNavigationPanelState({
      collapsedSections: {
        ...navigationPanelState.collapsedSections,
        [sectionIndex]: !detail.expanded,
      },
    });
  };

  return (
    <SideNavigation
      onFollow={onFollow}
      onChange={onChange}
      header={{ href: "/", text: CHATBOT_NAME }}
      items={items.map((value, idx) => {
        if (value.type === "section") {
          const collapsed =
            navigationPanelState.collapsedSections?.[idx] === true;
          value.defaultExpanded = !collapsed;
        }

        return value;
      })}
    />
  );
}
