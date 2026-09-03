/**
 * SubscriptionDemo.jsx — Smart Recharge Marketplace Surface
 * Modern, responsive recharge plan catalog with category tabs, search & filters,
 * plan selection drawer, and hesitation-triggered CloseIt rescue assistant.
 */

import React, { useState, useEffect } from 'react';
import { Search, Filter, Zap, Check, Tv, ShieldCheck, Sparkles, ArrowRight, X } from 'lucide-react';
import { API_BASE } from '../config';

export function SubscriptionDemo({ onPlanSelectedForRescue, onPlanSelect }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [only5G, setOnly5G] = useState(false);
  const [onlyOTT, setOnlyOTT] = useState(false);
  const [maxPrice, setMaxPrice] = useState(3000);
  
  // Selected plan confirmation state
  const [pendingPlan, setPendingPlan] = useState(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const DEFAULT_FALLBACK_PLANS = [
    {
      id: "plan_219",
      name: "Super Saver Data & Voice",
      price: 219.0,
      currency: "INR",
      validity_days: 30,
      data_per_day: "1GB",
      total_data: "30GB",
      network: "4G / LTE",
      ott_benefits: [],
      category: "budget",
      badge: "Value Pack",
      active: true
    },
    {
      id: "plan_299",
      name: "Standard Daily Data Pack",
      price: 299.0,
      currency: "INR",
      validity_days: 28,
      data_per_day: "1.5GB",
      total_data: "42GB",
      network: "Unlimited 5G",
      ott_benefits: [],
      category: "popular",
      badge: "Popular",
      active: true
    },
    {
      id: "plan_349",
      name: "5G Plus & Streaming Pack",
      price: 349.0,
      currency: "INR",
      validity_days: 28,
      data_per_day: "2GB",
      total_data: "56GB",
      network: "Unlimited 5G",
      ott_benefits: ["JioHotstar Mobile (3 Months)"],
      category: "popular",
      badge: "Best Seller",
      active: true
    },
    {
      id: "plan_399",
      name: "Double Validity 5G Max",
      price: 399.0,
      currency: "INR",
      validity_days: 56,
      data_per_day: "2GB",
      total_data: "112GB",
      network: "Unlimited 5G",
      ott_benefits: ["JioHotstar Mobile (3 Months)", "SonyLIV"],
      category: "long_validity",
      badge: "Double Validity",
      active: true
    },
    {
      id: "plan_499",
      name: "Entertainment Super Bundle",
      price: 499.0,
      currency: "INR",
      validity_days: 28,
      data_per_day: "3GB",
      total_data: "84GB",
      network: "Unlimited 5G",
      ott_benefits: ["JioHotstar Mobile", "Prime Video Mobile", "SonyLIV"],
      category: "ott",
      badge: "OTT Bundle",
      active: true
    },
    {
      id: "plan_719",
      name: "Quarterly Freedom Pack",
      price: 719.0,
      currency: "INR",
      validity_days: 84,
      data_per_day: "1.5GB",
      total_data: "126GB",
      network: "Unlimited 5G",
      ott_benefits: [],
      category: "long_validity",
      badge: "84 Days Pack",
      active: true
    }
  ];

  const fetchPlans = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const res = await fetch(`${API_BASE}/subscription/plans`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const loaded = (data.plans && data.plans.length > 0) ? data.plans : DEFAULT_FALLBACK_PLANS;
        setPlans(loaded);
      } else {
        setPlans(DEFAULT_FALLBACK_PLANS);
      }
    } catch (err) {
      console.warn('Using default fallback recharge plans due to API timeout or error:', err);
      setPlans(DEFAULT_FALLBACK_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: 'popular', label: '🔥 Popular' },
    { id: '5g', label: '⚡ Unlimited 5G' },
    { id: 'ott', label: '🎬 OTT Bundles' },
    { id: 'long_validity', label: '📅 Long Validity' },
    { id: 'budget', label: '💰 Budget Packs' },
    { id: 'data', label: '📶 Data Boosters' },
  ];

  // Filter plans based on search, category, and toggles
  const filteredPlans = plans.filter((plan) => {
    if (selectedCategory && selectedCategory !== 'popular' && plan.category !== selectedCategory) {
      // If category is set, match category (popular shows all top plans)
      if (selectedCategory === '5g' && plan.network !== 'Unlimited 5G') return false;
      if (selectedCategory === 'ott' && (!plan.ott_benefits || plan.ott_benefits.length === 0)) return false;
      if (selectedCategory === 'long_validity' && plan.validity_days < 50) return false;
      if (selectedCategory === 'budget' && plan.price > 300) return false;
      if (selectedCategory === 'data' && plan.category !== 'data') return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = plan.name.toLowerCase().includes(q);
      const matchData = plan.data_per_day.toLowerCase().includes(q);
      const matchValidity = `${plan.validity_days}`.includes(q);
      if (!matchName && !matchData && !matchValidity) return false;
    }

    if (only5G && plan.network !== 'Unlimited 5G') return false;
    if (onlyOTT && (!plan.ott_benefits || plan.ott_benefits.length === 0)) return false;
    if (plan.price > maxPrice) return false;

    return true;
  });

  const handleSelectPlanClick = (plan) => {
    setPendingPlan(plan);
    if (onPlanSelect) {
      onPlanSelect(plan);
    }
  };

  const handleProceedToPayment = async (plan) => {
    if (!plan) return;
    setPendingPlan(null);
    try {
      const res = await fetch(`${API_BASE}/subscription/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: 'sub_direct_payment',
          selected_plan_id: plan.id,
          user_message: 'Send me payment link for this recharge plan',
          current_discount: 0
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.payment_link) {
          window.location.href = data.payment_link;
        }
      }
    } catch (e) {
      console.error('Error generating payment link:', e);
    }
  };

  const handleHesitateAndRescue = (plan) => {
    setPendingPlan(null);
    if (onPlanSelect) {
      onPlanSelect(plan);
    }
    if (onPlanSelectedForRescue) {
      onPlanSelectedForRescue(plan);
    }
  };

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%)',
        borderRadius: '24px',
        padding: '2rem 2.5rem',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <Sparkles size={14} /> Smart Recharge Negotiation Surface
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0' }}>
            Smart Recharge & Plan Finder
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '600px' }}>
            Browse best-value mobile recharge plans. CloseIt automatically catches plan hesitation and negotiates superior validity, data, and value alternatives.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '30px',
              border: selectedCategory === cat.id ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
              background: selectedCategory === cat.id ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'rgba(30, 41, 59, 0.6)',
              color: '#fff',
              fontWeight: selectedCategory === cat.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.7)',
        padding: '1.25rem',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.25rem'
      }}>
        <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search plans (e.g. 5G, 2GB, 56 Days)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.9rem'
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={only5G}
            onChange={(e) => setOnly5G(e.target.checked)}
            style={{ accentColor: '#6366f1', width: 16, height: 16 }}
          />
          ⚡ Unlimited 5G Only
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyOTT}
            onChange={(e) => setOnlyOTT(e.target.checked)}
            style={{ accentColor: '#6366f1', width: 16, height: 16 }}
          />
          🎬 Includes OTT
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <span>Max Price: <strong style={{ color: '#34d399' }}>₹{maxPrice}</strong></span>
          <input
            type="range"
            min="150"
            max="3000"
            step="50"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            style={{ accentColor: '#6366f1', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Plan Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading recharge catalog...</div>
      ) : filteredPlans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px' }}>
          No recharge plans found matching your filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredPlans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                transition: 'transform 0.2s ease, border-color 0.2s ease',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  right: '20px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {plan.badge}
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {plan.network}
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: '0 0 1rem 0' }}>
                  {plan.name}
                </h3>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff' }}>₹{plan.price}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/ {plan.validity_days} Days</span>
                </div>

                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '12px',
                  padding: '0.85rem',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.85rem'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Daily Data</div>
                    <div style={{ fontWeight: 700, color: '#60a5fa' }}>{plan.data_per_day}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Validity</div>
                    <div style={{ fontWeight: 700, color: '#34d399' }}>{plan.validity_days} Days</div>
                  </div>
                </div>

                {plan.ott_benefits && plan.ott_benefits.length > 0 && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Tv size={12} /> Included Subscriptions:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {plan.ott_benefits.map((ott, i) => (
                        <span key={i} style={{
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(99, 102, 241, 0.3)'
                        }}>
                          {ott}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleSelectPlanClick(plan)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'opacity 0.2s ease'
                }}
              >
                Select Plan <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected Plan Confirmation Modal */}
      {pendingPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <button
              onClick={() => setPendingPlan(null)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                <Zap size={24} color="#6366f1" />
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: '0 0 0.4rem 0' }}>Review Plan Selection</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>You are about to recharge with this plan.</p>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.8)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem' }}>{pendingPlan.name}</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>₹{pendingPlan.price}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem' }}>
                <span>Validity: <strong style={{ color: '#fff' }}>{pendingPlan.validity_days} Days</strong></span>
                <span>Data: <strong style={{ color: '#fff' }}>{pendingPlan.data_per_day}</strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleProceedToPayment(pendingPlan)}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Proceed to Payment (₹{pendingPlan.price})
              </button>

              <button
                onClick={() => handleHesitateAndRescue(pendingPlan)}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(30, 41, 59, 0.9)',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <Sparkles size={16} color="#818cf8" /> Maybe Later / Find Better Options
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
