import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Activity } from 'lucide-react';
import type { WorkoutSummary } from '../types';
import { formatDate } from '../utils/date';

interface WorkoutCardProps {
  workout: WorkoutSummary;
}

export const WorkoutCard: React.FC<WorkoutCardProps> = ({ workout }) => {
  return (
    <Link 
      to={`/workouts/${workout.id}`}
      className="block bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 transition-all duration-200 group active:scale-[0.99] active:bg-zinc-900/90"
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-base font-bold font-heading text-zinc-100 group-hover:text-emerald-400 transition-colors">
              {workout.name}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center text-xs text-zinc-500 gap-1.5 pt-0.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(workout.date)}</span>
          </div>
        </div>

        {/* Exercises Badges + Arrow */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center gap-1 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-850">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-zinc-300">
              {workout.exerciseCount} {workout.exerciseCount === 1 ? 'exercise' : 'exercises'}
            </span>
          </div>
          
          <ChevronRight className="h-5 w-5 text-zinc-650 group-hover:text-zinc-400 transition-all group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
};
