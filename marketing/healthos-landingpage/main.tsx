import {hydrateRoot} from 'react-dom/client';
import Home from './app/page';
import './app/globals.css';
import './app/expanded.css';
import './app/cinematic.css';
import './app/app-store.css';
hydrateRoot(document.getElementById('root')!, <Home/>);
