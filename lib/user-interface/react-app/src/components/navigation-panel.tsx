import {
  SideNavigation,
  SideNavigationProps,
} from "@cloudscape-design/components";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import { useContext, useState, useEffect } from "react";
import { CHATBOT_NAME } from "../common/constants";
import { UserRole } from "../common/types";
import { UserContext } from "../common/user-context";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const userContext = useContext(UserContext);
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
    const [items, setItems] = useState<SideNavigationProps.Item[]>([]);
  useEffect(()=>{
    const navItems: SideNavigationProps.Item[] = [
      {
        type: "link",
        text: "Home",
        href: "/",
      }
    ]
    if(userContext && [UserRole.ADMIN, UserRole.WORKSPACES_MANAGER, UserRole.WORKSPACES_USER, UserRole.CHATBOT_USER].includes(userContext?.userRole)){
      navItems.push({
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
            text: "Models",
            href: "/chatbot/models",
          },
        ],
      },)

      if (appContext?.config.rag_enabled) {
        const crossEncodersItems: SideNavigationProps.Item[] = appContext?.config
          .cross_encoders_enabled
          ? [
              {
                type: "link",
                text: "Cross-encoders",
                href: "/rag/cross-encoders",
              },
            ]
          : [];
  
          navItems.push({
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
      if (userContext && userContext.userRole == UserRole.ADMIN) {
        navItems.push({
          type: "section",
          text: "Administration",
          items: [{ type: "link", text: "Manage Users", href: "/admin/users" }],
        });
      }
      navItems.push(
        { type: "divider" },
        {
          type: "link",
          text: "Documentation",
          href: "https://github.com/aws-samples/aws-genai-llm-chatbot",
          external: true,
        }
      );
    }
    setItems(navItems);
  },[setItems, userContext, appContext])
  
    
  

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
