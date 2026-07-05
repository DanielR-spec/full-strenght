import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, ListFilter, RotateCcw, AlertCircle } from 'lucide-react';
import { apiClient, getApiUrl } from '../api/client';
import { WorkoutCard } from '../components/WorkoutCard';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const apiUrl = getApiUrl();

  const { 
    data: workouts, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['workouts'],
    queryFn: apiClient.getWorkouts,
    enabled: !!apiUrl
  });

  if (!apiUrl) {
    return (
      <div className="space-y-6 py-12 text-center animate-in fade-in duration-200">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 border border-rose-500/25 text-rose-450 mb-2">
          <AlertCircle className="h-8 w-8 stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-extrabold font-heading text-zinc-100">
            API URL Config Required
          </h1>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Please create a <code className="text-emerald-450 font-mono">.env</code> file in the project root and define your Google Apps Script Web App URL:
          </p>
          <pre className="inline-block bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-[11px] text-left text-zinc-300 font-mono select-all">
            VITE_GAS_API_URL=https://script.google.com/macros/s/.../exec
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-6 animate-in fade-in duration-200">
      {/* Title block */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-heading tracking-tight text-zinc-100">
            Workouts
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Your digital lifting notebook
          </p>
        </div>
        
        {workouts && workouts.length > 0 && (
          <div className="flex items-center text-xs text-zinc-500 font-semibold gap-1 bg-zinc-900/50 px-2.5 py-1.5 rounded-lg border border-zinc-900">
            <ListFilter className="h-3 w-3 text-emerald-500" />
            <span>{workouts.length} logged</span>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-rotate" style={{ animation: 'spin 1s linear infinite' }}></div>
          <span className="text-zinc-500 text-xs font-medium">Fetching workouts...</span>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-2xl p-5 text-center space-y-4">
          <div className="flex justify-center text-rose-500">
            <AlertCircle className="h-10 w-10 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">Connection Error</h3>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              {error instanceof Error ? error.message : 'Could not reach the database. Verify your Sheets API URL settings.'}
            </p>
          </div>
          <button 
            type="button" 
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-zinc-100"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* Success State - Feed */}
      {workouts && !isLoading && !isError && (
        <>
          {workouts.length === 0 ? (
            <div className="bg-zinc-900/20 border border-dashed border-zinc-900 rounded-3xl p-10 text-center space-y-5">
              <div className="mx-auto w-12 h-12 bg-zinc-900 border border-zinc-850 rounded-2xl flex items-center justify-center text-zinc-400">
                <Plus className="h-6 w-6 stroke-[1.5]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold font-heading text-zinc-300">Notebook Empty</h3>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Log your first lifting session using the action button below to start tracking your progressive overload.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => navigate('/workouts/new')}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
              >
                Log First Session
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {workouts.map((w) => (
                <WorkoutCard key={w.id} workout={w} />
              ))}
            </div>
          )}

          {/* Floating Action Button */}
          <button
            type="button"
            onClick={() => navigate('/workouts/new')}
            title="Log Workout"
            className="fixed bottom-24 right-4 md:right-[calc(50%-200px)] z-30 p-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-zinc-950 rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all select-none focus:outline-hidden"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </>
      )}
    </div>
  );
};
