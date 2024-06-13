import { useEffect, useState } from "react";
import {
  Authenticator,
  Heading,
  ThemeProvider,
  defaultDarkModeOverride,
  useTheme,
  Button,
  Divider,
  View,
} from "@aws-amplify/ui-react";
import App from "../app";
import { Amplify, Auth } from "aws-amplify";
import { AppConfig } from "../common/types";
import { AppContext } from "../common/app-context";
import { Alert, StatusIndicator } from "@cloudscape-design/components";
import { StorageHelper } from "../common/helpers/storage-helper";
import { Mode } from "@cloudscape-design/global-styles";
import "@aws-amplify/ui-react/styles.css";
import { CHATBOT_NAME } from "../common/constants";

export default function AppConfigured() {
  const { tokens } = useTheme();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<boolean | null>(null);
  const [theme, setTheme] = useState(StorageHelper.getTheme());

  useEffect(() => {
    (async () => {
      try {
        const result = await fetch("/aws-exports.json");
        const awsExports = await result.json();
        const currentConfig = Amplify.configure(awsExports) as AppConfig | null;
        
        // Extract the query string from the current URL
        const queryString = window.location.search;
        
        // Use URLSearchParams to work with the query string easily
        const urlParams = new URLSearchParams(queryString);

        if (currentConfig?.config.auth_federated_provider?.auto_redirect && urlParams.get('loginlocal') != 'true') {
          let authenticated = false;
          try {
            const user = await Auth.currentAuthenticatedUser();
            if (user) {
              authenticated = true;
            }
          } catch (e) {
            authenticated = false;
          }

          if (!authenticated) {
            const federatedProvider =
              currentConfig.config.auth_federated_provider;

            if (!federatedProvider.custom) {
              Auth.federatedSignIn({ provider: federatedProvider.name });
            } else {
              Auth.federatedSignIn({ customProvider: federatedProvider.name });
            }

            return;
          }
        }

        setConfig(currentConfig);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, []);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "style"
        ) {
          const newValue =
            document.documentElement.style.getPropertyValue(
              "--app-color-scheme"
            );

          const mode = newValue === "dark" ? Mode.Dark : Mode.Light;
          if (mode !== theme) {
            setTheme(mode);
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    return () => {
      observer.disconnect();
    };
  }, [theme]);

  if (!config) {
    if (error) {
      return (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Alert header="Configuration error" type="error">
            Error loading configuration from "
            <a href="/aws-exports.json" style={{ fontWeight: "600" }}>
              /aws-exports.json
            </a>
            "
          </Alert>
        </div>
      );
    }

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <StatusIndicator type="loading">Loading</StatusIndicator>
      </div>
    );
  }

  return (
    <AppContext.Provider value={config}>
      <ThemeProvider
        theme={{
          name: "default-theme",
          overrides: [defaultDarkModeOverride],
        }}
        colorMode={theme === Mode.Dark ? "dark" : "light"}
      >
        <Authenticator
          hideSignUp={true}
          components={{
            SignIn: {
              Header: () => {
                if (config.config.auth_federated_provider) {
                  const signInWithCustomProvider = () => {
                    Auth.federatedSignIn({ customProvider: config.config.auth_federated_provider?.name || "" });
                  };
                  return (
                    <Heading
                      padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                      level={3}
                    >
                      {CHATBOT_NAME}
                      <View as="div" paddingTop="1rem" paddingBottom="1rem">
                      <Button onClick={signInWithCustomProvider} variation="primary">
                        Sign in with {config.config.auth_federated_provider?.name}
                      </Button>
                      </View>
                      <Divider label="OR" />
                    </Heading>
                  );
                }
                else
                {
                  return (
                    <Heading
                      padding={`${tokens.space.xl} 0 0 ${tokens.space.xl}`}
                      level={3}
                    >
                      {CHATBOT_NAME}
                    </Heading>
                  );
                }
              },
            },
          }}
        >
          <App />
        </Authenticator>
      </ThemeProvider>
    </AppContext.Provider>
  );
}
