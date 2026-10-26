/**
 * Mock sleep tracking data
 */

export const sleepData = {
  average: '7h 31m',
  averageMinutes: 451,
  quality: 82,
  deepSleep: '1h 03m',
  lightSleep: '4h 12m',
  remSleep: '2h 16m',
  awake: '18m',
  bedtime: '10:00 PM',
  wakeUp: '7:30 AM',
  goal: 480, // 8 hours in minutes
};

export const sleepWeekly = [
  { day: 'Mon', hours: 7.2, quality: 78 },
  { day: 'Tue', hours: 6.8, quality: 72 },
  { day: 'Wed', hours: 8.1, quality: 88 },
  { day: 'Thu', hours: 7.5, quality: 80 },
  { day: 'Fri', hours: 7.0, quality: 75 },
  { day: 'Sat', hours: 8.5, quality: 90 },
  { day: 'Sun', hours: 7.5, quality: 82 },
];

export const sleepPhases = [
  { phase: 'Deep', duration: '1h 03m', percentage: 14, color: '#3A5BC7' },
  { phase: 'Light', duration: '4h 12m', percentage: 56, color: '#5B8DEF' },
  { phase: 'REM', duration: '2h 16m', percentage: 30, color: '#9B85CE' },
];

export const sleepTips = [
  'Try to maintain a consistent sleep schedule, even on weekends.',
  'Avoid screens for 30 minutes before bed to improve sleep quality.',
  'Keep your bedroom cool and dark for deeper sleep.',
];
