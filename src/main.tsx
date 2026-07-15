import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/map.css';
import './styles/panel.css';
import './styles/widgets.css';
import './styles/about-place.css';
import './styles/air-quality.css';
import './styles/climate-profile.css';
import './styles/night-sky.css';
import './styles/outlook-strip.css';
import './styles/practical-info.css';
import './styles/sea-conditions.css';
import './styles/snow-note.css';
import App from './app/App';
import { AppProviders } from './app/providers';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
