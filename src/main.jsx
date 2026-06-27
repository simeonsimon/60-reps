import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { StoreProvider } from './store/StoreProvider.jsx'
import { SkinProvider } from './context/SkinContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <SkinProvider>
        <App />
      </SkinProvider>
    </StoreProvider>
  </React.StrictMode>,
)
