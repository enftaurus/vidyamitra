import { api } from './api';

export const ROUND_ORDER = ['coding', 'technical', 'manager', 'hr'];

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

export const isRoundLocked = (status, roundKey) => {
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
