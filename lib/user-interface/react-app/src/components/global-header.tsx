import {
  ButtonDropdownProps,
  TopNavigation,
} from "@cloudscape-design/components";
import { useEffect, useState } from "react";
import { Auth } from "aws-amplify";
import useOnFollow from "../common/hooks/use-on-follow";
import { CHATBOT_NAME } from "../common/constants";

export default function GlobalHeader() {
  const onFollow = useOnFollow();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const result = await Auth.currentUserInfo();

      if (!result || Object.keys(result).length === 0) {
        Auth.signOut();
        return;
      }

      const userName = result?.attributes?.email;
      setUserName(userName);
    })();
  }, []);

  const onUserProfileClick = ({
    detail,
  }: {
    detail: ButtonDropdownProps.ItemClickDetails;
  }) => {
    if (detail.id === "signout") {
      Auth.signOut();
    }
  };

  return (
    <div
      style={{ zIndex: 1002, top: 0, left: 0, right: 0, position: "fixed" }}
      id="awsui-top-navigation"
    >
      <TopNavigation
        identity={{
          href: "/",
          logo: {
            src: "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
            alt: {CHATBOT_NAME} + " Logo"
          },
        }}
        utilities={[
          {
            type: "menu-dropdown",
            description: userName ?? "",
            iconName: "user-profile",
            onItemClick: onUserProfileClick,
            items: [
              {
                id: "signout",
                text: "Sign out",
              },
            ],
            onItemFollow: onFollow,
          },
        ]}
      />
    </div>
  );
}
