import { Auth } from 'aws-amplify';
import { useEffect, useState } from 'react';

function LinksPanel() {
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    (async () => setUserInfo(await Auth.currentUserInfo()))();
  }, []);

  const onSignOutClick = async (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    event.preventDefault();
    await Auth.signOut();
  };

  return (
    <div className="text-xs text-right bg-gray-200 dark:bg-gray-800">
      <span className="text-gray-700 dark:text-white">{userInfo ? <>{userInfo?.attributes?.email}</> : <>&nbsp;</>}</span>
      <br />
      <a href="/" className="text-gray-700 hover:text-gray-950 dark:text-white dark:hover:text-gray-200  focus:outline-gray-300 dark:focus:outline " onClick={onSignOutClick}>
        Sign out
      </a>
    </div>
  );
}

export default LinksPanel;
