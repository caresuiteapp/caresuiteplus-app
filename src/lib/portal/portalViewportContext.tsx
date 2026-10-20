import { createContext, useContext } from 'react';

/** The current portal shell lays out navigation below the content, not over it. */
export const PortalViewportContext = createContext({ footerInFlow: false });
export const usePortalViewport = () => useContext(PortalViewportContext);
