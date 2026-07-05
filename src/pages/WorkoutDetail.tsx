import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit2, Trash2, Calendar, MessageSquare, ExternalLink } from 'lucide-react';
import { apiClient } from '../api/client';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatDate as formatDateUtil } from '../utils/date';
import { getEmbeddableImageUrl, getEmbeddableVideoUrl } from '../utils/media';

export const WorkoutDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Fetch Workout Details
  const { data: workout, isLoading, isError, error } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => apiClient.getWorkoutDetail(id || ''),
    enabled: !!id
  });

  // Mutate Delete Workout
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteWorkout(id || ''),
    onSuccess: () => {
      // Invalidate queries so feed updates
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      // Redirect home
      navigate('/');
    }
  });

  const handleDeleteConfirm = () => {
    deleteMutation.mutate();
  };

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-rotate" style={{ animation: 'spin 1s linear infinite' }}></div>
        <span className="text-zinc-500 text-xs">Loading workout details...</span>
      </div>
    );
  }

  if (isError || !workout) {
    return (
      <div className="space-y-4 py-12 text-center">
        <div className="text-rose-500 font-bold mb-2">Error Loading Workout</div>
        <p className="text-zinc-500 text-xs max-w-xs mx-auto">
          {error instanceof Error ? error.message : 'The requested workout could not be retrieved.'}
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-500"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Workouts
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-300 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Workouts
        </button>

        <div className="flex items-center space-x-2">
          <Link
            to={`/workouts/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-xl text-xs font-semibold text-zinc-300 transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Link>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-955 border border-rose-955/40 hover:bg-rose-955/20 rounded-xl text-xs font-semibold text-rose-500 transition-colors focus:outline-hidden cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Main Stats Header */}
      <div className="border-b border-zinc-900 pb-5 space-y-1.5">
        <h1 className="text-3xl font-extrabold font-heading tracking-tight text-zinc-100">
          {workout.name}
        </h1>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          <Calendar className="h-4 w-4 text-emerald-500" />
          <span>{formatDate(workout.date)}</span>
        </div>
      </div>

      {/* Exercises Logged */}
      <div className="space-y-4">
        {workout.exercises.length === 0 ? (
          <div className="text-center py-10 bg-zinc-955/50 rounded-2xl border border-zinc-900 text-zinc-500 text-xs">
            No exercises recorded in this session.
          </div>
        ) : (
          workout.exercises.map((ex, index) => (
            <div 
              key={index} 
              className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 space-y-3.5 relative overflow-hidden"
            >
              {/* Exercise Name linking to history */}
              <div className="flex justify-between items-start">
                <Link 
                  to={`/exercises/${encodeURIComponent(ex.name)}`}
                  className="font-bold text-base font-heading text-zinc-200 hover:text-emerald-400 group flex items-center gap-1.5 transition-colors"
                >
                  <span>{ex.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-650 group-hover:text-emerald-500 transition-all opacity-0 group-hover:opacity-100" />
                </Link>
              </div>

              {/* Data Row - Large stats grid */}
              <div className="grid grid-cols-3 gap-2 text-center bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900/50">
                <div className="py-1">
                  <div className="text-xs text-zinc-500 font-medium mb-0.5">Weight</div>
                  <div className="text-sm font-bold font-heading text-zinc-200">
                    {ex.weight} {ex.unit !== 'BW' && ex.unit}
                  </div>
                </div>
                <div className="py-1 border-l border-zinc-900">
                  <div className="text-xs text-zinc-500 font-medium mb-0.5">Sets</div>
                  <div className="text-sm font-bold font-heading text-zinc-200">
                    {ex.sets} {ex.sets === 1 ? 'set' : 'sets'}
                  </div>
                </div>
                <div className="py-1 border-l border-zinc-900">
                  <div className="text-xs text-zinc-500 font-medium mb-0.5">Reps</div>
                  <div className="text-sm font-bold font-heading text-zinc-200">
                    {ex.reps} {ex.reps === 1 ? 'rep' : 'reps'}
                  </div>
                </div>
              </div>

              {/* Optional Notes, Images, and Videos */}
              {(ex.notes || ex.imageUrl || ex.machineImageUrl || ex.videoUrl) && (
                <div className="pt-1.5 flex flex-col gap-2.5">
                  {ex.notes && (
                    <div className="flex gap-2 text-xs text-zinc-400 leading-normal bg-zinc-950/20 p-2.5 rounded-xl border border-zinc-900/35">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-500/80 shrink-0 mt-0.5" />
                      <p className="italic">{ex.notes}</p>
                    </div>
                  )}

                  {/* Machine Image & Performance Video */}
                  {((ex.machineImageUrl && ex.machineImageUrl !== ex.imageUrl) || ex.videoUrl) && (
                    <div className={`grid grid-cols-1 ${
                      (ex.machineImageUrl && ex.machineImageUrl !== ex.imageUrl) && ex.videoUrl 
                        ? 'sm:grid-cols-2' 
                        : ''
                    } gap-3 mt-1`}>
                      {ex.machineImageUrl && ex.machineImageUrl !== ex.imageUrl && (
                        <div className="rounded-xl overflow-hidden border border-zinc-850 bg-zinc-950 max-h-48 relative flex flex-col justify-end">
                          <img 
                            src={getEmbeddableImageUrl(ex.machineImageUrl)} 
                            alt="Machine" 
                            className="w-full h-full object-cover max-h-48"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-[9px] px-2 py-0.5 rounded-lg text-zinc-300 font-bold uppercase tracking-wider">
                            Machine Photo
                          </span>
                        </div>
                      )}

                      {ex.videoUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-850 bg-zinc-950 h-48">
                          <iframe
                              src={getEmbeddableVideoUrl(ex.videoUrl)}
                              className="absolute inset-0 w-full h-full border-0"
                              allow="autoplay; fullscreen"
                              allowFullScreen
                          />
                          <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-[9px] px-2 py-0.5 rounded-lg text-zinc-300 font-bold uppercase tracking-wider pointer-events-none z-10">
                            Execution Video
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        title="Delete Workout Session"
        message={`Are you sure you want to permanently delete "${workout.name}" logged on ${formatDate(workout.date)}? This action is permanent and cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setIsDeleteOpen(false)}
        isSubmitting={deleteMutation.isPending}
      />
    </div>
  );
};
