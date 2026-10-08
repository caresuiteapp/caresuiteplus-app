import * as sdk from './maplibre-gl.mjs';
sdk.setWorkerUrl(new URL('./maplibre-gl-worker.mjs', import.meta.url).href);
window.careSuiteMapLibre = sdk;
