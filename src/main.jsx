import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import './styles/base.css';
import './styles/window.css';
import './styles/shell.css';
import './styles/screens.css';
import './styles/apps.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

// Absolute URL: relative url() inside a custom property would resolve against the stylesheet's folder.
const logonBg = new URL(`${import.meta.env.BASE_URL}wallpapers/harmony.svg`, window.location.href).href;
document.documentElement.style.setProperty('--logon-bg', `url("${logonBg}")`);
