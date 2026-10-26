/**
 * Mock articles data for Explore screen
 */

export interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  author: string;
  date: string;
  content: string;
}

export const exploreCategories = [
  { id: 'all', label: 'All', icon: 'apps-outline', color: '#0EA5A4', bgColor: '#EAF8F7' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition-outline', color: '#F4A261', bgColor: '#FFF2E6' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness-outline', color: '#0EA5A4', bgColor: '#EAF8F7' },
  { id: 'running', label: 'Running', icon: 'walk-outline', color: '#5B8DEF', bgColor: '#EDF3FF' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline', color: '#9B85CE', bgColor: '#F4F0FB' },
  { id: 'mental', label: 'Wellness', icon: 'leaf-outline', color: '#39A983', bgColor: '#E8F8F0' },
  { id: 'habits', label: 'Habits', icon: 'checkmark-circle-outline', color: '#EA777A', bgColor: '#FFF0F0' },
];

export const articles: Article[] = [
  {
    id: '1',
    title: 'Simple ways to improve your sleep quality',
    description: 'Discover practical tips for better rest that you can start implementing tonight.',
    category: 'Sleep',
    readTime: '5 min read',
    author: 'Dr. Sarah Chen',
    date: 'Oct 24, 2026',
    content: `Getting quality sleep is one of the most important things you can do for your health. Here are some practical strategies that can help you sleep better starting tonight.

## Create a consistent schedule

Going to bed and waking up at the same time every day helps regulate your body\'s internal clock. Try to stick to your schedule even on weekends.

## Optimize your environment

Keep your bedroom cool (around 18-20°C), dark, and quiet. Consider using blackout curtains and a white noise machine if needed.

## Wind down before bed

Create a relaxing pre-sleep routine. This might include reading, gentle stretching, or meditation. Avoid screens for at least 30 minutes before bed.

## Watch what you eat and drink

Avoid large meals, caffeine, and alcohol close to bedtime. If you're hungry, opt for a light snack like a small banana or a handful of almonds.

## Stay active during the day

Regular physical activity can help you fall asleep faster and enjoy deeper sleep. Just avoid vigorous exercise close to bedtime.

## Manage stress

Practice relaxation techniques like deep breathing or progressive muscle relaxation. Journaling before bed can also help clear your mind.

*This article is for informational purposes only and does not constitute medical advice.*`,
  },
  {
    id: '2',
    title: 'Healthy meal planning for busy days',
    description: 'Learn how to prepare nutritious meals even when your schedule is packed.',
    category: 'Nutrition',
    readTime: '6 min read',
    author: 'Maria Torres',
    date: 'Oct 22, 2026',
    content: `Eating well doesn't have to be complicated or time-consuming. With a little planning, you can enjoy nutritious meals throughout even the busiest days.

## Start with a weekly plan

Spend 15 minutes on Sunday planning your meals for the week. Focus on simple recipes that share ingredients to minimize waste and shopping time.

## Prep in batches

Cook grains, proteins, and vegetables in bulk. Store them in portion-sized containers so you can mix and match throughout the week.

## Keep it simple

A balanced meal doesn't need to be elaborate. Aim for a protein source, a complex carbohydrate, and plenty of vegetables at each meal.

## Smart snacking

Keep healthy snacks readily available: nuts, fruits, yogurt, and cut vegetables. Having good options on hand prevents reaching for processed alternatives.

## Stay hydrated

Sometimes hunger is actually thirst. Keep a water bottle with you and aim for at least 8 glasses throughout the day.

*This article is for informational purposes only and does not constitute medical advice.*`,
  },
  {
    id: '3',
    title: 'Benefits of regular walking',
    description: 'Walking is one of the easiest and most effective forms of exercise. Here\'s why.',
    category: 'Fitness',
    readTime: '4 min read',
    author: 'James Wilson',
    date: 'Oct 20, 2026',
    content: `Walking is often overlooked as exercise, but it offers remarkable health benefits that are backed by research.

## Cardiovascular health

Regular walking helps strengthen your heart, lower blood pressure, and improve circulation. Even 30 minutes a day can make a significant difference.

## Mental wellness

Walking outdoors has been shown to reduce stress, anxiety, and symptoms of depression. The combination of gentle movement and fresh air is a powerful mood booster.

## Weight management

A brisk 30-minute walk burns approximately 150-200 calories. Combined with a balanced diet, regular walking can help maintain a healthy weight.

## Joint health

Unlike high-impact exercises, walking is gentle on your joints while still strengthening the muscles that support them.

## Getting started

Start with short walks and gradually increase your distance and pace. Aim for at least 10,000 steps per day, but remember that any amount of walking is better than none.

*This article is for informational purposes only and does not constitute medical advice.*`,
  },
  {
    id: '4',
    title: 'Staying hydrated throughout the day',
    description: 'Practical strategies to ensure you\'re drinking enough water every day.',
    category: 'Habits',
    readTime: '3 min read',
    author: 'Dr. Lisa Park',
    date: 'Oct 18, 2026',
    content: `Proper hydration is essential for nearly every function in your body. Here's how to make sure you're getting enough water.

## Know your needs

A general guideline is to drink about 2-2.5 liters of water per day, but individual needs vary based on activity level, climate, and body size.

## Set reminders

Use your phone or a smart water bottle to remind you to drink regularly. Small, frequent sips throughout the day are more effective than drinking large amounts at once.

## Eat your water

Many fruits and vegetables have high water content. Watermelon, cucumber, oranges, and strawberries are excellent choices.

## Make it enjoyable

If plain water feels boring, try adding slices of lemon, cucumber, or fresh mint. Herbal teas also count toward your daily intake.

*This article is for informational purposes only and does not constitute medical advice.*`,
  },
  {
    id: '5',
    title: '5-minute morning stretches for energy',
    description: 'Start your day right with these simple stretches that boost energy and flexibility.',
    category: 'Fitness',
    readTime: '4 min read',
    author: 'Coach Amy Lin',
    date: 'Oct 16, 2026',
    content: `A short morning stretch routine can set a positive tone for your entire day. These gentle movements help wake up your muscles and improve flexibility.

## Cat-Cow stretch

Start on all fours, alternating between arching and rounding your back. Repeat 8-10 times, moving slowly with your breath.

## Standing forward fold

Stand with feet hip-width apart, slowly fold forward from the hips. Let your arms hang or hold opposite elbows. Hold for 30 seconds.

## Chest opener

Clasp your hands behind your back, straighten your arms, and gently lift them while opening your chest. Hold for 20 seconds.

## Gentle spinal twist

Sit cross-legged, place one hand on the opposite knee and twist gently. Hold for 20 seconds on each side.

## Side stretch

Stand tall, raise one arm overhead and lean to the opposite side. Feel the stretch along your side body. Hold for 20 seconds on each side.

*Always listen to your body and avoid pushing through pain.*`,
  },
];

export const featuredArticle = articles[0];
