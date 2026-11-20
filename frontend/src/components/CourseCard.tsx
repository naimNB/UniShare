import { Link } from 'react-router-dom';
import { BookOpen, Files, ArrowRight } from 'lucide-react';
import type { Course } from '../types/api';
import { getSemesterLabel } from '../utils/formatters';

interface CourseCardProps {
  course: Course;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <div className="group bg-white rounded-xl border border-[#DDE3DC] hover:border-[#CBDAD0] shadow-2xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between overflow-hidden">
      <div className="p-5 sm:p-6 flex-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#E5EEE8] text-[#164A41] border border-[#CBDAD0]">
              <BookOpen className="w-3.5 h-3.5" />
              {course.code}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[#F6F4EF] text-[#1D2933] border border-[#DDE3DC]">
              {(course.credits ?? 3.0).toFixed(2)} {course.credits === 1 ? 'Credit' : 'Credits'}
            </span>
          </div>
          <span className="text-xs font-medium text-[#566775]">
            {getSemesterLabel(course.semester)}
          </span>
        </div>

        <h3 className="text-base sm:text-lg font-bold text-[#1D2933] group-hover:text-[#164A41] transition-colors mb-2 leading-snug">
          <Link to={`/courses/${course.id}`}>{course.name}</Link>
        </h3>

        {course.description && (
          <p className="text-xs sm:text-sm text-[#566775] line-clamp-2 leading-relaxed mb-4">
            {course.description}
          </p>
        )}
      </div>

      <div className="px-5 sm:px-6 py-3 bg-[#F6F4EF] border-t border-[#DDE3DC] flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#566775]">
          <Files className="w-3.5 h-3.5 text-[#164A41]" />
          {course.resource_count > 0 ? (
            `${course.resource_count} ${course.resource_count === 1 ? 'material' : 'materials'}`
          ) : (
            <span className="text-[#566775] font-normal">No materials yet</span>
          )}
        </span>

        <Link
          to={`/courses/${course.id}`}
          className="inline-flex items-center gap-1 text-xs font-bold text-[#164A41] group-hover:text-[#103831] transition-colors"
        >
          View Resources
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
