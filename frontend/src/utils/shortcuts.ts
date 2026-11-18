import type { Category, Course } from '../types/api';

export function getLibraryShortcuts(courses: Course[], categories: Category[]) {
  const featured = [
    { label: 'Database Systems', name: 'Database Management Systems' },
    { label: 'Operating Systems', name: 'Operating Systems' },
    { label: 'Web Engineering', name: 'Web Engineering' },
    { label: 'Data Structures', name: 'Data Structures' },
  ];
  const shortcuts = featured.flatMap(({ label, name }) => {
    const course = courses.find((item) => item.name === name);
    return course ? [{ label, href: `/resources?course_id=${course.id}` }] : [];
  });
  const pastQuestions = categories.find((item) => item.name === 'Past Questions');
  if (pastQuestions) shortcuts.push({ label: 'Past Questions', href: `/resources?category_id=${pastQuestions.id}` });
  return shortcuts;
}
