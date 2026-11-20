import type { Category, Course } from '../types/api';

export function getLibraryShortcuts(courses: Course[], categories: Category[]) {
  const featured = [
    {
      label: 'Database Systems',
      matches: (name: string) => {
        const lower = name.toLowerCase();
        return lower === 'database management systems' || lower === 'database management system';
      },
    },
    {
      label: 'Operating Systems',
      matches: (name: string) => name.toLowerCase() === 'operating systems',
    },
    {
      label: 'Web Engineering',
      matches: (name: string) => name.toLowerCase() === 'web engineering',
    },
    {
      label: 'Data Structures',
      matches: (name: string) => {
        const lower = name.toLowerCase();
        return lower === 'data structures' || lower === 'data structure';
      },
    },
  ];
  const shortcuts = featured.flatMap(({ label, matches }) => {
    const course = courses.find((item) => matches(item.name));
    return course ? [{ label, href: `/resources?course_id=${course.id}` }] : [];
  });
  const pastQuestions = categories.find((item) => item.name === 'Past Questions');
  if (pastQuestions) shortcuts.push({ label: 'Past Questions', href: `/resources?category_id=${pastQuestions.id}` });
  return shortcuts;
}
