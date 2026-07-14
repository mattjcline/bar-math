import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Admin from './Admin';

const isAdminRoute = new URLSearchParams(window.location.search).has('admin');

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    {isAdminRoute ? <Admin /> : <App />}
  </React.StrictMode>
);