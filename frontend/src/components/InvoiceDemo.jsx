/**
 * InvoiceDemo.jsx — B2B Merchant Invoice Recovery Dashboard
 * Displays merchant invoices fetched from MongoDB Atlas, allows creating new custom invoices,
 * sending email reminders, simulating customer response scenarios, and triggering CloseIt negotiation rescue.
 */

import React, { useState, useEffect } from 'react';
import { FileText, Send, AlertTriangle, Plus, Sparkles, CheckCircle2, Clock, X, ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import { API_BASE } from '../config';

export function InvoiceDemo({ onInvoiceSelectedForRescue }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [selectedSimulateInvoice, setSelectedSimulateInvoice] = useState(null);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [reminderStatus, setReminderStatus] = useState({});

  // New Invoice Form State
  const [newInvoice, setNewInvoice] = useState({
    client_name: '',
    client_email: '',
    amount: '',
    due_date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'overdue'
  });

  const DEFAULT_FALLBACK_INVOICES = [
    {
      id: "inv_001",
      client_name: "Acme Technologies",
      client_email: "demo@example.com",
      amount: 12500.0,
      due_date: "2026-08-28",
      status: "overdue",
      description: "Website Development - August",
      negotiation_history: []
    },
    {
      id: "inv_002",
      client_name: "Apex Systems",
      client_email: "apex@example.com",
      amount: 25000.0,
      due_date: "2026-08-15",
      status: "overdue",
      description: "AI Consulting & Strategy",
      negotiation_history: []
    },
    {
      id: "inv_003",
      client_name: "Horizon Labs",
      client_email: "horizon@example.com",
      amount: 8500.0,
      due_date: "2026-09-15",
      status: "pending",
      description: "Cloud Infrastructure & DevOps",
      negotiation_history: []
    }
  ];

  const fetchInvoices = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(`${API_BASE}/invoice/list`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const loaded = (data.invoices && data.invoices.length > 0) ? data.invoices : DEFAULT_FALLBACK_INVOICES;
        setInvoices(loaded);
      } else {
        setInvoices(DEFAULT_FALLBACK_INVOICES);
      }
    } catch (err) {
      console.warn('Using default fallback invoices due to API error:', err);
      setInvoices(DEFAULT_FALLBACK_INVOICES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (!newInvoice.client_name || !newInvoice.amount) return;

    try {
      const res = await fetch(`${API_BASE}/invoice/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: newInvoice.client_name,
          client_email: newInvoice.client_email || 'client@example.com',
          amount: parseFloat(newInvoice.amount),
          due_date: newInvoice.due_date,
          description: newInvoice.description || 'Professional Services',
          status: newInvoice.status || 'overdue'
        })
      });

      if (res.ok) {
        setShowCreateModal(false);
        setNewInvoice({
          client_name: '',
          client_email: '',
          amount: '',
          due_date: new Date().toISOString().split('T')[0],
          description: '',
          status: 'overdue'
        });
        fetchInvoices();
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
    }
  };

  const handleSendReminder = async (invoiceId) => {
    setSendingReminderId(invoiceId);
    try {
      const res = await fetch(`${API_BASE}/invoice/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId })
      });

      if (res.ok) {
        setReminderStatus((prev) => ({ ...prev, [invoiceId]: 'Sent ✓' }));
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      setReminderStatus((prev) => ({ ...prev, [invoiceId]: 'Simulated ✓' }));
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleOpenSimulateModal = (invoice) => {
    setSelectedSimulateInvoice(invoice);
    setShowSimulateModal(true);
  };

  const handleSelectSimulationScenario = (scenarioText, invoice) => {
    setShowSimulateModal(false);
    if (onInvoiceSelectedForRescue) {
      onInvoiceSelectedForRescue(invoice, scenarioText);
    }
  };

  // Compute metrics
  const totalOverdue = invoices.filter(inv => inv.status === 'overdue');
  const totalValueAtRisk = totalOverdue.reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(225, 29, 72, 0.2) 100%)',
        borderRadius: '24px',
        padding: '2rem 2.5rem',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <FileText size={14} /> B2B Invoice Recovery Module 3
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0' }}>
            Invoice Recovery & Debt Negotiation
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '650px' }}>
            Convert overdue merchant invoices into policy-governed payment arrangements. CloseIt sends reminders, negotiates compliant partial payments, and issues Razorpay links.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '0.85rem 1.5rem',
            borderRadius: '14px',
            border: 'none',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 10px 25px rgba(245, 158, 11, 0.3)'
          }}
        >
          <Plus size={18} /> Create New Invoice
        </button>
      </div>

      {/* KPI Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Overdue Invoices</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>
            {totalOverdue.length} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {invoices.length} total</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Revenue at risk</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Total Value at Risk</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
            ₹{totalValueAtRisk.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Pending collection</div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Merchant Policy Rules</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#34d399' }}>
            Min 30% Down • Max 30d Extension
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Max 10% Discount</div>
        </div>
      </div>

      {/* Invoice List Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>Loading merchant invoices from MongoDB Atlas...</div>
      ) : invoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '16px' }}>
          No invoices found. Click "Create New Invoice" to add one!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
          {invoices.map((inv) => {
            const isOverdue = inv.status === 'overdue';
            const reminderSent = reminderStatus[inv.id];

            return (
              <div
                key={inv.id}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  borderRadius: '20px',
                  border: isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  position: 'relative',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                      #{inv.id.toUpperCase()}
                    </span>
                    <span style={{
                      background: isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: isOverdue ? '#f87171' : '#60a5fa',
                      border: isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {isOverdue ? '⚠️ Overdue' : 'Pending'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: '0 0 0.25rem 0' }}>
                    {inv.client_name}
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                    {inv.description}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
                      ₹{inv.amount.toLocaleString('en-IN')}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Due: {inv.due_date}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleSendReminder(inv.id)}
                      disabled={sendingReminderId === inv.id}
                      style={{
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: reminderSent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.9)',
                        color: reminderSent ? '#34d399' : '#cbd5e1',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Mail size={14} />
                      {sendingReminderId === inv.id ? 'Sending...' : reminderSent || 'Send Reminder'}
                    </button>

                    <button
                      onClick={() => handleOpenSimulateModal(inv)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Sparkles size={14} />
                      Simulate Reply
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (onInvoiceSelectedForRescue) {
                        onInvoiceSelectedForRescue(inv, null);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    Negotiate Recovery <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Create New Custom Invoice */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '480px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0' }}>Create Custom Invoice</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Create a custom merchant invoice. It will be saved directly to MongoDB Atlas.
            </p>

            <form onSubmit={handleCreateInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={newInvoice.client_name}
                  onChange={(e) => setNewInvoice({ ...newInvoice, client_name: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Client Email</label>
                <input
                  type="email"
                  placeholder="e.g. accounts@acme.com"
                  value={newInvoice.client_email}
                  onChange={(e) => setNewInvoice({ ...newInvoice, client_email: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Invoice Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    placeholder="12500"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>

                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Due Date</label>
                  <input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Software Development Services"
                  value={newInvoice.description}
                  onChange={(e) => setNewInvoice({ ...newInvoice, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.78rem', display: 'block', marginBottom: '0.3rem' }}>Initial Status</label>
                <select
                  value={newInvoice.status}
                  onChange={(e) => setNewInvoice({ ...newInvoice, status: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem' }}
                >
                  <option value="overdue">Overdue</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  marginTop: '0.5rem'
                }}
              >
                Save Invoice to MongoDB Atlas
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: 3 Predefined Customer Response Scenarios */}
      {showSimulateModal && selectedSimulateInvoice && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(15, 23, 42, 0.98)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '24px',
            width: '100%',
            maxWidth: '520px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowSimulateModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0 0 0.3rem 0' }}>
              Simulate Customer Reply ({selectedSimulateInvoice.client_name})
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a customer response scenario to test the Policy Engine & Negotiation workflow:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Scenario A: Partial Payment (Compliant) */}
              <div
                onClick={() => handleSelectSimulationScenario("I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?", selectedSimulateInvoice)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.85rem' }}>Scenario A — Partial Payment</span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>✅ Policy Allowed</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?"
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  ₹4,000 / ₹12,500 = 32% (≥ 30% min required). Approved.
                </div>
              </div>

              {/* Scenario B: Due Date Extension (Compliant) */}
              <div
                onClick={() => handleSelectSimulationScenario("Can you give me another 15 days to pay the full amount?", selectedSimulateInvoice)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.85rem' }}>Scenario B — 15-Day Extension</span>
                  <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>✅ Policy Allowed</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "Can you give me another 15 days to pay the full amount?"
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  15 days extension (≤ 30 days max allowed). Approved.
                </div>
              </div>

              {/* Scenario C: Excessive Request (Non-Compliant / Rejected) */}
              <div
                onClick={() => handleSelectSimulationScenario("Can I pay ₹1,000 now and the remaining amount after 90 days?", selectedSimulateInvoice)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>Scenario C — Excessive Request</span>
                  <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>❌ Policy Denied</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "Can I pay ₹1,000 now and the remaining amount after 90 days?"
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  8% upfront (&lt; 30% min) &amp; 90 days (&gt; 30d max). Rejected with explanation.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
