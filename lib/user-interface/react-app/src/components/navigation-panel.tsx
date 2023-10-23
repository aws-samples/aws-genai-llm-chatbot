import {
  SideNavigation,
  SideNavigationProps,
} from "@cloudscape-design/components";
import useOnFollow from "../common/hooks/use-on-follow";
import { useNavigationPanelState } from "../common/hooks/use-navigation-panel-state";
import { AppContext } from "../common/app-context";
import { useContext, useState } from "react";

export default function NavigationPanel() {
  const appContext = useContext(AppContext);
  const onFollow = useOnFollow();
  const [navigationPanelState, setNavigationPanelState] =
    useNavigationPanelState();
  const [items] = useState<SideNavigationProps.Item[]>(() => {
    const items: SideNavigationProps.Item[] = [
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
            text: "Models",
            href: "/chatbot/models",
          },
        ],
      },
    ];

    if (appContext?.config.rag_enabled) {
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
          {
            type: "link",
            text: "Cross-encoders",
            href: "/rag/cross-encoders",
          },
          { type: "link", text: "Engines", href: "/rag/engines" },
        ],
      });
    }

    items.push(
      { type: "divider" },
      {
        type: "link",
        text: "Documentation",
        href: "https://github.com/aws-samples/aws-genai-llm-chatbot",
        external: true,
      }
    );

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
      header={{ href: "/", text: "AWS GenAI Chatbot" }}
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
