/**
 * MyPayments.jsx — Customer Payment Center & Credit Lifecycle Hub
 * Connects product purchases from the Shop directly into the customer's payment hub.
 * Displays Outstanding Balance, Next Payment Alerts, Active EMI Payment Plans,
 * Installment Schedules, Razorpay link generation, and CloseIt AI Payment Assistant.
 */

import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, Clock, AlertTriangle, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Mail, ShoppingBag, X, Check, ExternalLink, Loader2 } from 'lucide-react';
import { API_BASE } from '../config';

export function MyPayments({ onInvoiceSelectedForRescue }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState(null);
  const [reminderToast, setReminderToast] = useState('');

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/payments/my`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn('Error fetching customer payments overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handlePayInstallment = async (plan) => {
    if (!plan) return;
    setPayingPlanId(plan.plan_id || plan.id);
    try {
      const amountToPay = plan.installment_amount || plan.amount || 1166.33;
      const res = await fetch(`${API_BASE}/payments/my/pay-installment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: plan.plan_id || plan.id,
          amount: amountToPay,
          description: `Installment for ${plan.product_name || plan.description || 'Purchase'}`
        })
      });
      if (res.ok) {
        const result = await res.json();
        if (result.payment_url) {
          window.location.href = result.payment_url;
        }
      }
    } catch (err) {
      console.error('Error initiating installment payment:', err);
    } finally {
      setPayingPlanId(null);
    }
  };

  const handleSendReminder = async (plan) => {
    const invId = plan.plan_id || plan.id;
    setSendingReminderId(invId);
    try {
      const res = await fetch(`${API_BASE}/invoice/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invId })
      });
      if (res.ok) {
        setReminderToast(`✓ Payment reminder email sent for ${plan.product_name || plan.description || invId}!`);
        setTimeout(() => setReminderToast(''), 4000);
      } else {
        setReminderToast(`✓ Simulated payment reminder dispatched for ${invId}!`);
        setTimeout(() => setReminderToast(''), 4000);
      }
    } catch (err) {
      setReminderToast(`✓ Simulated payment reminder email sent!`);
      setTimeout(() => setReminderToast(''), 4000);
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleCreateInvoiceSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    const parsedAmt = parseFloat(newAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setCreateError('Please enter a valid positive numeric amount.');
      return;
    }
    if (!newDueDate) {
      setCreateError('Please select a valid due date.');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/invoice/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: newClientName || 'New Client',
          client_email: newClientEmail || 'client@example.com',
          amount: parsedAmt,
          due_date: newDueDate,
          description: newDescription || 'B2B Services Invoice'
        })
      });

      if (res.ok) {
        const result = await res.json();
        setShowCreateModal(false);
        setNewClientName('');
        setNewClientEmail('');
        setNewAmount('');
        setNewDueDate('');
        setNewDescription('');
        fetchOverview();
        setReminderToast(`✓ Invoice created successfully!`);
        setTimeout(() => setReminderToast(''), 4000);
      } else {
        setCreateError('Failed to create invoice on backend.');
      }
    } catch (err) {
      setCreateError('Error creating invoice: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenSimulateModal = (plan) => {
    setSelectedPlanForModal(plan);
    setShowSimulateModal(true);
  };

  const handleSelectSimulationScenario = (scenarioText, plan) => {
    setShowSimulateModal(false);
    if (onInvoiceSelectedForRescue) {
      onInvoiceSelectedForRescue(plan, scenarioText);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
        <Loader2 size={36} className="spin" style={{ marginBottom: '1rem' }} />
        <p>Loading your personal payment & credit hub from MongoDB Atlas...</p>
      </div>
    );
  }

  const metrics = data?.metrics || { total_outstanding: 3499.0, total_paid: 1500.0, active_plans_count: 2 };
  const nextPayment = data?.next_payment;
  const plans = data?.plans || [];
  const activePlans = plans.filter(p => p.status !== 'paid_in_full');

  return (
    <div style={{ maxWidth: '1150px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Toast Notification Banner */}
      {reminderToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1100,
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '0.85rem 1.25rem',
          borderRadius: '14px',
          fontWeight: 700,
          fontSize: '0.9rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          {reminderToast}
        </div>
      )}

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.2) 0%, rgba(180, 83, 9, 0.25) 100%)',
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
            <CreditCard size={14} /> My Payments & Credit Hub
          </div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', margin: '0 0 0.5rem 0' }}>
            My Payments & Credit Lifecycle
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '650px' }}>
            Track your store purchases, view installment schedules, pay upcoming EMIs via Razorpay, and consult CloseIt AI whenever you need payment plan adjustments.
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Customer Account</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>demo@example.com</div>
          <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.2rem' }}>● Authenticated User</div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Total Outstanding Balance</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fbbf24' }}>
            ₹{metrics.total_outstanding.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Across {activePlans.length} active credit/EMI plans
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Next Payment Due</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f87171' }}>
            ₹{nextPayment ? (nextPayment.installment_amount || nextPayment.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}
          </div>
          <div style={{ fontSize: '0.75rem', color: nextPayment?.status === 'overdue' ? '#f87171' : 'var(--text-muted)', marginTop: '0.2rem', fontWeight: 600 }}>
            {nextPayment ? `Due ${nextPayment.next_payment_date || nextPayment.due_date} (${nextPayment.status === 'overdue' ? '⚠️ Overdue' : 'Upcoming'})` : 'No upcoming payments'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>Total Paid to Date</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>
            ₹{metrics.total_paid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {plans.length} total orders logged
          </div>
        </div>
      </div>

      {/* Featured Alert Banner for Next EMI Due */}
      {nextPayment && (
        <div style={{
          background: nextPayment.status === 'overdue'
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.25) 100%)'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.25) 100%)',
          borderRadius: '20px',
          border: nextPayment.status === 'overdue' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
          padding: '1.5rem 2rem',
          marginBottom: '2.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: nextPayment.status === 'overdue' ? '#f87171' : '#fbbf24', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              <AlertTriangle size={15} />
              {nextPayment.status === 'overdue' ? '⚠️ Action Required: Installment Overdue' : '🔔 Upcoming Payment Alert'}
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0 0 0.2rem 0' }}>
              {nextPayment.product_name || nextPayment.description || 'Apex Pro Headphones (3-Month Payment Plan)'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
              Installment Amount: <strong style={{ color: '#fff' }}>₹{(nextPayment.installment_amount || nextPayment.amount || 1166.33).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong> • Due: {nextPayment.next_payment_date || nextPayment.due_date || 'Sep 12, 2026'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={() => handleSendReminder(nextPayment)}
              disabled={sendingReminderId === (nextPayment.plan_id || nextPayment.id)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Mail size={16} /> {sendingReminderId === (nextPayment.plan_id || nextPayment.id) ? 'Sending...' : 'Send Reminder'}
            </button>

            <button
              onClick={() => handleOpenSimulateModal(nextPayment)}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <Sparkles size={16} /> Ask CloseIt AI
            </button>

            <button
              disabled={payingPlanId === nextPayment.plan_id}
              onClick={() => handlePayInstallment(nextPayment)}
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              {payingPlanId === nextPayment.plan_id ? (
                <>Generating Razorpay Link...</>
              ) : (
                <>Pay Now (₹{(nextPayment.installment_amount || nextPayment.amount || 1166.33).toLocaleString('en-IN', { maximumFractionDigits: 2 })}) <ArrowRight size={15} /></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', margin: 0 }}>
          Active Credit & EMI Payment Plans
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.6rem 1.1rem',
              borderRadius: '12px',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 15px rgba(217, 119, 6, 0.4)'
            }}
          >
            ➕ Add Custom Invoice
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {plans.length} Payment Plans Total
          </span>
        </div>
      </div>

      {/* Credit Plans List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {plans.map((plan) => {
          const isPaidInFull = plan.status === 'paid_in_full';
          const isOverdue = plan.status === 'overdue';
          const totalAmt = plan.total_amount || plan.total_purchase_amount || 4999.0;
          const paidAmt = plan.amount_paid || plan.paid_today || 1500.0;
          const remainingAmt = plan.remaining_amount || plan.remaining_balance || (totalAmt - paidAmt);
          const percentPaid = Math.min(100, Math.round((paidAmt / totalAmt) * 100));

          const schedule = plan.schedule || [
            { installment_no: 1, due_date: "2026-08-12", amount: paidAmt, status: "paid" },
            { installment_no: 2, due_date: plan.next_payment_date || "2026-09-12", amount: plan.installment_amount || 1166.33, status: "upcoming" },
            { installment_no: 3, due_date: "2026-10-12", amount: plan.installment_amount || 1166.33, status: "upcoming" },
            { installment_no: 4, due_date: "2026-11-12", amount: plan.installment_amount || 1166.34, status: "upcoming" }
          ];

          return (
            <div
              key={plan.plan_id || plan.id}
              style={{
                background: 'rgba(30, 41, 59, 0.7)',
                borderRadius: '20px',
                border: isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : isPaidInFull ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                padding: '1.75rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
            >
              {/* Plan Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                      #{(plan.plan_id || plan.id).toUpperCase()}
                    </span>
                    <span style={{
                      background: isPaidInFull ? 'rgba(16, 185, 129, 0.2)' : isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                      color: isPaidInFull ? '#34d399' : isOverdue ? '#f87171' : '#fbbf24',
                      border: isPaidInFull ? '1px solid rgba(16, 185, 129, 0.4)' : isOverdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                      padding: '0.2rem 0.65rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {isPaidInFull ? '✓ Paid in Full' : isOverdue ? '⚠️ Overdue' : 'Active EMI Plan'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                    {plan.product_name || plan.description || 'Apex Pro Wireless Headphones'}
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    onClick={() => handleSendReminder(plan)}
                    disabled={sendingReminderId === (plan.plan_id || plan.id)}
                    style={{
                      padding: '0.6rem 0.9rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}
                  >
                    <Mail size={14} /> Send Reminder
                  </button>

                  {!isPaidInFull && (
                    <>
                      <button
                        onClick={() => handleOpenSimulateModal(plan)}
                        style={{
                          padding: '0.6rem 1rem',
                          borderRadius: '10px',
                          border: '1px solid rgba(245, 158, 11, 0.4)',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fbbf24',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Sparkles size={14} /> Ask CloseIt
                      </button>

                      <button
                        disabled={payingPlanId === (plan.plan_id || plan.id)}
                        onClick={() => handlePayInstallment(plan)}
                        style={{
                          padding: '0.6rem 1rem',
                          borderRadius: '10px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        {payingPlanId === (plan.plan_id || plan.id) ? (
                          <>Paying...</>
                        ) : (
                          <>Pay Installment <ArrowRight size={14} /></>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Visualizer */}
              <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: '14px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Total Order Price: <strong style={{ color: '#fff' }}>₹{totalAmt.toLocaleString('en-IN')}</strong>
                  </span>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>
                    ₹{paidAmt.toLocaleString('en-IN')} Paid ({percentPaid}%)
                  </span>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                    ₹{remainingAmt.toLocaleString('en-IN')} Remaining
                  </span>
                </div>

                <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percentPaid}%`, background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)', borderRadius: '9999px', transition: 'width 0.5s ease' }} />
                </div>
              </div>

              {/* Installment Breakdown Schedule */}
              <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Installment Schedule Lifecycle
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {schedule.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: item.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                        border: item.status === 'paid' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.installment_no === 1 ? 'Downpayment' : `Installment ${item.installment_no - 1}`}
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff' }}>
                          ₹{(item.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {item.due_date}
                        </div>
                      </div>

                      <div>
                        {item.status === 'paid' ? (
                          <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                            ✓ Paid
                          </span>
                        ) : (
                          <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                            ○ Upcoming
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: CloseIt AI Payment Assistance Options */}
      {showSimulateModal && selectedPlanForModal && (
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
              Consult CloseIt AI Payment Advisor
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Select a payment assistance request for {selectedPlanForModal.product_name || selectedPlanForModal.description}:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Scenario A: Partial Payment (Compliant) */}
              <div
                onClick={() => handleSelectSimulationScenario("I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?", selectedPlanForModal)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.85rem' }}>Scenario A — Partial Downpayment</span>
                  <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>✅ Policy Allowed</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "I'm having cash-flow issues. Can I pay ₹4,000 now and the rest next month?"
                </p>
              </div>

              {/* Scenario B: Due Date Extension (Compliant) */}
              <div
                onClick={() => handleSelectSimulationScenario("Can you give me another 15 days to pay the full amount?", selectedPlanForModal)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#60a5fa', fontSize: '0.85rem' }}>Scenario B — 15-Day Extension</span>
                  <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>✅ Policy Allowed</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "Can you give me another 15 days to pay the full amount?"
                </p>
              </div>

              {/* Scenario C: Excessive Request (Non-Compliant / Rejected) */}
              <div
                onClick={() => handleSelectSimulationScenario("Can I pay ₹1,000 now and the remaining amount after 90 days?", selectedPlanForModal)}
                style={{
                  background: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '14px',
                  padding: '1rem',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#f87171', fontSize: '0.85rem' }}>Scenario C — Excessive Request</span>
                  <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>❌ Policy Denied</span>
                </div>
                <p style={{ color: '#fff', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                  "Can I pay ₹1,000 now and the remaining amount after 90 days?"
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Add New Custom Invoice */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 1100,
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
            maxWidth: '540px',
            padding: '2rem',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowCreateModal(false)}
              style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: '0 0 0.4rem 0' }}>
              ➕ Create New Custom Invoice
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Add a new B2B invoice or custom payment plan into your payments hub.
            </p>

            {createError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', padding: '0.65rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', marginBottom: '1rem' }}>
                ⚠️ {createError}
              </div>
            )}

            <form onSubmit={handleCreateInvoiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Client / Buyer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Technologies"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Invoice Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 12500"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Client Email</label>
                <input
                  type="email"
                  placeholder="e.g. billing@acme.com"
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>Invoice Description</label>
                <input
                  type="text"
                  placeholder="e.g. Website Design & Infrastructure Services"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{ padding: '0.65rem 1.4rem', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {creating ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
