import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Plus, Trash2, Check, Sparkles, ChevronDown, Camera, Video, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Exercise, ExerciseSuggestion } from '../types';
import { formatDate as formatDateUtil } from '../utils/date';
import { getEmbeddableImageUrl } from '../utils/media';

interface WorkoutFormValues {
  name: string;
  date: string;
  exercises: {
    name: string;
    weight: string;
    unit: 'kg' | 'lb' | 'BW';
    sets: number;
    reps: number;
    notes: string;
    imageUrl: string;
    machineImageUrl: string;
    videoUrl: string;
  }[];
}

export const WorkoutForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Active suggesting index state
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const autocompleteRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Tracks upload state per exercise row and media type
  const [uploadStates, setUploadStates] = useState<Record<number, { machine?: 'idle' | 'uploading' | 'success' | 'error'; video?: 'idle' | 'uploading' | 'success' | 'error' }>>({});

  // Fetch Suggestions cache
  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions'],
    queryFn: apiClient.getExerciseSuggestions
  });

  // Fetch target workout if inside Edit Mode
  const { data: workoutToEdit, isLoading: isWorkoutLoading } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => apiClient.getWorkoutDetail(id || ''),
    enabled: isEditMode
  });

  const getLocalDateString = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<WorkoutFormValues>({
    defaultValues: {
      name: '',
      date: getLocalDateString(),
      exercises: [{ name: '', weight: '', unit: 'kg', sets: 4, reps: 8, notes: '', imageUrl: '', machineImageUrl: '', videoUrl: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "exercises"
  });

  // Keep a watch on exercises to show smart previous performance data live
  const watchedExercises = watch("exercises");

  // Populate data if in edit mode
  useEffect(() => {
    if (isEditMode && workoutToEdit) {
      reset({
        name: workoutToEdit.name,
        date: workoutToEdit.date,
        exercises: workoutToEdit.exercises.map(e => ({
          name: e.name,
          weight: e.weight.toString(),
          unit: e.unit,
          sets: Number(e.sets),
          reps: Number(e.reps),
          notes: e.notes || '',
          imageUrl: e.imageUrl || '',
          machineImageUrl: e.machineImageUrl || '',
          videoUrl: e.videoUrl || ''
        }))
      });
    }
  }, [isEditMode, workoutToEdit, reset]);

  // Handle autocomplete click
  const selectSuggestion = (index: number, sug: ExerciseSuggestion) => {
    setValue(`exercises.${index}.name`, sug.name);
    setValue(`exercises.${index}.imageUrl`, sug.imageUrl || '');
    setValue(`exercises.${index}.machineImageUrl`, sug.machineImageUrl || '');
    setValue(`exercises.${index}.videoUrl`, sug.videoUrl || '');
    setFocusedIndex(null);
  };

  // Find suggestion matching dynamic typed text
  const getPrevPerformance = (exerciseName: string): ExerciseSuggestion | undefined => {
    if (!exerciseName) return undefined;
    const cleanName = exerciseName.toLowerCase().trim();
    return suggestions.find(sug => sug.name.toLowerCase().trim() === cleanName);
  };

  // Run autofill
  const handleUsePrevious = (index: number, sug: ExerciseSuggestion) => {
    setValue(`exercises.${index}.weight`, sug.weight);
    setValue(`exercises.${index}.unit`, sug.unit);
    setValue(`exercises.${index}.sets`, sug.sets);
    setValue(`exercises.${index}.reps`, sug.reps);
    if (sug.imageUrl && !watchedExercises[index].imageUrl) {
      setValue(`exercises.${index}.imageUrl`, sug.imageUrl);
    }
    if (sug.machineImageUrl && !watchedExercises[index].machineImageUrl) {
      setValue(`exercises.${index}.machineImageUrl`, sug.machineImageUrl);
    }
    if (sug.videoUrl && !watchedExercises[index].videoUrl) {
      setValue(`exercises.${index}.videoUrl`, sug.videoUrl);
    }
  };

  // Handle file uploads directly to Google Drive via Apps Script
  const handleMediaUpload = async (index: number, type: 'machine' | 'video', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Set status to uploading
    setUploadStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        [type]: 'uploading'
      }
    }));

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
      });
      const dataUri = await base64Promise;

      const uploadResp = await apiClient.uploadFile(file.name, file.type, dataUri);

      if (uploadResp.success && uploadResp.downloadUrl) {
        if (type === 'machine') {
          setValue(`exercises.${index}.machineImageUrl`, uploadResp.downloadUrl);
        } else {
          setValue(`exercises.${index}.videoUrl`, uploadResp.downloadUrl);
        }

        setUploadStates(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            [type]: 'success'
          }
        }));
      } else {
        throw new Error("File upload was not acknowledged by Apps Script.");
      }
    } catch (err) {
      console.error("Media upload error:", err);
      alert("Failed to upload file to Google Drive. Keep in mind that file uploads require your Apps Script to be set up and authorize access to Google Drive.");
      setUploadStates(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          [type]: 'error'
        }
      }));
    }
  };

  // Create or Update mutation
  const saveMutation = useMutation({
    mutationFn: (data: WorkoutFormValues) => {
      // Clean exercise data structures
      const cleanExercises: Exercise[] = data.exercises.map(e => ({
        name: e.name.trim(),
        weight: e.weight || "0",
        unit: e.unit,
        sets: Number(e.sets || 4),
        reps: Number(e.reps || 4),
        notes: e.notes?.trim() || "",
        imageUrl: e.imageUrl?.trim() || "",
        machineImageUrl: e.machineImageUrl?.trim() || "",
        videoUrl: e.videoUrl?.trim() || ""
      }));

      const payload = {
        date: data.date,
        name: data.name.trim(),
        exercises: cleanExercises
      };

      if (isEditMode && id) {
        return apiClient.updateWorkout(id, payload);
      } else {
        return apiClient.createWorkout(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      if (isEditMode && id) {
        queryClient.invalidateQueries({ queryKey: ['workout', id] });
        navigate(`/workouts/${id}`);
      } else {
        // Redirect back home after creation
        navigate('/');
      }
    }
  });

  const onSubmit = (data: WorkoutFormValues) => {
    if (data.exercises.length === 0) {
      alert("Please add at least one exercise.");
      return;
    }
    saveMutation.mutate(data);
  };

  // Setup click-outside listener to close autocomplete dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (focusedIndex !== null) {
        const ref = autocompleteRefs.current[focusedIndex];
        if (ref && !ref.contains(e.target as Node)) {
          setFocusedIndex(null);
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [focusedIndex]);

  const formatDate = (dateStr: string) => {
    return formatDateUtil(dateStr);
  };

  if (isEditMode && isWorkoutLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-rotate" style={{ animation: 'spin 1s linear infinite' }}></div>
        <span className="text-zinc-500 text-xs">Loading workout data...</span>
      </div>
    );
  }

  // Pre-cached inputs for Exercise Names in Autocomplete suggestions
  const filterSuggestions = (typed: string) => {
    const cleanTyped = typed.toLowerCase().trim();
    if (!cleanTyped) return suggestions.slice(0, 5); // Default list when focused empty
    return suggestions.filter(sug => sug.name.toLowerCase().includes(cleanTyped)).slice(0, 5);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(isEditMode ? `/workouts/${id}` : '/')}
          className="flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-zinc-300 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel
        </button>
        
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400 font-heading">
          {isEditMode ? 'Edit Workout' : 'New Workout'}
        </h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Workout Info Box */}
        <div className="bg-zinc-900/50 border border-zinc-900 rounded-3xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Workout Name */}
            <div>
              <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                Workout Name
              </label>
              <input
                id="name"
                type="text"
                placeholder="E.g., 1U, Push, Legs"
                {...register("name", { required: "Name required" })}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-200 placeholder:text-zinc-650"
              />
              {errors.name && (
                <span className="text-[10px] text-rose-500 font-semibold mt-1 block pl-0.5">{errors.name.message}</span>
              )}
            </div>

            {/* Workout Date */}
            <div>
              <label htmlFor="date" className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                Date
              </label>
              <input
                id="date"
                type="date"
                {...register("date", { required: "Date required" })}
                className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-200"
              />
              {errors.date && (
                <span className="text-[10px] text-rose-500 font-semibold mt-1 block pl-0.5">{errors.date.message}</span>
              )}
            </div>
          </div>
        </div>

        {/* Exercises List Header */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-heading">
            Exercises
          </span>
          <span className="text-[10px] text-zinc-500 font-semibold">{fields.length} added</span>
        </div>

        {/* Dynamic Exercise Card Fields */}
        <div className="space-y-5">
          {fields.map((field, index) => {
            const currentExName = watchedExercises[index]?.name || '';
            const prevPref = getPrevPerformance(currentExName);

            return (
              <div 
                key={field.id}
                className="bg-zinc-900/30 border border-zinc-900 rounded-3xl p-5 space-y-4 relative"
              >
                {/* Delete exercise button */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="absolute top-4 right-4 p-1.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 hover:text-rose-500 text-zinc-500 rounded-xl transition-all cursor-pointer"
                    title="Remove Exercise"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Subtitle tag */}
                <div className="text-[10px] font-bold text-zinc-650 uppercase pl-0.5">
                  Exercise #{index + 1}
                </div>

                {/* Exercise Name Input with Autocomplete */}
                <div 
                  className="relative"
                  ref={(el) => { autocompleteRefs.current[index] = el; }}
                >
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                    Exercise Name
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="Search or enter exercise"
                    {...register(`exercises.${index}.name` as const, { required: "Name required" })}
                    onFocus={() => setFocusedIndex(index)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3.5 py-3 text-sm text-zinc-200 placeholder:text-zinc-650"
                  />
                  
                  {/* Autocomplete Dropdown */}
                  {focusedIndex === index && (
                    <div className="absolute top-[82px] left-0 right-0 z-20 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {filterSuggestions(currentExName).length === 0 ? (
                        <div className="px-4 py-3 text-xs text-zinc-600 italic">
                          New exercise (will be added to suggestions)
                        </div>
                      ) : (
                        filterSuggestions(currentExName).map((sug, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => selectSuggestion(index, sug)}
                            className="w-full text-left px-4 py-3 text-xs text-zinc-300 hover:bg-zinc-850 border-b border-zinc-900 last:border-0 flex justify-between items-center transition-colors cursor-pointer"
                          >
                            <span className="font-semibold text-zinc-200">{sug.name}</span>
                            <span className="text-[10px] text-zinc-500 font-medium">Last: {sug.weight} {sug.unit}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Smart Pref Lookup Area */}
                {prevPref && (
                  <div className="bg-emerald-950/15 border border-emerald-900/40 rounded-2xl p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wide">
                        <Sparkles className="h-3 w-3" />
                        <span>Last Performed — {formatDate(prevPref.date)}</span>
                      </div>
                      <div className="text-xs text-zinc-300 font-semibold font-heading">
                        {prevPref.weight} {prevPref.unit !== 'BW' && prevPref.unit} × {prevPref.sets} sets × {prevPref.reps} reps
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUsePrevious(index, prevPref)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 text-xs font-bold rounded-xl active:scale-95 transition-all shadow-xs flex items-center gap-1 select-none shrink-0 cursor-pointer"
                    >
                      <Check className="h-3 w-3 stroke-[3]" />
                      <span>Use Previous</span>
                    </button>
                  </div>
                )}

                {/* Target Workout parameters: Weight, Unit, Sets, Reps */}
                <div className="grid grid-cols-4 gap-2.5">
                  {/* Weight Input */}
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                      Weight
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text" // Keep as text to support values like "BW + 6"
                        placeholder="Weight / BW"
                        {...register(`exercises.${index}.weight` as const, { required: "Required" })}
                        className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl pl-3.5 pr-14 py-3 text-sm text-zinc-200 placeholder:text-zinc-650"
                      />
                      {/* Unit badge / selector overlay */}
                      <div className="absolute right-2">
                        <Controller
                          name={`exercises.${index}.unit` as const}
                          control={control}
                          render={({ field }) => (
                            <div className="relative">
                              <select
                                {...field}
                                className="appearance-none bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[10px] font-bold text-zinc-300 pr-6 select-none focus:outline-hidden"
                              >
                                <option value="kg">kg</option>
                                <option value="lb">lb</option>
                                <option value="BW">BW</option>
                              </select>
                              <ChevronDown className="h-3 w-3 text-zinc-500 absolute right-2.5 top-[7px] pointer-events-none stroke-[2.5]" />
                            </div>
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sets Input */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                      Sets
                    </label>
                    <input
                      type="number"
                      placeholder="4"
                      min="1"
                      {...register(`exercises.${index}.sets` as const, { 
                        required: "Required",
                        valueAsNumber: true
                      })}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-3 text-sm text-zinc-200 text-center"
                    />
                  </div>

                  {/* Reps Input */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                      Reps
                    </label>
                    <input
                      type="number"
                      placeholder="8"
                      min="1"
                      {...register(`exercises.${index}.reps` as const, { 
                        required: "Required",
                        valueAsNumber: true
                      })}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-3 text-sm text-zinc-200 text-center"
                    />
                  </div>
                </div>

                {/* Media upload section (Machine Photo & Performance Video) */}
                <div className="grid grid-cols-2 gap-3.5 pt-1">
                  {/* Machine Photo */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 pl-0.5">
                      Machine Photo
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        id={`machine-upload-${index}`}
                        className="hidden"
                        onChange={(e) => handleMediaUpload(index, 'machine', e)}
                      />
                      <label
                        htmlFor={`machine-upload-${index}`}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border border-dashed transition-all cursor-pointer ${
                          watchedExercises[index]?.machineImageUrl
                            ? 'bg-zinc-950/45 border-emerald-500/35 text-emerald-450 hover:bg-zinc-950/60'
                            : uploadStates[index]?.machine === 'uploading'
                            ? 'bg-zinc-950/20 border-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-650 hover:text-zinc-400'
                        }`}
                      >
                        {uploadStates[index]?.machine === 'uploading' ? (
                          <div className="flex flex-col items-center gap-1">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Uploading...</span>
                          </div>
                        ) : watchedExercises[index]?.machineImageUrl ? (
                          <div className="flex flex-col items-center gap-1 w-full">
                            <div className="h-10 w-full rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800">
                              <img
                                src={getEmbeddableImageUrl(watchedExercises[index].machineImageUrl)}
                                alt="Uploaded machine"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="h-3 w-3 stroke-[3.5]" /> Machine Added
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <Camera className="h-4.5 w-4.5 text-zinc-500" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Upload Photo</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Performance Video */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 pl-0.5">
                      Execution Video
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="video/*"
                        id={`video-upload-${index}`}
                        className="hidden"
                        onChange={(e) => handleMediaUpload(index, 'video', e)}
                      />
                      <label
                        htmlFor={`video-upload-${index}`}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border border-dashed transition-all cursor-pointer ${
                          watchedExercises[index]?.videoUrl
                            ? 'bg-zinc-950/45 border-emerald-500/35 text-emerald-450 hover:bg-zinc-950/60'
                            : uploadStates[index]?.video === 'uploading'
                            ? 'bg-zinc-950/20 border-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-650 hover:text-zinc-400'
                        }`}
                      >
                        {uploadStates[index]?.video === 'uploading' ? (
                          <div className="flex flex-col items-center gap-1">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                            <span className="text-[9px] text-zinc-500 font-semibold uppercase">Uploading...</span>
                          </div>
                        ) : watchedExercises[index]?.videoUrl ? (
                          <div className="flex flex-col items-center gap-1 w-full">
                            <div className="h-10 w-full rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                              <Video className="h-4.5 w-4.5" />
                            </div>
                            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                              <Check className="h-3 w-3 stroke-[3.5]" /> Video Added
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1 py-1">
                            <Video className="h-4.5 w-4.5 text-zinc-500" />
                            <span className="text-[9px] font-bold uppercase tracking-wider">Upload Video</span>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="grid grid-cols-1 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5 pl-0.5">
                      Optional Notes
                    </label>
                    <input
                      type="text"
                      placeholder="Comment (e.g. Set 4 to failure)"
                      {...register(`exercises.${index}.notes` as const)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                  
                  {/* Keep image URL binding in form so suggestions autofill carry it */}
                  <input
                    type="hidden"
                    {...register(`exercises.${index}.imageUrl` as const)}
                  />
                  <input
                    type="hidden"
                    {...register(`exercises.${index}.machineImageUrl` as const)}
                  />
                  <input
                    type="hidden"
                    {...register(`exercises.${index}.videoUrl` as const)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Exercise & Submit Buttons */}
        <div className="space-y-4 pt-2">
          {/* Add Exercise Trigger */}
          <button
            type="button"
            onClick={() => append({ name: '', weight: '', unit: 'kg', sets: 4, reps: 8, notes: '', imageUrl: '', machineImageUrl: '', videoUrl: '' })}
            className="w-full py-3.5 border border-dashed border-zinc-800 hover:border-zinc-700 bg-zinc-900/10 hover:bg-zinc-900/40 text-xs font-semibold text-zinc-400 hover:text-zinc-200 rounded-2xl flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add exercise</span>
          </button>

          {/* Form Save Trigger */}
          <button
            type="submit"
            disabled={isSubmitting || saveMutation.isPending}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-zinc-950 font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.99] disabled:opacity-50 select-none cursor-pointer"
          >
            <Save className="h-4.5 w-4.5" />
            <span>{isSubmitting || saveMutation.isPending ? 'Saving to Database...' : 'Save Workout'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
