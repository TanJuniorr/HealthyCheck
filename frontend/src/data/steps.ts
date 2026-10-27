/**
 * Mock steps tracking data
 */

export const stepsData = {
  current: 11857,
  goal: 15000,
  progress: 0.79, // 11857 / 15000
  calories: 487,
  distance: 8.3, // km
  activeMinutes: 62,
  floors: 8,
};

export const stepsWeekly = [
  { day: "weekday.mon", steps: 12340, goal: 15000 },
  { day: "weekday.tue", steps: 9870, goal: 15000 },
  { day: "weekday.wed", steps: 14200, goal: 15000 },
  { day: "weekday.thu", steps: 11050, goal: 15000 },
  { day: "weekday.fri", steps: 13500, goal: 15000 },
  { day: "weekday.sat", steps: 8600, goal: 15000 },
  { day: "weekday.sun", steps: 11857, goal: 15000 },
];

export const stepsHourly = [
  { hour: '6am', steps: 200 },
  { hour: '7am', steps: 3200 },
  { hour: '8am', steps: 1800 },
  { hour: '9am', steps: 900 },
  { hour: '10am', steps: 600 },
  { hour: '11am', steps: 1200 },
  { hour: '12pm', steps: 800 },
  { hour: '1pm', steps: 500 },
  { hour: '2pm', steps: 400 },
  { hour: '3pm', steps: 700 },
  { hour: '4pm', steps: 900 },
  { hour: '5pm', steps: 657 },
];

export const stepsMonthly = [
  { week: 'W1', avg: 10200 },
  { week: 'W2', avg: 11500 },
  { week: 'W3', avg: 9800 },
  { week: 'W4', avg: 11857 },
];
