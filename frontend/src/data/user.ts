/**
 * Mock user data
 */

export const mockUser = {
  id: '1',
  name: 'Alex',
  fullName: 'Alex Johnson',
  email: 'alex.johnson@email.com',
  age: 28,
  height: 172, // cm
  weight: 68, // kg
  gender: 'Female' as const,
  avatarInitials: 'AJ',
  dailyGoals: {
    steps: 15000,
    calories: 1600,
    water: 2500, // ml
    sleep: 8, // hours
    activeMinutes: 60,
  },
  preferences: {
    units: 'Metric' as const,
    language: 'English' as const,
    theme: 'Light' as const,
    notifications: true,
  },
};

export type User = typeof mockUser;
