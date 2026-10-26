/**
 * Mock cycle tracking data
 */

export const cycleData = {
  cycleDay: 16,
  cycleLength: 28,
  periodLength: 5,
  nextPeriodIn: 12,
  lastPeriodStart: '2026-10-10',
  lastPeriodEnd: '2026-10-14',
  nextPeriodStart: '2026-11-07',
  phase: 'Luteal' as const,
};

export const cycleWeekDates = [
  { day: 'Mon', date: 20, isToday: false, isPeriod: false },
  { day: 'Tue', date: 21, isToday: false, isPeriod: false },
  { day: 'Wed', date: 22, isToday: false, isPeriod: false },
  { day: 'Thu', date: 23, isToday: false, isPeriod: false },
  { day: 'Fri', date: 24, isToday: false, isPeriod: false },
  { day: 'Sat', date: 25, isToday: false, isPeriod: false },
  { day: 'Sun', date: 26, isToday: true, isPeriod: false },
];

export const symptoms = [
  { id: '1', name: 'Cramps', icon: 'flash-outline', selected: false },
  { id: '2', name: 'Headache', icon: 'medical-outline', selected: false },
  { id: '3', name: 'Bloating', icon: 'water-outline', selected: true },
  { id: '4', name: 'Fatigue', icon: 'battery-half-outline', selected: false },
  { id: '5', name: 'Mood swings', icon: 'happy-outline', selected: false },
  { id: '6', name: 'Back pain', icon: 'body-outline', selected: true },
];

export const feelings = [
  { id: '1', emoji: '😊', label: 'Happy' },
  { id: '2', emoji: '😐', label: 'Okay' },
  { id: '3', emoji: '😔', label: 'Low' },
  { id: '4', emoji: '😴', label: 'Tired' },
  { id: '5', emoji: '😤', label: 'Stressed' },
];

export const cycleInsights = [
  {
    title: 'Luteal Phase',
    description: 'You may experience increased appetite and slight bloating. This is normal during the luteal phase.',
  },
  {
    title: 'Exercise Tip',
    description: 'Light yoga and walking can help manage symptoms during this phase of your cycle.',
  },
];

export const cycleArticles = [
  {
    id: 'c1',
    title: 'Understanding your menstrual cycle',
    category: 'Cycle Health',
    readTime: '5 min read',
  },
  {
    id: 'c2',
    title: 'Nutrition tips for each cycle phase',
    category: 'Nutrition',
    readTime: '4 min read',
  },
];
