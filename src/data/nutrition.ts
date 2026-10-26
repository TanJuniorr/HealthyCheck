/**
 * Mock nutrition tracking data
 */

export const nutritionData = {
  caloriesConsumed: 960,
  caloriesGoal: 1600,
  progress: 0.6, // 960 / 1600
  protein: { current: 48, goal: 90, unit: 'g', color: '#0EA5A4' },
  carbs: { current: 120, goal: 200, unit: 'g', color: '#5B8DEF' },
  fat: { current: 32, goal: 60, unit: 'g', color: '#F4A261' },
  fiber: { current: 14, goal: 25, unit: 'g', color: '#39A983' },
  water: { current: 1800, goal: 2500, unit: 'ml', color: '#5B8DEF' },
};

export const meals = [
  {
    id: '1',
    type: 'Breakfast',
    time: '7:30 AM',
    totalCalories: 340,
    icon: 'sunny-outline',
    items: [
      { name: 'Oatmeal with berries', calories: 220 },
      { name: 'Green tea', calories: 5 },
      { name: 'Banana', calories: 115 },
    ],
  },
  {
    id: '2',
    type: 'Lunch',
    time: '12:30 PM',
    totalCalories: 480,
    icon: 'partly-sunny-outline',
    items: [
      { name: 'Grilled chicken salad', calories: 320 },
      { name: 'Whole wheat bread', calories: 80 },
      { name: 'Apple juice', calories: 80 },
    ],
  },
  {
    id: '3',
    type: 'Snack',
    time: '3:00 PM',
    totalCalories: 140,
    icon: 'cafe-outline',
    items: [
      { name: 'Greek yogurt', calories: 100 },
      { name: 'Almonds (10 pcs)', calories: 40 },
    ],
  },
  {
    id: '4',
    type: 'Dinner',
    time: '—',
    totalCalories: 0,
    icon: 'moon-outline',
    items: [],
  },
];

export const mealCategories = [
  'Fruits',
  'Vegetables',
  'Grains',
  'Protein',
  'Dairy',
  'Beverages',
  'Snacks',
  'Custom',
];

export const quickAddFoods = [
  { name: 'Apple', calories: 95, serving: '1 medium' },
  { name: 'Banana', calories: 115, serving: '1 medium' },
  { name: 'Chicken Breast', calories: 165, serving: '100g' },
  { name: 'Brown Rice', calories: 216, serving: '1 cup cooked' },
  { name: 'Egg', calories: 78, serving: '1 large' },
  { name: 'Greek Yogurt', calories: 100, serving: '170g' },
  { name: 'Salmon', calories: 208, serving: '100g' },
  { name: 'Spinach Salad', calories: 7, serving: '1 cup' },
  { name: 'Whole Wheat Bread', calories: 80, serving: '1 slice' },
  { name: 'Almonds', calories: 160, serving: '28g' },
];
