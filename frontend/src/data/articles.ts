/**
 * Mock articles data for Explore screen
 */

export interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  categoryId: string;
  readTime: string;
  author: string;
  date: string;
  content: string;
}

export const exploreCategories = [
  { id: 'all', label: "category.all", icon: 'apps-outline', color: '#0EA5A4', bgColor: '#EAF8F7' },
  { id: 'nutrition', label: "health.nutrition", icon: 'nutrition-outline', color: '#F4A261', bgColor: '#FFF2E6' },
  { id: 'fitness', label: "category.fitness", icon: 'fitness-outline', color: '#0EA5A4', bgColor: '#EAF8F7' },
  { id: 'running', label: "category.running", icon: 'walk-outline', color: '#5B8DEF', bgColor: '#EDF3FF' },
  { id: 'sleep', label: "health.sleep", icon: 'moon-outline', color: '#9B85CE', bgColor: '#F4F0FB' },
  { id: 'mental', label: "category.wellness", icon: 'leaf-outline', color: '#39A983', bgColor: '#E8F8F0' },
  { id: 'habits', label: "category.habits", icon: 'checkmark-circle-outline', color: '#EA777A', bgColor: '#FFF0F0' },
];

export const articles: Article[] = [
  {
    id: '1',
    title: "articles.items.article1.title",
    description: "articles.items.article1.description",
    category: "health.sleep",
    categoryId: 'sleep',
    readTime: '5 min read',
    author: 'Dr. Sarah Chen',
    date: 'Oct 24, 2026',
    content: "articles.items.article1.content",
  },
  {
    id: '2',
    title: "articles.items.article2.title",
    description: "articles.items.article2.description",
    category: "health.nutrition",
    categoryId: 'nutrition',
    readTime: '6 min read',
    author: 'Maria Torres',
    date: 'Oct 22, 2026',
    content: "articles.items.article2.content",
  },
  {
    id: '3',
    title: "articles.items.article3.title",
    description: "articles.items.article3.description",
    category: "category.fitness",
    categoryId: 'fitness',
    readTime: '4 min read',
    author: 'James Wilson',
    date: 'Oct 20, 2026',
    content: "articles.items.article3.content",
  },
  {
    id: '4',
    title: "articles.items.article4.title",
    description: "articles.items.article4.description",
    category: "category.habits",
    categoryId: 'habits',
    readTime: '3 min read',
    author: 'Dr. Lisa Park',
    date: 'Oct 18, 2026',
    content: "articles.items.article4.content",
  },
  {
    id: '5',
    title: "articles.items.article5.title",
    description: "articles.items.article5.description",
    category: "category.fitness",
    categoryId: 'fitness',
    readTime: '4 min read',
    author: 'Coach Amy Lin',
    date: 'Oct 16, 2026',
    content: "articles.items.article5.content",
  },
];

export const featuredArticle = articles[0];
