/**
 * Utility functions for formatting file sizes, dates, semesters, and category themes.
 */

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(isoDateString: string | null | undefined): string {
  if (!isoDateString) return 'Recently';

  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return 'Recently';

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return 'Recently';
  }
}

export function getSemesterOrdinal(semester: number): string {
  const ordinals = [
    '1st',
    '2nd',
    '3rd',
    '4th',
    '5th',
    '6th',
    '7th',
    '8th',
    '9th',
    '10th',
    '11th',
    '12th',
  ];
  return ordinals[semester - 1] || `${semester}th`;
}

export function getSemesterLabel(semester: number): string {
  return `${getSemesterOrdinal(semester)} Semester`;
}

export interface CategoryTheme {
  bg: string;
  text: string;
  border: string;
  badge: string;
  ring: string;
}

export function getCategoryTheme(categoryName: string = ''): CategoryTheme {
  const normalized = categoryName.toLowerCase();

  if (normalized.includes('note') || normalized.includes('lecture')) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      ring: 'focus:ring-blue-500',
    };
  }

  if (normalized.includes('lab') || normalized.includes('manual')) {
    return {
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-800 border-teal-200',
      ring: 'focus:ring-teal-500',
    };
  }

  if (
    normalized.includes('question') ||
    normalized.includes('exam') ||
    normalized.includes('paper')
  ) {
    return {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      ring: 'focus:ring-amber-500',
    };
  }

  if (normalized.includes('syllabus')) {
    return {
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      ring: 'focus:ring-purple-500',
    };
  }

  // Reference materials / fallback
  return {
    bg: 'bg-[#E5EEE8]',
    text: 'text-[#164A41]',
    border: 'border-[#CBDAD0]',
    badge: 'bg-[#E5EEE8] text-[#164A41] border-[#CBDAD0]',
    ring: 'focus:ring-[#164A41]',
  };
}
