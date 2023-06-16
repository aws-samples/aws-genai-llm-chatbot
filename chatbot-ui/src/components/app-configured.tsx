import { useEffect, useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { Amplify } from 'aws-amplify';
import { AppConfig } from '../common/types';
import { AppContext } from '../common/app-context';
import App from '../app';
import Ellipsis from './ellipsis';
import '@aws-amplify/ui-react/styles.css';

function AppConfigured() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await fetch('/aws-exports.json');
        const awsExports = await result.json();
        const currentConfig: any = Amplify.configure(awsExports);
        setConfig(currentConfig);
      } catch (e) {
        console.error(e);
        setError(true);
      }
    })();
  }, []);

  if (!config) {
    if (error) {
      return (
        <div className="h-full w-full flex justify-center items-center">
          Error loading configuration from "
          <a href="/aws-exports.json" className="font-semibold">
            /aws-exports.json
          </a>
          "
        </div>
      );
    }

    return (
      <div className="h-full w-full text-4xl flex justify-center items-center">
        <Ellipsis />
      </div>
    );
  }

  return (
    <AppContext.Provider value={config}>
      <Authenticator hideSignUp={true}>
        <App />
      </Authenticator>
    </AppContext.Provider>
  );
}

export default AppConfigured;
