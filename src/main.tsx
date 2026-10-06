import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from '@/app/router';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { firebaseEnv } from '@/config/env';
import '@/styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('[bootstrap] #root element not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      {/*
        Provider order matters:
          Auth  — everything may need the current user
          Cart  — the header and cart badge need it, and it persists to storage
      */}
      <AuthProvider>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// Surface the resolved config in dev so a misconfigured project is obvious.
if (import.meta.env.DEV) {
  console.info(
    `[foodhut] project=${firebaseEnv.projectId} mode=${import.meta.env.MODE} auth=${firebaseEnv.authDomain}`,
  );
}
