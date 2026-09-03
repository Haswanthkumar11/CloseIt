/**
 * ChatWidget.jsx
 * Floating AI checkout-rescue assistant chat interface.
 * Discards stale chat history when active product changes and generates a fresh session turn reflecting the active item.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, ExternalLink, Sparkles, Tag, CreditCard, CheckCircle2, ShoppingBag } from 'lucide-react';
import { API_BASE } from '../config';

export function ChatWidget({
  isOpen,
  onOpen,
  onClose,
  sessionId,
  cartItem,
  cartPrice,
  contextType = 'checkout',
  selectedPlan = null,
  selectedInvoice = null,
  initialUserMessage = null,
  onOutcomeLogged
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [lastObjectionType, setLastObjectionType] = useState('price');
  const [lastResolution, setLastResolution] = useState('Offered discount');
  const [recommendations, setRecommendations] = useState([]);
  const [activePlan, setActivePlan] = useState(selectedPlan);

  const messagesEndRef = useRef(null);

  const defaultPlanFallback = {
    id: 'plan_299',
    name: 'Standard Daily Data Pack',
    price: 299,
    validity_days: 28,
    data_per_day: '1.5GB'
  };

  const defaultInvoiceFallback = {
    id: 'inv_001',
    client_name: 'Acme Technologies',
    amount: 12500,
    description: 'Website Development - August'
  };

  const effectivePlan = contextType === 'subscription' ? selectedPlan : null;
  const effectiveInvoice = (contextType === 'invoice' || contextType === 'payments') ? selectedInvoice : null;

  const currentSelectedItem = contextType === 'subscription'
    ? selectedPlan
    : (contextType === 'invoice' || contextType === 'payments')
    ? selectedInvoice
    : (cartItem ? { name: cartItem, price: cartPrice } : null);

  // Requirement: Wait for customer to browse. 
  // After 2.5s hesitation / inactivity AFTER an item is selected by customer, auto-open the AI Agent.
  useEffect(() => {
    if (!isOpen && currentSelectedItem) {
      const timer = setTimeout(() => {
        if (onOpen) onOpen();
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOpen, currentSelectedItem, onOpen]);

  // Clean context-isolated initial state generator
  useEffect(() => {
    let isCancelled = false;

    if (contextType === 'subscription') {
      if (selectedPlan) {
        setActivePlan(selectedPlan);
        setCurrentDiscount(0);

        const fetchRecs = async () => {
          try {
            const res = await fetch(`${API_BASE}/subscription/recommendations/${selectedPlan.id}`);
            if (isCancelled) return;
            if (res.ok) {
              const data = await res.json();
              const recs = data.recommendations || [];
              setRecommendations(recs);
              setMessages([
                {
                  role: 'assistant',
                  content: `Hey! I noticed you selected the ₹${selectedPlan.price} plan (${selectedPlan.name}).\nI'm your AI Recharge Assistant! Before you proceed, here are top recommendations and exclusive discount options:`,
                  recommendations: recs,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            } else {
              setMessages([
                {
                  role: 'assistant',
                  content: `Hey! I noticed you selected the ₹${selectedPlan.price} plan (${selectedPlan.name}). Ask me for exclusive discounts, OTT bundles, or validity upgrades!`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }
              ]);
            }
          } catch (err) {
            if (isCancelled) return;
            console.error('Error fetching subscription recommendations:', err);
            setMessages([
              {
                role: 'assistant',
                content: `Hey! I noticed you selected the ₹${selectedPlan.price} plan (${selectedPlan.name}). Ask me for exclusive discounts, OTT bundles, or validity upgrades!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]);
          }
        };

        fetchRecs();
      } else {
        setMessages([
          {
            role: 'assistant',
            content: `Welcome to Smart Recharge! Browse the available plans above and select any recharge pack to get instant recommendations or exclusive discount options!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }

    } else if (contextType === 'invoice' || contextType === 'payments') {
      if (selectedInvoice) {
        setCurrentDiscount(0);
        const planTitle = selectedInvoice.product_name || selectedInvoice.description || 'Credit Purchase Plan';
        const planAmount = selectedInvoice.installment_amount || selectedInvoice.amount || 1166.33;
        const greetingMsg = {
          role: 'assistant',
          content: `Hello! I am CloseIt, your personal payment advisor for ${planTitle}.\nRegarding your upcoming installment of ₹${(planAmount || 0).toLocaleString('en-IN')}, I can help adjust payment dates, structure partial downpayments, or answer any questions about your plan!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        if (initialUserMessage) {
          setMessages([greetingMsg]);
          const timer = setTimeout(() => {
            if (!isCancelled) handleSendMessage(null, initialUserMessage);
          }, 300);
          return () => clearTimeout(timer);
        } else {
          setMessages([greetingMsg]);
        }
      } else {
        setMessages([
          {
            role: 'assistant',
            content: `Welcome to Customer Payments! Select any of your active purchases or upcoming installments below to adjust payment schedules or request extensions.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }

    } else {
      // Context: 'checkout' (Shop page)
      if (cartItem) {
        setCurrentDiscount(0);
        setMessages([
          {
            role: 'assistant',
            content: `Hey! I noticed you selected the ${cartItem} (₹${(cartPrice || 0).toLocaleString('en-IN')}). I'm your AI Checkout Assistant! Is there anything holding you back from ordering? Ask me for exclusive discounts or 3-month payment plan options!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: `Welcome to CloseIt Store! Browse our products above and select any item to view details, request instant discounts, or check EMI/UPI payment options!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [contextType, selectedPlan?.id, selectedInvoice?.id, cartItem, cartPrice, initialUserMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (!isOpen) {
    return (
      <div className="chat-launcher-container" onClick={onOpen}>
        <div className="chat-launcher-badge">
          <Sparkles size={16} color="#818cf8" />
          <span>Need any help?</span>
        </div>
        <div className="chat-launcher-btn">
          <Bot size={28} color="#fff" />
          <span className="chat-launcher-dot"></span>
        </div>
      </div>
    );
  }

  const currentPrice = contextType === 'subscription'
    ? (selectedPlan ? selectedPlan.price : 0)
    : contextType === 'invoice'
    ? (selectedInvoice ? selectedInvoice.amount : 0)
    : (cartPrice || 0);

  const currentTitle = contextType === 'subscription'
    ? (selectedPlan ? selectedPlan.name : 'No Plan Selected')
    : contextType === 'invoice'
    ? (selectedInvoice ? `${selectedInvoice.description} (${selectedInvoice.client_name})` : 'No Invoice Selected')
    : (cartItem || 'No Product Selected');

  const effectivePrice = currentPrice ? currentPrice * (1 - currentDiscount / 100) : 0;
  const isContextActive = Boolean(currentSelectedItem);

  const handleSendMessage = async (e, textOverride = null) => {
    if (e) e.preventDefault();
    const userText = (textOverride || inputMessage).trim();
    if (!userText || isTyping) return;

    const userMsgObj = {
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsgObj]);
    if (!textOverride) setInputMessage('');
    setIsTyping(true);

    // If no specific item is selected yet, provide friendly context-aware guidance
    if (!currentSelectedItem) {
      let replyContent = "I'm ready to help you save! Please select a product, recharge plan, or invoice above first so I can apply exclusive discounts or generate payment options for you.";
      const lower = userText.toLowerCase();
      if (lower.includes('discount')) {
        replyContent = "I offer instant discounts on all products and recharge plans! Please click and select an item above so I can check the exact discount available for you.";
      } else if (lower.includes('emi') || lower.includes('upi')) {
        replyContent = "We support 256-bit SSL secured payments via UPI, Credit Cards, and 3-Month EMI plans. Select any product above to view its monthly breakdown!";
      } else if (lower.includes('payment link') || lower.includes('pay')) {
        replyContent = "Please select a product, plan, or invoice above first so I can generate your personalized payment link!";
      }

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: replyContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        setIsTyping(false);
      }, 400);
      return;
    }

    try {
      let endpoint = `${API_BASE}/chat`;
      let bodyPayload = {
        session_id: sessionId || 'default_demo_session',
        message: userText
      };

      if (contextType === 'subscription' && effectivePlan) {
        endpoint = `${API_BASE}/subscription/negotiate`;
        bodyPayload = {
          session_id: sessionId || 'default_sub_session',
          selected_plan_id: effectivePlan.id,
          user_message: userText,
          current_discount: currentDiscount
        };
      } else if (contextType === 'invoice' && effectiveInvoice) {
        endpoint = `${API_BASE}/invoice/negotiate`;
        bodyPayload = {
          session_id: sessionId || 'default_inv_session',
          invoice_id: effectiveInvoice.id,
          user_message: userText,
          current_discount: currentDiscount
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      if (data.switched_plan) {
        setActivePlan(data.switched_plan);
      }

      const assistantMsgObj = {
        role: 'assistant',
        content: data.reply || data.reply_text,
        payment_link: data.payment_link,
        discount_percent: data.discount_percent || data.applied_discount_percent,
        payment_method: data.payment_method,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsgObj]);

      if (data.discount_percent || data.applied_discount_percent) {
        setCurrentDiscount(data.discount_percent || data.applied_discount_percent);
      }

    } catch (err) {
      console.error('Error sending chat message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: contextType === 'invoice'
            ? `I can offer a compliant payment arrangement for invoice ${effectiveInvoice?.id?.toUpperCase() || 'INV-001'} (₹${Math.round(currentPrice).toLocaleString('en-IN')}): Pay 30% upfront (₹${Math.round(currentPrice * 0.32).toLocaleString('en-IN')}) today and the balance next month.`
            : contextType === 'subscription'
            ? `I can offer an exclusive 10% instant discount on your ${currentTitle} plan!`
            : `I understand your hesitation! How about a 10% instant discount on the ${currentTitle} to close the deal today?`,
          discount_percent: 10,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setCurrentDiscount(10);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePayNowClick = async (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');

    try {
      await fetch(`${API_BASE}/log-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'demo_session',
          objection_type: lastObjectionType || (contextType === 'invoice' ? 'invoice_recovery' : contextType === 'subscription' ? 'recharge_hesitation' : 'price'),
          resolution: lastResolution || 'Arrangement agreed',
          converted: true,
          recovered_amount: effectivePrice
        })
      });
      if (onOutcomeLogged) onOutcomeLogged();
    } catch (e) {
      console.error('Failed to log outcome:', e);
    }
  };

  const containerStyle = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '420px',
    maxHeight: '640px',
    height: '85vh',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    background: 'rgba(15, 23, 42, 0.95)'
  };

  const headerStyle = {
    background: contextType === 'invoice'
      ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)'
      : contextType === 'subscription'
      ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
      : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    padding: '1rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#fff'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '0.4rem',
            borderRadius: '10px',
            display: 'flex'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: '1.2' }}>
              {contextType === 'invoice' ? 'CloseIt Payment Advisor' : contextType === 'subscription' ? 'Smart Recharge Assistant' : 'CloseIt Rescue Agent'}
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
              {contextType === 'invoice' ? 'Online — Payment & Credit Advisor' : contextType === 'subscription' ? 'Online — Recharge Advisor' : 'Online — Ready to negotiate'}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Summary Banner */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.8)',
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.85rem'
      }}>
        {isContextActive ? (
          <>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '230px' }}>
              {contextType === 'invoice' ? '📄 ' : contextType === 'subscription' ? '⚡ ' : '🛒 '}
              {currentTitle}
            </span>
            <div>
              {currentDiscount > 0 ? (
                <span>
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '0.4rem' }}>
                    ₹{currentPrice.toLocaleString('en-IN')}
                  </span>
                  <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>
                    ₹{effectivePrice.toLocaleString('en-IN')}
                  </strong>
                </span>
              ) : (
                <strong style={{ color: '#fff' }}>₹{currentPrice.toLocaleString('en-IN')}</strong>
              )}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>No Selection</span>
        )}
      </div>

      {/* Message List or Placeholder State */}
      <div style={{
        flex: 1,
        padding: '1.25rem',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {!isContextActive ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: 'var(--text-muted)',
            gap: '0.75rem',
            padding: '2rem'
          }}>
            <ShoppingBag size={48} color="#6366f1" opacity={0.6} />
            <h4 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600 }}>
              {contextType === 'invoice' ? 'Select an Invoice' : contextType === 'subscription' ? 'Select a Recharge Plan' : 'Select a Product'}
            </h4>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              {contextType === 'invoice'
                ? 'Select an overdue invoice to initiate B2B debt negotiation.'
                : contextType === 'subscription'
                ? 'Select any mobile recharge plan to negotiate better options or request a discount.'
                : 'Click on any product card in the storefront to select an item and begin your consultation.'}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isAssistant = msg.role === 'assistant';
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isAssistant ? 'flex-start' : 'flex-end'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '0.5rem',
                  maxWidth: '85%'
                }}>
                  {isAssistant && (
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: contextType === 'invoice' ? '#d97706' : contextType === 'subscription' ? '#059669' : 'var(--primary-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Bot size={16} color="#fff" />
                    </div>
                  )}

                  <div style={{
                    background: isAssistant ? 'rgba(30, 41, 59, 0.9)' : (contextType === 'invoice' ? '#d97706' : contextType === 'subscription' ? '#059669' : 'var(--primary-accent)'),
                    color: '#fff',
                    padding: '0.75rem 1rem',
                    borderRadius: isAssistant ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    border: isAssistant ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}>
                    {msg.content}

                    {msg.discount_percent && (
                      <div style={{
                        marginTop: '0.75rem',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        color: '#34d399',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <Tag size={14} />
                        {msg.discount_percent}% Instant Discount Applied!
                      </div>
                    )}

                    {msg.payment_link && (
                      <div style={{ marginTop: '0.85rem' }}>
                        <a
                          href={msg.payment_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-success"
                          onClick={() => handlePayNowClick(msg.payment_link)}
                          style={{
                            padding: '0.65rem 1rem',
                            fontSize: '0.9rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            textDecoration: 'none',
                            color: '#fff'
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Pay Now (₹{effectivePrice.toLocaleString('en-IN')})
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', padding: '0 0.25rem' }}>
                  {msg.timestamp}
                </span>
              </div>
            );
          })
        )}

        {isTyping && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <Bot size={16} color={contextType === 'invoice' ? '#d97706' : contextType === 'subscription' ? '#10b981' : 'var(--primary-accent)'} />
            <span>CloseIt is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div style={{
        padding: '0.5rem 1rem',
        background: 'rgba(15, 23, 42, 0.8)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        {contextType === 'invoice' ? (
          <>
            <button
              onClick={() => { setInputMessage("I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              💳 Pay 30% Down (₹4,000)
            </button>
            <button
              onClick={() => { setInputMessage("Can you give me another 15 days to pay the full amount?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📅 15-Day Extension
            </button>
            <button
              onClick={() => { setInputMessage("Can I pay ₹1,000 now and the remaining amount after 90 days?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ⚠️ Excessive Request
            </button>
            <button
              onClick={() => { setInputMessage("Send me payment link for this invoice"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ⚡ Get Payment Link
            </button>
          </>
        ) : contextType === 'subscription' ? (
          <>
            <button
              onClick={() => { setInputMessage(`Is there any discount available on the ${currentTitle}?`); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🏷️ Ask for Discount
            </button>
            <button
              onClick={() => { setInputMessage("Which plans include OTT subscriptions like Hotstar or SonyLIV?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🎬 OTT & 5G Options
            </button>
            <button
              onClick={() => { setInputMessage("Show me longer validity options for my recharge."); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📅 More Validity
            </button>
            <button
              onClick={() => { setInputMessage("Send me payment link for this recharge plan"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ⚡ Get Payment Link
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => { setInputMessage("Is there any discount available?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              🏷️ Ask for Discount
            </button>
            <button
              onClick={() => { setInputMessage("Can I pay in EMI or UPI?"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              💳 EMI / UPI Options
            </button>
            <button
              onClick={() => { setInputMessage("Send me the payment link"); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ⚡ Get Payment Link
            </button>
          </>
        )}
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} style={{
        padding: '0.85rem 1rem',
        background: 'rgba(10, 14, 23, 0.95)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        gap: '0.5rem'
      }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder={
            isContextActive
              ? (contextType === 'invoice' ? "Propose an arrangement or request extension..." : contextType === 'subscription' ? "Ask about recharge plans, discounts, or OTT..." : "Type your objection or ask for discount...")
              : "Type your question or select an item above..."
          }
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            color: '#fff',
            fontSize: '0.88rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{
            padding: '0.65rem 0.9rem',
            borderRadius: '10px',
            background: contextType === 'invoice' ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : contextType === 'subscription' ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : undefined
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}

