/**
 * Storefront.jsx
 * Multi-category demo storefront fetching products from MongoDB Atlas (GET /products).
 * Implements smooth auto-scroll to the active checkout panel upon product selection.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Truck, RotateCcw, Star, Zap, CreditCard, ArrowRight, BarChart2, Check, Loader2 } from 'lucide-react';
import { API_BASE } from '../config';

export function Storefront({
  selectedProduct,
  onSelectProduct,
  onProceedToCheckout,
  hesitationScore,
  onManualTriggerChat,
  onNavigateToOutcomes
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [quantity, setQuantity] = useState(1);

  // FIX 1: Ref for scrolling revealed checkout panel into view
  const activeDetailRef = useRef(null);

  // Fetch product catalog from MongoDB backend API
  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
          if (data.products && data.products.length > 0 && !selectedProduct) {
            onSelectProduct(data.products[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching products from API:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const categories = ['All', 'Electronics', 'Fashion', 'Groceries'];

  const filteredProducts = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory);

  const activeProduct = selectedProduct || (products.length > 0 ? products[0] : null);
  const totalPrice = activeProduct ? activeProduct.price * quantity : 0;

  const handleProductCardClick = (prod) => {
    onSelectProduct(prod);
    setQuantity(1);
    // FIX 1: Automatically scroll revealed checkout section into view
    setTimeout(() => {
      activeDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      {/* Interactive Exit Intent Status & Navigation Bar */}
      <div className="intent-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={18} color="#818cf8" />
          <span style={{ fontWeight: 600 }}>Exit-Intent Hesitation Monitor:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>Current Hesitation Score: <strong className="score-badge">{hesitationScore} / 3</strong></span>
          <button
            onClick={onManualTriggerChat}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            ⚡ Test Trigger Chat
          </button>
          <button
            onClick={onNavigateToOutcomes}
            style={{
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#818cf8',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
          >
            <BarChart2 size={14} />
            View Outcomes Log (/outcomes)
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        marginBottom: '2rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid var(--border-color)'
      }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              background: activeCategory === cat ? 'var(--primary-accent)' : 'rgba(255,255,255,0.05)',
              color: activeCategory === cat ? '#fff' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: activeCategory === cat ? 'var(--primary-accent)' : 'var(--border-color)',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {cat === 'Electronics' && '⚡ '}
            {cat === 'Fashion' && '👟 '}
            {cat === 'Groceries' && '🛒 '}
            {cat}
          </button>
        ))}
      </div>

      {/* Catalog Grid with Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="spin" style={{ marginBottom: '1rem' }} />
          <p>Fetching MongoDB product catalog...</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {filteredProducts.map((prod) => {
            const isSelected = activeProduct && activeProduct.id === prod.id;
            return (
              <div
                key={prod.id}
                className="glass-panel"
                onClick={() => handleProductCardClick(prod)}
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary-accent)' : '1px solid var(--border-color)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'var(--primary-accent)',
                    color: '#fff',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem'
                  }}>
                    <Check size={12} /> Selected Item
                  </div>
                )}

                <div>
                  <div style={{
                    fontSize: '3.5rem',
                    textAlign: 'center',
                    padding: '1rem 0',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    marginBottom: '1rem'
                  }}>
                    {prod.icon}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 600, textTransform: 'uppercase' }}>
                    {prod.category}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.25rem 0 0.5rem 0', lineHeight: '1.3' }}>
                    {prod.name}
                  </h3>

                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', height: '40px', overflow: 'hidden' }}>
                    {prod.description}
                  </p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>₹{prod.price.toLocaleString('en-IN')}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem', color: '#f59e0b' }}>
                      <Star size={14} fill="#f59e0b" /> {prod.rating}
                    </div>
                  </div>

                  <button
                    className={isSelected ? 'btn-primary' : 'nav-button'}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductCardClick(prod);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.55rem',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      border: isSelected ? 'none' : '1px solid var(--border-color)',
                      background: isSelected ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    {isSelected ? '✓ Selected in Cart' : 'Select Product'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FIX 1: Active Product Detailed Checkout Panel with scrollRef */}
      {activeProduct && (
        <div
          ref={activeDetailRef}
          className="glass-panel"
          style={{ padding: '2.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}
        >
          {/* Visual Showcase */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(236,72,153,0.2) 100%)',
              borderRadius: '16px',
              height: '320px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '5.5rem', marginBottom: '0.75rem' }}>{activeProduct.icon}</div>
                <span style={{
                  background: 'rgba(0,0,0,0.5)',
                  color: '#10b981',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid rgba(16,185,129,0.3)'
                }}>
                  ● In Stock & Ready to Ship
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <Truck size={18} color="#6366f1" style={{ marginBottom: '0.2rem' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>Free Delivery</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <RotateCcw size={18} color="#a855f7" style={{ marginBottom: '0.2rem' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>7-Day Returns</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
                <ShieldCheck size={18} color="#ec4899" style={{ marginBottom: '0.2rem' }} />
                <div style={{ fontSize: '0.72rem', fontWeight: 600 }}>1-Year Warranty</div>
              </div>
            </div>
          </div>

          {/* Details & Cart Context Action */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                Active Checkout Selection ({activeProduct.category})
              </div>
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.35rem 0 0.75rem 0', lineHeight: '1.2' }}>
                {activeProduct.name}
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', color: '#f59e0b' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="#f59e0b" />)}
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{activeProduct.rating}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({activeProduct.reviews} reviews)</span>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                {activeProduct.description}
              </p>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Quantity</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}>-</button>
                    <span style={{ fontWeight: 700 }}>{quantity}</span>
                    <button onClick={() => setQuantity(quantity + 1)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}>+</button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Cart Total:</span>
                  <div>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc' }}>
                      ₹{totalPrice.toLocaleString('en-IN')}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>incl. taxes</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="btn-primary"
                style={{ width: '100%', padding: '1rem', fontSize: '1.05rem' }}
                onClick={() => onProceedToCheckout(activeProduct, quantity, totalPrice)}
              >
                <CreditCard size={18} />
                Proceed to Checkout with {activeProduct.name.split(' ')[0]}
                <ArrowRight size={18} />
              </button>
              <div style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                🔒 256-Bit SSL Encrypted Razorpay Checkout
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
