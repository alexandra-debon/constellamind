import type { PremiumFeature } from './account';
import { Onboarding } from './components/Onboarding';
import { AccountPage, ConstellationsPage, PremiumPage } from './pages/Account';
import { SyncAgent } from './sync';
import { isValidAddress, isStar } from './model';
import ActionsBoard from './pages/Actions';
import Core from './pages/Core';
import { OrbitPage, SatellitePage, StarPage } from './pages/Idea';
import { Matrix, Method, Nebula, Notes, Register } from './pages/Others';
import { useRoute } from './store';

export default function App() {
  return (
    <>
      <Screen />
      <Onboarding />
      <SyncAgent />
    </>
  );
}

function Screen() {
  const [page = '', param = ''] = useRoute();

  switch (page) {
    case 'etoile':
      if (isValidAddress(param) && isStar(param)) return <StarPage key={param} s={+param} />;
      break;
    case 'satellite':
      if (isValidAddress(param) && !isStar(param)) return <SatellitePage key={param} addr={param} />;
      break;
    case 'orbite':
      if (isValidAddress(param) && isStar(param)) return <OrbitPage key={param} s={+param} />;
      break;
    case 'nebuleuse':
      return <Nebula />;
    case 'passerelles':
      return <Register />;
    case 'matrice':
      return <Matrix />;
    case 'actions':
      return <ActionsBoard />;
    case 'notes':
      return <Notes />;
    case 'methode':
      return <Method />;
    case 'premium':
      return <PremiumPage key={param} reason={(param || undefined) as PremiumFeature | undefined} />;
    case 'compte':
      return <AccountPage />;
    case 'constellations':
      return <ConstellationsPage />;
  }
  return <Core />;
}
