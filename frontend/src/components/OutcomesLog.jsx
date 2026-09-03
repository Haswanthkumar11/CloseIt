/**
 * OutcomesLog.jsx
 * Read-only analytics log page displaying cart rescue outcomes from MongoDB Atlas.
 * Displays summary cards (Total Recovered Carts, Total Amount Recovered, Top Objection Type) and an outcome table.
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, DollarSign, AlertCircle, ShoppingBag } from 'lucide-react';
import { API_BASE } from '../config';

export function OutcomesLog() {
  const [data, setData] = useState({
    outcomes: [],
    total_count: 0,
    converted_count: 0,
    total_recovered_amount: 0.0
  });
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('outcomes'); // 'outcomes' | 'audit'

  const fetchOutcomesAndAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resOutcomes, resAudit] = await Promise.all([
        fetch(`${API_BASE}/outcomes`),
        fetch(`${API_BASE}/subscription/audit-logs`)
      ]);

      if (resOutcomes.ok) {
        const json = await resOutcomes.json();
        setData(json);
      }
      if (resAudit.ok) {
        const auditJson = await resAudit.json();
        setAuditEvents(auditJson.audit_events || []);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Could not load analytics log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutcomesAndAudit();
  }, []);

  // Compute most common objection type dynamically
  const objectionCounts = (data.outcomes || []).reduce((acc, curr) => {
    const key = curr.objection_type || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  let topObjection = 'None';
  let maxCount = 0;
  Object.entries(objectionCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topObjection = type;
    }
  });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Header & Refresh */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Merchant Rescue Outcomes & Audit Log</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Real-time conversion metrics, objection resolution, and policy audit logs from MongoDB Atlas.
          </p>
        </div>

        <button
          onClick={fetchOutcomesAndAudit}
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Log Data
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Total Carts Recovered */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <span>Total Carts Recovered</span>
            <CheckCircle size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34d399' }}>
            {data.converted_count} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {data.total_count} total</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Successful conversions
          </div>
        </div>

        {/* Total Amount Recovered */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <span>Total Amount Recovered</span>
            <DollarSign size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
            ₹{data.total_recovered_amount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Revenue saved via CloseIt
          </div>
        </div>

        {/* Most Common Objection */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
            <span>Most Common Objection</span>
            <AlertCircle size={18} color="#ec4899" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, textTransform: 'capitalize', color: '#f472b6' }}>
            {topObjection}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Highest friction trigger
          </div>
        </div>
      </div>

      {/* Sub-tabs for Log Views */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => setActiveSubTab('outcomes')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: activeSubTab === 'outcomes' ? '1px solid #6366f1' : '1px solid var(--border-color)',
            background: activeSubTab === 'outcomes' ? 'var(--primary-accent)' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          🛒 Cart Rescue Outcomes ({data.outcomes ? data.outcomes.length : 0})
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          style={{
            padding: '0.6rem 1.25rem',
            borderRadius: '10px',
            border: activeSubTab === 'audit' ? '1px solid #10b981' : '1px solid var(--border-color)',
            background: activeSubTab === 'audit' ? '#059669' : 'rgba(255,255,255,0.05)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer'
          }}
        >
          ⚡ Smart Recharge Audit Trail & Policy Events ({auditEvents.length})
        </button>
      </div>

      {/* Log Table 1: Cart Rescue Outcomes */}
      {activeSubTab === 'outcomes' && (
        <div className="glass-panel" style={{ padding: '1.5rem', overflow: 'hidden' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Recorded Outcomes History (GET /outcomes)</h3>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading outcomes...</div>
          ) : error ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>{error}</div>
          ) : data.outcomes.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No outcomes recorded yet. Trigger an exit-intent rescue turn on the storefront!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Session ID</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Objection Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Resolution Offered</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Converted</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Recovered Amount</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.outcomes.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: '#818cf8', fontWeight: 600 }}>
                        {item.session_id ? item.session_id.substring(0, 16) : 'sess_demo'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textTransform: 'capitalize' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.06)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.8rem'
                        }}>
                          {item.objection_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)' }}>
                        {item.resolution}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontSize: '1.1rem' }}>
                        {item.converted ? '✅' : '❌'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: item.converted ? 700 : 400, color: item.converted ? '#34d399' : 'var(--text-muted)' }}>
                        ₹{item.recovered_amount ? item.recovered_amount.toLocaleString('en-IN') : '0'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Log Table 2: Smart Recharge Audit Trail & Policy Events */}
      {activeSubTab === 'audit' && (
        <div className="glass-panel" style={{ padding: '1.5rem', overflow: 'hidden' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Smart Recharge Audit Trail (GET /subscription/audit-logs)</h3>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading audit events...</div>
          ) : auditEvents.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No subscription audit events recorded yet. Select or negotiate a plan in Smart Recharge!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>Event Type</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Plan / Action</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Policy Status</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Details / Reason</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((evt, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{
                          background: evt.event_type === 'POLICY_DECISION' ? 'rgba(239, 68, 68, 0.2)' :
                                     evt.event_type === 'PLAN_RECOMMENDED' ? 'rgba(59, 130, 246, 0.2)' :
                                     evt.event_type === 'PLAN_SWITCHED' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: evt.event_type === 'POLICY_DECISION' ? '#f87171' :
                                 evt.event_type === 'PLAN_RECOMMENDED' ? '#60a5fa' :
                                 evt.event_type === 'PLAN_SWITCHED' ? '#c084fc' : '#34d399',
                          padding: '0.25rem 0.65rem',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}>
                          {evt.event_type}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#fff' }}>
                        {evt.selected_plan_id || evt.plan_id || evt.action || 'Subscription Action'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        {evt.allowed !== undefined ? (evt.allowed ? '✅ Approved' : '❌ Rejected') : 'ℹ️ Logged'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {evt.reason || evt.recommendation_badge || (evt.verified_amount ? `Verified Price: ₹${evt.verified_amount}` : 'Action logged')}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'Just now'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
