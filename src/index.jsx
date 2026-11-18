import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import './css/mobile.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { installFetchTracing } from './utils/tracing';
import { installSessionRefresh } from './services/session';
import { applySiteToDocument } from './site';

// Tracing first, so the session wrapper sits outside it and a resent request gets its own id.
installFetchTracing();
installSessionRefresh();
// fitznet.org or lori.fitznet.org: picks the colour tokens, title and icons before first paint.
applySiteToDocument();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
