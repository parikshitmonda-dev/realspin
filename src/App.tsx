import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { HomePage } from './pages/HomePage';
import { CoinRequestModal } from './wallet/CoinRequestModal';

function AppContent() {
  const { user } = useAuth();
  const [showAddCoinsRoute, setShowAddCoinsRoute] = useState(false);

  useEffect(() => {
    // Listen to hash or pathname for /add-coins
    const checkPath = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.includes('/add-coins') || hash.includes('/add-coins') || hash.includes('#add-coins')) {
        setShowAddCoinsRoute(true);
      } else {
        setShowAddCoinsRoute(false);
      }
    };

    checkPath();
    window.addEventListener('popstate', checkPath);
    window.addEventListener('hashchange', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
      window.removeEventListener('hashchange', checkPath);
    };
  }, []);

  return (
    <>
      <HomePage />
      {showAddCoinsRoute && (
        <CoinRequestModal
          user={user}
          onClose={() => {
            setShowAddCoinsRoute(false);
            window.history.pushState({}, '', '/');
          }}
          onOpenLogin={() => {
            setShowAddCoinsRoute(false);
            window.history.pushState({}, '', '/');
          }}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
