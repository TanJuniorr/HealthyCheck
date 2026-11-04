// Static labels and icons; user cycle settings and logs are loaded from Supabase.

export const symptoms = [
  { id: '1', name: "cycle.cramps", icon: 'flash-outline' },
  { id: '2', name: "cycle.headache", icon: 'medical-outline' },
  { id: '3', name: "cycle.bloating", icon: 'water-outline' },
  { id: '4', name: "cycle.fatigue", icon: 'battery-half-outline' },
  { id: '5', name: "cycle.moodSwings", icon: 'happy-outline' },
  { id: '6', name: "cycle.backPain", icon: 'body-outline' },
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
