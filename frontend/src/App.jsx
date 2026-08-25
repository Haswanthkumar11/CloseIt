/**
 * App.jsx
 * Main Application Layout & State Orchestrator for CloseIt.
 * Handles category/product selection, routing (/outcomes), exit-intent, and ChatWidget cart context.
 */

import React, { useState, useEffect } from 'react';
import { Storefront } from './components/Storefront';
import { ChatWidget } from './components/ChatWidget';
import { OutcomesLog } from './components/OutcomesLog';
import { useExitIntent } from './hooks/useExitIntent';
import { Zap, BarChart2, ShoppingBag } from 'lucide-react';
import { API_BASE } from './config';

export function App() {
  // Sync tab with URL hash/pathname for direct navigation (e.g. /outcomes or #outcomes)
  const getInitialTab = () => {
    if (window.location.pathname === '/outcomes' || window.location.hash === '#outcomes') {
      return 'outcomes';
    }
    return 'storefront';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sessionId, setSessionId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Listen for hash / popstate changes for routing
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.pathname === '/outcomes' || window.location.hash === '#outcomes') {
        setActiveTab('outcomes');
      } else {
        setActiveTab('storefront');
      }
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const switchTab = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab === 'outcomes' ? 'outcomes' : 'storefront';
  };

  // Start fresh checkout session for the selected product
  const startProductSession = async (product) => {
    if (!product) return;
    try {
      const res = await fetch(`${API_BASE}/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: product.name,
          price: product.price,
          quantity: 1
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
      }
    } catch (err) {
      console.error('Error starting session:', err);
      setSessionId(`sess_${Math.random().toString(36).substring(2, 10)}`);
    }
  };

  // Initialize session on product change
  useEffect(() => {
    if (selectedProduct) {
      startProductSession(selectedProduct);
    }
  }, [selectedProduct]);

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
  };

  // Initialize Exit Intent hook
  const { hesitationScore, isChatTriggered, resetChatTrigger, manuallyTriggerChat } = useExitIntent(activeTab === 'storefront');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Sync auto-triggered exit-intent with chat open state
  useEffect(() => {
    if (isChatTriggered) {
      setIsChatOpen(true);
    }
  }, [isChatTriggered]);

  const handleProceedToCheckout = (product, qty, total) => {
    if (product) setSelectedProduct(product);
    setIsChatOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Header */}
      <header className="app-header">
        <div className="brand-title" style={{ cursor: 'pointer' }} onClick={() => switchTab('storefront')}>
          <Zap size={24} color="#6366f1" />
          <span>CloseIt AI <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Checkout Rescue</span></span>
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-button ${activeTab === 'storefront' ? 'active' : ''}`}
            onClick={() => switchTab('storefront')}
          >
            <ShoppingBag size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Demo Storefront
          </button>
          <button
            className={`nav-button ${activeTab === 'outcomes' ? 'active' : ''}`}
            onClick={() => switchTab('outcomes')}
          >
            <BarChart2 size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Outcomes Log (/outcomes)
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-container" style={{ flex: 1 }}>
        {activeTab === 'storefront' ? (
          <Storefront
            selectedProduct={selectedProduct}
            onSelectProduct={handleSelectProduct}
            onProceedToCheckout={handleProceedToCheckout}
            hesitationScore={hesitationScore}
            onManualTriggerChat={() => setIsChatOpen(true)}
            onNavigateToOutcomes={() => switchTab('outcomes')}
          />
        ) : (
          <OutcomesLog />
        )}
      </main>

      {/* Rescue Floating Chat Widget */}
      <ChatWidget
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          resetChatTrigger();
        }}
        sessionId={sessionId}
        cartItem={selectedProduct ? selectedProduct.name : ''}
        cartPrice={selectedProduct ? selectedProduct.price : 0}
        onOutcomeLogged={() => {
          // Callback if needed
        }}
      />
    </div>
  );
}

export default App;
