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
  onClose,
  sessionId,
  cartItem,
  cartPrice,
  onOutcomeLogged
}) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentDiscount, setCurrentDiscount] = useState(0);
  const [lastObjectionType, setLastObjectionType] = useState('price');
  const [lastResolution, setLastResolution] = useState('Offered discount');
  
  const messagesEndRef = useRef(null);

  // FIX 2: Reset chat history & opening message whenever active product changes or session starts
  useEffect(() => {
    if (cartItem) {
      setMessages([
        {
          role: 'assistant',
          content: `Hey! Before you go — is something holding you back from ordering the ${cartItem}? I'm here to help!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setCurrentDiscount(0);
    } else {
      setMessages([]);
    }
  }, [cartItem, cartPrice, sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const effectivePrice = cartPrice ? cartPrice * (1 - currentDiscount / 100) : 0;

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || isTyping || !cartItem) return;

    const userText = inputMessage.trim();
    const userMsgObj = {
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsgObj]);
    setInputMessage('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId || 'default_demo_session',
          message: userText
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();

      const assistantMsgObj = {
        role: 'assistant',
        content: data.reply,
        payment_link: data.payment_link,
        discount_percent: data.discount_percent,
        payment_method: data.payment_method,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsgObj]);

      if (data.discount_percent) {
        setCurrentDiscount(data.discount_percent);
      }
      if (data.objection_type) {
        setLastObjectionType(data.objection_type);
      }
      if (data.resolution_offered) {
        setLastResolution(data.resolution_offered);
      }

    } catch (err) {
      console.error('Error sending chat message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `I understand your hesitation! How about a 10% instant discount on the ${cartItem} to close the deal today?`,
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
          objection_type: lastObjectionType || 'price',
          resolution: lastResolution || '10% discount',
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
    width: '400px',
    maxHeight: '620px',
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
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
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
            <div style={{ fontWeight: 700, fontSize: '1rem', lineHeight: '1.2' }}>CloseIt Rescue Agent</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }}></span>
              Online — Ready to negotiate
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

      {/* Cart Summary Banner */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.8)',
        padding: '0.75rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.85rem'
      }}>
        {cartItem ? (
          <>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
              🛒 {cartItem}
            </span>
            <div>
              {currentDiscount > 0 ? (
                <span>
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '0.4rem' }}>
                    ₹{cartPrice.toLocaleString('en-IN')}
                  </span>
                  <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>
                    ₹{effectivePrice.toLocaleString('en-IN')}
                  </strong>
                </span>
              ) : (
                <strong style={{ color: '#fff' }}>₹{cartPrice.toLocaleString('en-IN')}</strong>
              )}
            </div>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>No Product Selected</span>
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
        {!cartItem ? (
          // Placeholder state when no product is selected
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
            <h4 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 600 }}>Select a Product to Get Started</h4>
            <p style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
              Click on any product card in the storefront to select an item and begin your AI checkout rescue consultation.
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
                      background: 'var(--primary-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Bot size={16} color="#fff" />
                    </div>
                  )}

                  <div style={{
                    background: isAssistant ? 'rgba(30, 41, 59, 0.9)' : 'var(--primary-accent)',
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

                    {msg.payment_method && (
                      <div style={{
                        marginTop: '0.75rem',
                        background: 'rgba(168, 85, 247, 0.15)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        color: '#c084fc',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}>
                        <CreditCard size={14} />
                        {msg.payment_method.toUpperCase()} Payment Option Active
                      </div>
                    )}

                    {msg.payment_link && (
                      <div style={{ marginTop: '0.85rem' }}>
                        <button
                          className="btn-success"
                          onClick={() => handlePayNowClick(msg.payment_link)}
                          style={{ padding: '0.65rem 1rem', fontSize: '0.9rem' }}
                        >
                          <CheckCircle2 size={16} />
                          Pay Now (₹{effectivePrice.toLocaleString('en-IN')})
                          <ExternalLink size={14} />
                        </button>
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
            <Bot size={16} color="var(--primary-accent)" />
            <span>CloseIt is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Objection Action Chips */}
      {cartItem && (
        <div style={{
          padding: '0.5rem 1rem',
          background: 'rgba(15, 23, 42, 0.8)',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto'
        }}>
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
        </div>
      )}

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
          placeholder={cartItem ? "Type your objection..." : "Select a product to chat..."}
          disabled={!cartItem}
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '0.65rem 0.85rem',
            color: '#fff',
            fontSize: '0.88rem',
            outline: 'none',
            opacity: cartItem ? 1 : 0.5
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!cartItem}
          style={{ padding: '0.65rem 0.9rem', borderRadius: '10px', opacity: cartItem ? 1 : 0.5 }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
