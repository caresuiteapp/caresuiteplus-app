import {renderToString} from 'react-dom/server';
import Home from './app/page';
export const render = () => renderToString(<Home/>);
