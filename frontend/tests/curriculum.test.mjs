import test from 'node:test';
import assert from 'node:assert/strict';
import { getLibraryShortcuts } from '../src/utils/shortcuts.ts';
import { getSemesterLabel } from '../src/utils/formatters.ts';

test('homepage shortcuts match official singular curriculum names', () => {
  const officialCourses = [
    { id: 29, name: 'Database Management System', code: 'CSE 2103', semester: 4, credits: 3.0, display_order: 2, year: 2, term: 2, description: null, resource_count: 4 },
    { id: 39, name: 'Operating Systems', code: 'CSE 3103', semester: 5, credits: 3.0, display_order: 3, year: 3, term: 1, description: null, resource_count: 2 },
    { id: 41, name: 'Web Engineering', code: 'CSE 2201', semester: 5, credits: 3.0, display_order: 5, year: 3, term: 1, description: null, resource_count: 2 },
    { id: 21, name: 'Data Structure', code: 'CSE 1201', semester: 3, credits: 3.0, display_order: 3, year: 2, term: 1, description: null, resource_count: 1 },
  ];
  const categories = [
    { id: 3, name: 'Past Questions', description: null, resource_count: 2 },
  ];

  const shortcuts = getLibraryShortcuts(officialCourses, categories);
  assert.deepEqual(shortcuts, [
    { label: 'Database Systems', href: '/resources?course_id=29' },
    { label: 'Operating Systems', href: '/resources?course_id=39' },
    { label: 'Web Engineering', href: '/resources?course_id=41' },
    { label: 'Data Structures', href: '/resources?course_id=21' },
    { label: 'Past Questions', href: '/resources?category_id=3' },
  ]);
});

test('semester and academic year derivations for 1 to 8', () => {
  const expectedSemesters = [
    { sem: 1, year: 1, term: 1, label: '1st Semester' },
    { sem: 2, year: 1, term: 2, label: '2nd Semester' },
    { sem: 3, year: 2, term: 1, label: '3rd Semester' },
    { sem: 4, year: 2, term: 2, label: '4th Semester' },
    { sem: 5, year: 3, term: 1, label: '5th Semester' },
    { sem: 6, year: 3, term: 2, label: '6th Semester' },
    { sem: 7, year: 4, term: 1, label: '7th Semester' },
    { sem: 8, year: 4, term: 2, label: '8th Semester' },
  ];

  for (const { sem, year, term, label } of expectedSemesters) {
    assert.equal(Math.ceil(sem / 2), year);
    assert.equal(sem % 2 === 1 ? 1 : 2, term);
    assert.equal(getSemesterLabel(sem), label);
  }
});

test('semester credit summing preserves precision', () => {
  const sem1Credits = [3.00, 1.00, 3.00, 1.00, 3.00, 3.00, 3.00, 1.00, 2.00];
  const total = sem1Credits.reduce((sum, c) => sum + c, 0);
  assert.equal(total.toFixed(2), '20.00');

  const allCredits = [20.0, 19.0, 20.0, 21.0, 21.0, 20.0, 19.0, 21.0];
  const grandTotal = allCredits.reduce((sum, c) => sum + c, 0);
  assert.equal(grandTotal.toFixed(2), '161.00');
});
