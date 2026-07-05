import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Dumbbell, Calendar, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { formatDate as formatDateUtil } from '../utils/date';
import { getEmbeddableImageUrl } from '../utils/media';

export const ExerciseSearch: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch unique exercises (via Suggestions endpoint)
  const { data: exercises = [], isLoading, isError } = useQuery({
    queryKey: ['suggestions'],
    queryFn: apiClient.getExerciseSuggestions
  });

  // Filter exercises by query
  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check if there is an exact case-insensitive match
    const exactMatch = exercises.find(
      ex => ex.name.toLowerCase().trim() === searchQuery.toLowerCase().trim()
    );

    if (exactMatch) {
      navigate(`/exercises/${encodeURIComponent(exactMatch.name)}`);
    } else {
      // Navigate to the typed query anyway (might be a new exercise history search)
      navigate(`/exercises/${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-extrabold font-heading tracking-tight text-zinc-100">
          Exercise Library
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          History, image references, and progress logs
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <label htmlFor="library-search" className="sr-only">Search Exercises</label>
        <input
          id="library-search"
          type="text"
          placeholder="Search for an exercise... (e.g., Pull Ups)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-650"
        />
        <Search className="h-4.5 w-4.5 text-zinc-600 absolute left-4 top-[17px]" />
      </form>

      {/* Loading Spinner */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-rotate" style={{ animation: 'spin 1s linear infinite' }}></div>
          <span className="text-zinc-500 text-xs font-medium">Loading exercises library...</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="text-center py-10 bg-zinc-950/50 rounded-2xl border border-zinc-900 text-rose-500 text-xs">
          Error retrieving exercise suggestions. Verify connection settings.
        </div>
      )}

      {/* Exercises Cards Feed */}
      {exercises && !isLoading && !isError && (
        <div className="space-y-3">
          {filteredExercises.length === 0 ? (
            <div className="text-center py-12 bg-zinc-950/20 border border-dashed border-zinc-905 rounded-3xl space-y-4">
              <div className="mx-auto w-10 h-10 bg-zinc-90 w bg-zinc-900/50 rounded-xl flex items-center justify-center text-zinc-500">
                <Search className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold font-heading text-zinc-400">No Exercises Found</h3>
                <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">
                  {searchQuery ? `No elements match "${searchQuery}". Press Enter to query search anyway.` : 'No exercises logged yet.'}
                </p>
              </div>
            </div>
          ) : (
            filteredExercises.map((ex, index) => (
              <Link
                key={index}
                to={`/exercises/${encodeURIComponent(ex.name)}`}
                className="flex items-center justify-between p-3.5 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 rounded-2xl transition-all duration-150 active:scale-[0.99] group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  {/* Thumbnail Image or Fallback Accent Icon */}
                  <div className="h-12 w-12 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center shrink-0 overflow-hidden">
                    {ex.imageUrl ? (
                      <img 
                        src={getEmbeddableImageUrl(ex.imageUrl)} 
                        alt={ex.name} 
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          // Hide broken image, show fallback
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Dumbbell className="h-5 w-5 text-emerald-500/80" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h3 className="font-bold text-sm text-zinc-200 group-hover:text-emerald-400 transition-colors truncate">
                      {ex.name}
                    </h3>
                    <div className="flex items-center text-[10px] text-zinc-500 font-medium space-x-2">
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-600" />
                        <span>Last: {formatDate(ex.date)}</span>
                      </span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-zinc-400 font-semibold">{ex.weight} {ex.unit}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight className="h-5 w-5 text-zinc-650 group-hover:text-zinc-400 transition-all select-none" />
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
};
