import { Link } from 'react-router-dom';
import { BookOpen, Files, ArrowRight } from 'lucide-react';
import type { Course } from '../types/api';
import { getSemesterLabel } from '../utils/formatters';

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="group bg-white rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
      <div className="p-5 sm:p-6 flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <BookOpen className="w-3.5 h-3.5" />
            {course.code}
          </span>
          <span className="text-xs font-medium text-slate-500">
            {getSemesterLabel(course.semester)}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors mb-2 leading-snug">
          <Link to={`/courses/${course.id}`}>{course.name}</Link>
        </h3>

        {course.description && (
          <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed mb-4">
            {course.description}
          </p>
        )}
      </div>

      <div className="px-5 sm:px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <Files className="w-3.5 h-3.5 text-indigo-500" />
          {course.resource_count} {course.resource_count === 1 ? 'material' : 'materials'}
        </span>

        <Link
          to={`/courses/${course.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors"
        >
          View Resources
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
