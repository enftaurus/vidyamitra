import { api } from './api';

export const ROUND_ORDER = ['coding', 'technical', 'manager', 'hr'];
const INTERVIEW_UNLOCK_KEY = 'vidyamitra_interview_unlocked';
const INTERVIEW_UNLOCK_EXPIRES_AT_KEY = 'vidyamitra_interview_unlock_expires_at';
const INTERVIEW_ROUND_STARTED_KEY = 'vidyamitra_interview_round_started';
const ACTIVE_JOB_KEY = 'vidyamitra_active_job';
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

export const setActiveJob = (job) => {
  if (typeof window === 'undefined' || !job) return;
  try {
    localStorage.setItem(ACTIVE_JOB_KEY, JSON.stringify(job));
  } catch { /* quota exceeded — ignore */ }
};

export const getActiveJob = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_JOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearActiveJob = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_JOB_KEY);
};

export const lockInterviewAccess = () => {
  setInterviewUnlocked(false);
  clearActiveJob();
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
