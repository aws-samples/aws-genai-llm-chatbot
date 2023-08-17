import { useEffect, useState } from 'react';
import { Auth } from 'aws-amplify';
import { useNavigate } from 'react-router-dom';
import { applyMode, applyDensity, Density, Mode } from '@cloudscape-design/global-styles';
import TopNavigation from '@cloudscape-design/components/top-navigation';

applyDensity(Density.Comfortable);

function Topbar() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [isDarkMode, setIsDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const getUser = async () => {
      try {
        const user = await Auth.currentAuthenticatedUser();
        setUser(user);
      } catch (err) {
        console.log(err);
      }
    };

    getUser();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      applyMode(Mode.Dark);
    } else {
      applyMode(Mode.Light);
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Check to see if Media-Queries are supported
    if (window.matchMedia) {
      // Check if the dark-mode Media-Query matches
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        // Dark
        applyMode(Mode.Dark);
      } else {
        // Light
        applyMode(Mode.Light);
      }
    } else {
      // Default (when Media-Queries are not supported)
    }
  }, []);

  return (
    <TopNavigation
      identity={{
        href: '/',
        logo: {
          src: '/logo.png',
          alt: 'AWS GenAI Sample',
        },
      }}
      utilities={[
        {
          type: 'button',
          variant: 'link',
          text: `Home`,
          disableUtilityCollapse: false,
          external: false,
          onClick: () => {
            navigate('/');
          },
        },
        {
          type: 'button',
          variant: 'link',
          text: `Chatbot`,
          disableUtilityCollapse: false,
          external: false,
          onClick: () => {
            navigate('/chatbot');
          },
        },
        {
          type: 'button',
          variant: 'link',
          text: `Files`,
          disableUtilityCollapse: false,
          external: false,
          onClick: () => {
            navigate('/files');
          },
        },
        {
          type: 'button',
          text: 'Github',
          href: 'https://github.com/aws-samples/aws-genai-llm-chatbot',
          external: true,
          externalIconAriaLabel: ' (opens in a new tab)',
        },
        {
          type: 'menu-dropdown',
          description: user ? user.attributes.email : 'Sign in',
          onItemClick: async (item) => {
            console.log(item.detail.id);
            if (item.detail.id === 'signout') {
              await Auth.signOut();
            }
          },
          iconName: 'user-profile',
          items: [{ id: 'signout', text: 'Sign out' }],
        },
        {
          type: 'button',
          iconSvg: !isDarkMode ? (
            <svg width="24" height="24" stroke-width="1.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              {' '}
              <path d="M3 11.5066C3 16.7497 7.25034 21 12.4934 21C16.2209 21 19.4466 18.8518 21 15.7259C12.4934 15.7259 8.27411 11.5066 8.27411 3C5.14821 4.55344 3 7.77915 3 11.5066Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="white"></path>{' '}
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-sun" viewBox="0 0 16 16">
              {' '}
              <path
                d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"
                fill="white"
              ></path>{' '}
            </svg>
          ),
          disableUtilityCollapse: false,
          onClick: () => {
            setIsDarkMode(!isDarkMode);
          },
        },
      ]}
    />
  );
}

export default Topbar;
