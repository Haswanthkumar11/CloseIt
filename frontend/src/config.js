/**
 * config.js
 * Centralized API base URL configuration for CloseIt Frontend.
 * Uses VITE_API_URL if set (e.g. on Vercel deployment) or falls back to /api (for local dev proxy).
 */

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
