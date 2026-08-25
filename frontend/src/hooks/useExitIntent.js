/**
 * useExitIntent.js
 * React Custom Hook to detect checkout exit-intent based on a weighted hesitation score.
 * Combines mouseleave (clientY < 0), visibilitychange (tab hidden), and idle duration on checkout page.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Easy-to-tune configuration constants for live demo tuning
export const HESITATION_THRESHOLD = 3;
export const COOLDOWN_MS = 60000;         // 60-second cooldown between auto-triggers
export const IDLE_TIMEOUT_MS = 20000;      // 20-second idle threshold on checkout
export const SCORE_MOUSELEAVE = 3;          // Moving cursor toward browser chrome
export const SCORE_TAB_HIDDEN = 2;          // Switching tabs
export const SCORE_IDLE = 2;                // No user interaction for > 20s

export function useExitIntent(isOnCheckout = false) {
  const [hesitationScore, setHesitationScore] = useState(0);
  const [isChatTriggered, setIsChatTriggered] = useState(false);
  const [lastTriggerTime, setLastTriggerTime] = useState(0);
  const idleTimerRef = useRef(null);

  // Helper to safely add points to cumulative score
  const addHesitationPoints = useCallback((points, reason) => {
    const now = Date.now();
    
    setHesitationScore((prevScore) => {
      // Check cooldown window
      if (now - lastTriggerTime < COOLDOWN_MS) {
        return prevScore;
      }
      
      const newScore = prevScore + points;
      console.log(`[ExitIntent] +${points} pts (${reason}). New Score: ${newScore}/${HESITATION_THRESHOLD}`);
      
      if (newScore >= HESITATION_THRESHOLD) {
        console.log(`[ExitIntent] Threshold reached (${newScore}). Triggering Rescue Chat.`);
        setIsChatTriggered(true);
        setLastTriggerTime(now);
        return 0; // Reset score after triggering
      }
      
      return newScore;
    });
  }, [lastTriggerTime]);

  // 1. Mouseleave event (cursor moving up out of browser viewport)
  useEffect(() => {
    const handleMouseLeave = (e) => {
      if (e.clientY < 0) {
        addHesitationPoints(SCORE_MOUSELEAVE, 'Mouse moving toward browser chrome');
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [addHesitationPoints]);

  // 2. Visibility change event (tab going hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addHesitationPoints(SCORE_TAB_HIDDEN, 'Tab hidden via visibilitychange');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [addHesitationPoints]);

  // 3. Idle timer event (> 20s with no interaction on checkout page)
  useEffect(() => {
    const resetIdleTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      if (isOnCheckout) {
        idleTimerRef.current = setTimeout(() => {
          addHesitationPoints(SCORE_IDLE, 'Checkout idle duration > 20s');
        }, IDLE_TIMEOUT_MS);
      }
    };

    if (isOnCheckout) {
      resetIdleTimer();
      const events = ['mousemove', 'keydown', 'scroll', 'click'];
      events.forEach(evt => window.addEventListener(evt, resetIdleTimer));
      
      return () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      };
    }
  }, [isOnCheckout, addHesitationPoints]);

  const resetChatTrigger = () => setIsChatTriggered(false);

  return {
    hesitationScore,
    isChatTriggered,
    resetChatTrigger,
    manuallyTriggerChat: () => setIsChatTriggered(true)
  };
}
