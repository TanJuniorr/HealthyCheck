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
  phase: 'cycle.luteal' as const,
};

export const cycleWeekDates = [
  { day: "weekday.mon", date: 20, isToday: false, isPeriod: false },
  { day: "weekday.tue", date: 21, isToday: false, isPeriod: false },
  { day: "weekday.wed", date: 22, isToday: false, isPeriod: false },
  { day: "weekday.thu", date: 23, isToday: false, isPeriod: false },
  { day: "weekday.fri", date: 24, isToday: false, isPeriod: false },
  { day: "weekday.sat", date: 25, isToday: false, isPeriod: false },
  { day: "weekday.sun", date: 26, isToday: true, isPeriod: false },
];

export const symptoms = [
  { id: '1', name: "cycle.cramps", icon: 'flash-outline', selected: false },
  { id: '2', name: "cycle.headache", icon: 'medical-outline', selected: false },
  { id: '3', name: "cycle.bloating", icon: 'water-outline', selected: true },
  { id: '4', name: "cycle.fatigue", icon: 'battery-half-outline', selected: false },
  { id: '5', name: "cycle.moodSwings", icon: 'happy-outline', selected: false },
  { id: '6', name: "cycle.backPain", icon: 'body-outline', selected: true },
];

export const feelings = [
  { id: '1', emoji: '😊', label: "cycle.happy" },
  { id: '2', emoji: '😐', label: "cycle.okay" },
  { id: '3', emoji: '😔', label: "cycle.low" },
  { id: '4', emoji: '😴', label: "cycle.tired" },
  { id: '5', emoji: '😤', label: "cycle.stressed" },
];

export const cycleInsights = [
  {
    title: "cycle.lutealTitle",
    description: "cycle.lutealDescription",
  },
  {
    title: "cycle.exercise",
    description: "cycle.exerciseHint",
  },
];

export const cycleArticles = [
  {
    id: 'c1',
    title: "cycle.understanding",
    category: "cycle.healthCategory",
    readTime: '5 min read',
  },
  {
    id: 'c2',
    title: "cycle.nutritionTips",
    category: "health.nutrition",
    readTime: '4 min read',
  },
];
