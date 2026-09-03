import React, { useState, useEffect } from 'react';
import { Storefront } from './components/Storefront';
import { ChatWidget } from './components/ChatWidget';
import { OutcomesLog } from './components/OutcomesLog';
import { SubscriptionDemo } from './components/SubscriptionDemo';
import { MyPayments } from './components/MyPayments';
import { Zap, BarChart2, ShoppingBag, Smartphone, CreditCard } from 'lucide-react';
import { API_BASE } from './config';

export function App() {
  // Sync tab with URL hash/pathname for direct navigation (e.g. /outcomes, #recharge, #payments)
  const getInitialTab = () => {
    if (window.location.pathname === '/outcomes' || window.location.hash === '#outcomes') {
      return 'outcomes';
    }
    if (window.location.pathname === '/recharge' || window.location.hash === '#recharge') {
      return 'recharge';
    }
    if (window.location.pathname === '/payments' || window.location.hash === '#payments' || window.location.hash === '#invoice') {
      return 'payments';
    }
    return 'storefront';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [sessionId, setSessionId] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedRechargePlan, setSelectedRechargePlan] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [initialInvoiceMessage, setInitialInvoiceMessage] = useState(null);
  const [chatContextType, setChatContextType] = useState('checkout');

  // Listen for activeTab changes to sync chatContextType
  useEffect(() => {
    if (activeTab === 'recharge') {
      setChatContextType('subscription');
    } else if (activeTab === 'payments' || activeTab === 'invoice') {
      setChatContextType('invoice');
    } else if (activeTab === 'storefront') {
      setChatContextType('checkout');
    }
  }, [activeTab]);

  // Listen for hash / popstate changes for routing
  useEffect(() => {
    const handleLocationChange = () => {
      if (window.location.pathname === '/outcomes' || window.location.hash === '#outcomes') {
        setActiveTab('outcomes');
        setChatContextType('checkout');
      } else if (window.location.pathname === '/recharge' || window.location.hash === '#recharge') {
        setActiveTab('recharge');
        setChatContextType('subscription');
      } else if (window.location.pathname === '/payments' || window.location.hash === '#payments' || window.location.hash === '#invoice') {
        setActiveTab('payments');
        setChatContextType('invoice');
      } else {
        setActiveTab('storefront');
        setChatContextType('checkout');
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
    window.location.hash = tab;
    setInitialInvoiceMessage(null);
    if (tab === 'recharge') {
      setChatContextType('subscription');
      setSelectedRechargePlan(null);
    } else if (tab === 'payments' || tab === 'invoice') {
      setChatContextType('payments');
      setSelectedInvoice(null);
    } else if (tab === 'storefront') {
      setChatContextType('checkout');
      setSelectedProduct(null);
    }
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

  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleProceedToCheckout = (product, qty, total) => {
    if (product) setSelectedProduct(product);
    setChatContextType('checkout');
    setIsChatOpen(true);
  };

  const handlePlanSelectedForRescue = (plan) => {
    setSelectedRechargePlan(plan);
    setChatContextType('subscription');
    setIsChatOpen(true);
  };

  const handleInvoiceSelectedForRescue = (invoice, initialMsg = null) => {
    setSelectedInvoice(invoice);
    setInitialInvoiceMessage(initialMsg);
    setChatContextType('invoice');
    setIsChatOpen(true);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Header */}
      <header className="app-header">
        <div className="brand-title" style={{ cursor: 'pointer' }} onClick={() => switchTab('storefront')}>
          <Zap size={24} color="#6366f1" />
          <span>CloseIt AI <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>Multi-Context Payment Assistant</span></span>
        </div>

        <div className="nav-tabs">
          <button
            className={`nav-button ${activeTab === 'storefront' ? 'active' : ''}`}
            onClick={() => switchTab('storefront')}
          >
            <ShoppingBag size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            🛍️ Shop <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '0.2rem' }}>(Checkout Assistant)</span>
          </button>
          <button
            className={`nav-button ${activeTab === 'recharge' ? 'active' : ''}`}
            onClick={() => switchTab('recharge')}
          >
            <Smartphone size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            📱 Recharge <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '0.2rem' }}>(Plan Assistant)</span>
          </button>
          <button
            className={`nav-button ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => switchTab('payments')}
          >
            <CreditCard size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            💳 My Payments <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '0.2rem' }}>(Payment Assistant)</span>
          </button>
          <button
            className={`nav-button ${activeTab === 'outcomes' ? 'active' : ''}`}
            onClick={() => switchTab('outcomes')}
          >
            <BarChart2 size={16} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />
            Outcomes Log
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-container" style={{ flex: 1 }}>
        {activeTab === 'storefront' && (
          <Storefront
            selectedProduct={selectedProduct}
            onSelectProduct={handleSelectProduct}
            onProceedToCheckout={handleProceedToCheckout}
            onNavigateToOutcomes={() => switchTab('outcomes')}
            onNavigateToPayments={() => switchTab('payments')}
          />
        )}
        {activeTab === 'recharge' && (
          <SubscriptionDemo
            onPlanSelectedForRescue={handlePlanSelectedForRescue}
            onPlanSelect={(plan) => {
              setSelectedRechargePlan(plan);
              setChatContextType('subscription');
            }}
          />
        )}
        {activeTab === 'payments' && (
          <MyPayments
            onInvoiceSelectedForRescue={handleInvoiceSelectedForRescue}
          />
        )}
        {activeTab === 'outcomes' && (
          <OutcomesLog />
        )}
      </main>

      {/* Rescue Floating Chat Widget */}
      <ChatWidget
        isOpen={isChatOpen}
        onOpen={() => setIsChatOpen(true)}
        onClose={() => setIsChatOpen(false)}
        sessionId={sessionId}
        cartItem={selectedProduct ? selectedProduct.name : ''}
        cartPrice={selectedProduct ? selectedProduct.price : 0}
        contextType={chatContextType}
        selectedPlan={selectedRechargePlan}
        selectedInvoice={selectedInvoice}
        initialUserMessage={initialInvoiceMessage}
        onOutcomeLogged={() => {
          // Callback if needed
        }}
      />
    </div>
  );
}

export default App;
