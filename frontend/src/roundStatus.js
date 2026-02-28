const STORAGE_KEY = 'vidyamitra_round_status';

const defaultStatus = {
  coding: 'Not Started',
  technical: 'Not Started',
  manager: 'Not Started',
  hr: 'Not Started',
};

export const getRoundStatus = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultStatus };
    return { ...defaultStatus, ...JSON.parse(raw) };
  } catch {
    return { ...defaultStatus };
  }
};

export const setRoundStatus = (roundKey, status) => {
  const current = getRoundStatus();
  const next = { ...current, [roundKey]: status };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const clearRoundStatus = () => {
  localStorage.removeItem(STORAGE_KEY);
};
