import { useEffect } from 'react';
import Welcome from '../components/home/Welcome';

export function Home({ setTools }) {
  useEffect(() => {
    setTools(null);
  }, [setTools]);

  return <Welcome />;
}
export default Home;
