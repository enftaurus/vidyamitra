import { api } from './api';

export const ROUND_ORDER = ['coding', 'technical', 'manager', 'hr'];
const INTERVIEW_UNLOCK_KEY = 'vidyamitra_interview_unlocked';
const INTERVIEW_UNLOCK_EXPIRES_AT_KEY = 'vidyamitra_interview_unlock_expires_at';
const INTERVIEW_ROUND_STARTED_KEY = 'vidyamitra_interview_round_started';
const QUICK_APPLY_UNLOCK_TTL_MS = 5 * 60 * 1000;

export const ROUND_ROUTES = {
  coding: '/interview/coding',
  technical: '/interview/technical',
  manager: '/interview/manager',
  hr: '/interview/hr',
};

export const getNextAllowedRound = (status) => {
  for (const round of ROUND_ORDER) {
    if ((status?.[round] || 'not_started') !== 'completed') {
      return round;
    }
  }
  return 'hr';
};

export const isInterviewUnlocked = () => {
  if (typeof window === 'undefined') return false;
  const unlocked = localStorage.getItem(INTERVIEW_UNLOCK_KEY) === 'true';
  if (!unlocked) return false;

  const roundStarted = localStorage.getItem(INTERVIEW_ROUND_STARTED_KEY) === 'true';
  if (roundStarted) return true;

  const expiresAtRaw = localStorage.getItem(INTERVIEW_UNLOCK_EXPIRES_AT_KEY);
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;
  if (!expiresAt || Number.isNaN(expiresAt) || Date.now() > expiresAt) {
    lockInterviewAccess();
    return false;
  }

  return true;
};

export const setInterviewUnlocked = (unlocked = true) => {
  if (typeof window === 'undefined') return;
  if (!unlocked) {
    localStorage.setItem(INTERVIEW_UNLOCK_KEY, 'false');
    localStorage.removeItem(INTERVIEW_UNLOCK_EXPIRES_AT_KEY);
    localStorage.removeItem(INTERVIEW_ROUND_STARTED_KEY);
    return;
  }

  localStorage.setItem(INTERVIEW_UNLOCK_KEY, 'true');
  localStorage.setItem(INTERVIEW_UNLOCK_EXPIRES_AT_KEY, String(Date.now() + QUICK_APPLY_UNLOCK_TTL_MS));
  localStorage.setItem(INTERVIEW_ROUND_STARTED_KEY, 'false');
};

export const lockInterviewAccess = () => {
  setInterviewUnlocked(false);
};

export const markInterviewRoundStarted = () => {
  if (typeof window === 'undefined') return;
  if (!isInterviewUnlocked()) return;

  localStorage.setItem(INTERVIEW_ROUND_STARTED_KEY, 'true');
  localStorage.removeItem(INTERVIEW_UNLOCK_EXPIRES_AT_KEY);
};

export const isRoundLocked = (status, roundKey) => {
  if (!isInterviewUnlocked()) return true;
  const next = getNextAllowedRound(status);
  const nextIndex = ROUND_ORDER.indexOf(next);
  const currentIndex = ROUND_ORDER.indexOf(roundKey);
  return currentIndex > nextIndex;
};

export const toUiStatus = (value) => {
  if (value === 'completed') return 'Completed';
  if (value === 'in_progress') return 'In Progress';
  return 'Not Started';
};

export const fetchInterviewFlowStatus = async () => {
  const { data } = await api.get('/interview_flow/status');
  return data?.status || {
    coding: 'not_started',
    technical: 'not_started',
    manager: 'not_started',
    hr: 'not_started',
  };
};
