import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, FileText, Activity, TrendingUp, Camera, Video, Loader2, Trash2, Edit2, Check, Upload } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../api/client';
import { formatDate } from '../utils/date';
import { getEmbeddableImageUrl, getEmbeddableVideoUrl } from '../utils/media';

export const ExerciseDetail: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const decodedName = name ? decodeURIComponent(name) : '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [localExerciseNotes, setLocalExerciseNotes] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Media loading states
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const [videoUploadPending, setVideoUploadPending] = useState(false);
  const [deletingUrls, setDeletingUrls] = useState<Record<string, boolean>>({});

  // Fetch History for Name
  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: ['exerciseHistory', decodedName],
    queryFn: () => apiClient.getExerciseHistory(decodedName),
    enabled: !!decodedName
  });

  const reversedHistory = React.useMemo(() => [...history].reverse(), [history]);

  // DERIVED DATA
  const currentImageUrl = React.useMemo(() => {
    return reversedHistory.find(item => !!item.imageUrl)?.imageUrl || '';
  }, [reversedHistory]);

  const currentMachineImageUrl = React.useMemo(() => {
    return reversedHistory.find(item => !!item.machineImageUrl)?.machineImageUrl || '';
  }, [reversedHistory]);

  const currentVideoUrl = React.useMemo(() => {
    return reversedHistory.find(item => !!item.videoUrl)?.videoUrl || '';
  }, [reversedHistory]);

  const currentExerciseNotes = React.useMemo(() => {
    return reversedHistory.find(item => !!item.exerciseNotes)?.exerciseNotes || '';
  }, [reversedHistory]);

  // Sync general notes input state when DB values load
  React.useEffect(() => {
    if (currentExerciseNotes) {
      setLocalExerciseNotes(currentExerciseNotes);
    } else {
      setLocalExerciseNotes('');
    }
  }, [currentExerciseNotes]);

  // Helper to parse weight string to numeric value for graphing
  const parseWeight = (weightStr: string): number => {
    if (!weightStr) return 0;
    const cleanStr = weightStr.toLowerCase().trim();
    if (cleanStr === 'bw') return 0;
    // Check for "bw + X" or "bw - X"
    if (cleanStr.includes('bw')) {
      const match = cleanStr.match(/bw\s*([+-])\s*(\d+(\.\d+)?)/);
      if (match) {
        const sign = match[1];
        const val = parseFloat(match[2]);
        return sign === '+' ? val : -val;
      }
      return 0;
    }
    // Match normal float
    const floatMatch = cleanStr.match(/^(\d+(\.\d+)?)/);
    return floatMatch ? parseFloat(floatMatch[1]) : 0;
  };

  // Format Date for chart X axis
  const formatChartDate = (dateStr: string) => {
    return formatDate(dateStr, { month: 'short', day: 'numeric' });
  };

  const formatListDate = (dateStr: string) => {
    return formatDate(dateStr);
  };

  // Compile history logs into chart coordinates
  const chartData = history.map((item) => {
    const wt = parseWeight(item.weight);
    const vol = wt * item.sets * item.reps;
    
    // Fallback multiplier for raw bodyweight items so volume isn't 0
    const rawVol = item.weight.toLowerCase().trim() === 'bw' 
      ? 1 * item.sets * item.reps 
      : vol;

    return {
      date: item.date,
      formattedDate: formatChartDate(item.date),
      weight: wt,
      weightLabel: item.weight,
      volume: rawVol,
      unit: item.unit,
      sets: item.sets,
      reps: item.reps
    };
  });

  const videoUrls = React.useMemo(() => {
    return currentVideoUrl ? currentVideoUrl.split(',').map((v: string) => v.trim()).filter(Boolean) : [];
  }, [currentVideoUrl]);

  // MEDIA OPERATIONS handlers

  // Upload or replace image
  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUploadPending(true);
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
        // Drop previous image from Google Drive if it exists
        if (currentImageUrl && (currentImageUrl.includes('google.com') || currentImageUrl.includes('drive.google'))) {
          try {
            await apiClient.deleteFile(currentImageUrl);
          } catch (e) {
            console.warn("Could not delete old image file:", e);
          }
        }
        await apiClient.updateExerciseDetails(decodedName, { imageUrl: uploadResp.downloadUrl });
        queryClient.invalidateQueries({ queryKey: ['exerciseHistory', decodedName] });
        queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      } else {
        throw new Error('Image upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload image.');
    } finally {
      setImageUploadPending(false);
    }
  };

  // Delete reference image
  const handleDeleteImage = async () => {
    if (!window.confirm("Are you sure you want to delete the reference image?")) return;
    setImageUploadPending(true);
    try {
      if (currentImageUrl && (currentImageUrl.includes('google.com') || currentImageUrl.includes('drive.google'))) {
        try {
          await apiClient.deleteFile(currentImageUrl);
        } catch (e) {
          console.warn("Could not delete image file from Google Drive:", e);
        }
      }
      await apiClient.updateExerciseDetails(decodedName, { imageUrl: '' });
      queryClient.invalidateQueries({ queryKey: ['exerciseHistory', decodedName] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    } catch (err) {
      console.error(err);
      alert('Failed to delete image.');
    } finally {
      setImageUploadPending(false);
    }
  };

  // Upload technical video
  const handleUploadVideo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setVideoUploadPending(true);
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
        const nextVideos = [...videoUrls, uploadResp.downloadUrl].join(',');
        await apiClient.updateExerciseDetails(decodedName, { videoUrl: nextVideos });
        queryClient.invalidateQueries({ queryKey: ['exerciseHistory', decodedName] });
        queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      } else {
        throw new Error('Video upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload video.');
    } finally {
      setVideoUploadPending(false);
    }
  };

  // Delete a specific video
  const handleDeleteVideo = async (url: string) => {
    if (!window.confirm("Are you sure you want to delete this technique video?")) return;
    setDeletingUrls(prev => ({ ...prev, [url]: true }));
    try {
      if (url.includes('google.com') || url.includes('drive.google')) {
        try {
          await apiClient.deleteFile(url);
        } catch (e) {
          console.warn("Could not delete video file from Drive:", e);
        }
      }
      const nextVideos = videoUrls.filter(v => v !== url).join(',');
      await apiClient.updateExerciseDetails(decodedName, { videoUrl: nextVideos });
      queryClient.invalidateQueries({ queryKey: ['exerciseHistory', decodedName] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
    } catch (err) {
      console.error(err);
      alert('Failed to delete video.');
    } finally {
      setDeletingUrls(prev => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  };

  // Save general exercise cues/notes details
  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await apiClient.updateExerciseDetails(decodedName, { exerciseNotes: localExerciseNotes });
      queryClient.invalidateQueries({ queryKey: ['exerciseHistory', decodedName] });
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      setIsEditingNotes(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save Notes.');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Custom tooltips
  const WeightTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-xl">
          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{formatListDate(data.date)}</p>
          <div className="space-y-0.5 text-xs text-zinc-200">
            <div>
              <span className="text-zinc-400">Weight: </span>
              <span className="font-bold text-emerald-450">{data.weightLabel} {data.unit !== 'BW' && data.unit}</span>
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {data.sets} sets × {data.reps} reps
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const VolumeTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 shadow-xl">
          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{formatListDate(data.date)}</p>
          <div className="space-y-0.5 text-xs text-zinc-200">
            <div>
              <span className="text-zinc-400">Calculated Volume: </span>
              <span className="font-bold text-sky-450">{data.volume} {data.unit}</span>
            </div>
            <div className="text-[10px] text-zinc-500 mt-1">
              {data.sets} sets × {data.reps} reps
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Navigation */}
      <div>
        <button
          onClick={() => navigate('/exercises')}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Library
        </button>
      </div>

      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-extrabold font-heading tracking-tight text-zinc-100 break-words pr-2">
          {decodedName}
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Exercise Details and History</p>
      </div>

      {/* Loading states */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 space-y-2">
          <div className="h-8 w-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-rotate" style={{ animation: 'spin 1s linear infinite' }}></div>
          <span className="text-zinc-500 text-xs">Loading analytics...</span>
        </div>
      )}

      {isError && (
        <div className="text-center py-10 bg-zinc-900/20 border border-zinc-900 rounded-3xl text-rose-500 text-xs font-semibold">
          Failed to retrieve exercise stats. Please verify your connection.
        </div>
      )}

      {/* Main Content Areas */}
      {history && !isLoading && !isError && (
        <>
          {/* Section 1: Notes cues & Image Upload */}
          <div className="space-y-4">
            
            {/* Reference Image Container */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 pl-0.5">
                <Camera className="h-4 w-4 text-emerald-500" />
                <span>Reference Image</span>
              </h3>

              {imageUploadPending ? (
                <div className="h-44 w-full rounded-2xl bg-zinc-950 border border-zinc-900 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Uploading content...</span>
                </div>
              ) : currentImageUrl || currentMachineImageUrl ? (
                <div className="relative group rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950">
                  <img 
                    src={getEmbeddableImageUrl(currentImageUrl || currentMachineImageUrl)} 
                    alt={decodedName} 
                    className="w-full max-h-56 object-cover object-center"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {/* Image Overlays */}
                  <div className="absolute inset-0 bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <input 
                      type="file" 
                      accept="image/*" 
                      id="replace-image-input" 
                      className="hidden" 
                      onChange={handleUploadImage}
                    />
                    <label 
                      htmlFor="replace-image-input"
                      className="px-3.5 py-2 rounded-xl bg-zinc-950 text-xs font-extrabold text-zinc-200 hover:text-emerald-400 border border-zinc-800 cursor-pointer shadow-md select-none transition-colors"
                    >
                      Replace
                    </label>
                    <button 
                      onClick={handleDeleteImage}
                      className="p-2 py-2 rounded-xl bg-zinc-950 text-zinc-200 hover:text-rose-500 border border-zinc-800 cursor-pointer shadow-md transition-colors"
                      title="Delete Image"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    id="new-image-input" 
                    className="hidden" 
                    onChange={handleUploadImage}
                  />
                  <label 
                    htmlFor="new-image-input"
                    className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-905 hover:bg-zinc-900/50 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer text-center"
                  >
                    <Upload className="h-6 w-6 mb-2 text-zinc-650" />
                    <span className="text-xs font-bold uppercase tracking-wider">Upload Reference Image</span>
                    <span className="text-[10px] text-zinc-600 mt-1">Accepts PNG, JPG, or GIF</span>
                  </label>
                </div>
              )}
            </div>

            {/* Optional cues/notes Card */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 pl-0.5">
                  <FileText className="h-4 w-4 text-emerald-500" />
                  <span>General Cues & Notes</span>
                </h3>
                {!isEditingNotes && (
                  <button
                    onClick={() => {
                      setLocalExerciseNotes(currentExerciseNotes);
                      setIsEditingNotes(true);
                    }}
                    className="text-zinc-550 hover:text-emerald-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Edit Notes"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    placeholder="Enter cues, tips, or setups (e.g., set bench to 30 degrees, tuck elbows)"
                    value={localExerciseNotes}
                    onChange={(e) => setLocalExerciseNotes(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-zinc-200 placeholder:text-zinc-705 focus:outline-hidden"
                  />
                  <div className="flex justify-end gap-2 text-xs">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      disabled={isSavingNotes}
                      className="px-3 py-1.5 border border-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      {isSavingNotes ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                      )}
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 leading-relaxed pl-0.5 whitespace-pre-line italic">
                  {currentExerciseNotes || "No cues or setup notes logged yet."}
                </p>
              )}
            </div>

            {/* Video Gallery Container */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5 pl-0.5">
                  <Video className="h-4 w-4 text-emerald-500" />
                  <span>Technique Video Gallery</span>
                </h3>

                <div>
                  <input 
                    type="file" 
                    accept="video/*" 
                    id="new-video-input" 
                    className="hidden" 
                    onChange={handleUploadVideo}
                    disabled={videoUploadPending}
                  />
                  <label 
                    htmlFor="new-video-input"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-emerald-400 rounded-xl transition-all cursor-pointer select-none"
                  >
                    {videoUploadPending ? (
                      <Loader2 className="h-3 w-3 animate-spin text-emerald-500" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    <span>Add Video</span>
                  </label>
                </div>
              </div>

              {videoUrls.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {videoUrls.map((url, videoIdx) => {
                    const isDeleting = !!deletingUrls[url];
                    return (
                      <div key={url || videoIdx} className="relative group rounded-2xl overflow-hidden border border-zinc-900 bg-zinc-950 aspect-video flex items-center justify-center">
                        {isDeleting ? (
                          <div className="absolute inset-0 bg-zinc-950/80 flex flex-col items-center justify-center space-y-2 z-10">
                            <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
                            <span className="text-[9px] font-extrabold uppercase text-zinc-550">Trashing Drive File...</span>
                          </div>
                        ) : null}
                        
                        <iframe 
                          src={getEmbeddableVideoUrl(url)} 
                          className="w-full h-full border-0 absolute inset-0"
                          allow="autoplay"
                        />
                        
                        {/* Delete overlay icon */}
                        <button
                          onClick={() => handleDeleteVideo(url)}
                          disabled={isDeleting || videoUploadPending}
                          className="absolute top-2.5 right-2.5 p-2 bg-zinc-950/85 hover:bg-rose-600 border border-zinc-900 text-zinc-400 hover:text-white rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shadow-md cursor-pointer disabled:opacity-50"
                          title="Delete Video"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-2xl text-zinc-550 text-xs">
                  {videoUploadPending ? (
                    <div className="flex flex-col items-center gap-1.5 py-1">
                      <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
                      <span className="text-[9px] font-extrabold uppercase text-zinc-500">Uploading new technique clip...</span>
                    </div>
                  ) : (
                    "No technique videos uploaded yet."
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Section 2: Progression Analytics (Stacked Dual Charts) */}
          <div className="space-y-6">
            
            {/* Chart 1: Weight Progression */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs uppercase tracking-wider pl-0.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Weight Progression</span>
              </div>
              <p className="text-[10px] text-zinc-500 pl-0.5">Peak load (kg/lb) over workouts</p>

              {chartData.length > 0 ? (
                <div className="h-48 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData} 
                      margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="#52525b" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis 
                        stroke="#52525b" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<WeightTooltip />} cursor={{ stroke: '#27272a', strokeWidth: 1.5 }} />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorWeight)" 
                        activeDot={{ r: 5, strokeWidth: 0, fill: '#10b981' }} 
                        dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-650 text-xs">No coordinates available.</div>
              )}
            </div>

            {/* Chart 2: Volume Progression */}
            <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-zinc-400 font-bold text-xs uppercase tracking-wider pl-0.5">
                <Activity className="h-4 w-4 text-sky-400" />
                <span>Volume Progression</span>
              </div>
              <p className="text-[10px] text-zinc-500 pl-0.5">Calculated total reps × load volume per session</p>

              {chartData.length > 0 ? (
                <div className="h-48 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                      data={chartData} 
                      margin={{ top: 10, right: 5, left: -25, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f22" vertical={false} />
                      <XAxis 
                        dataKey="formattedDate" 
                        stroke="#52525b" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        padding={{ left: 10, right: 10 }}
                      />
                      <YAxis 
                        stroke="#52525b" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false} 
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<VolumeTooltip />} cursor={{ stroke: '#27272a', strokeWidth: 1.5 }} />
                      <Area 
                        type="monotone" 
                        dataKey="volume" 
                        stroke="#0ea5e9" 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill="url(#colorVolume)" 
                        activeDot={{ r: 5, strokeWidth: 0, fill: '#0ea5e9' }} 
                        dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-650 text-xs">No coordinates available.</div>
              )}
            </div>

          </div>

          {/* Section 3: Performance Logs Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-zinc-500 font-heading pl-0.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-500" />
              <span>Performance Logs</span>
            </div>

            <div className="bg-zinc-900/20 border border-zinc-900 rounded-3xl overflow-hidden">
              <div className="grid grid-cols-3 bg-zinc-900/50 px-4 py-3 border-b border-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <div>Date</div>
                <div className="text-center">Weight</div>
                <div className="text-right">Sets × Reps</div>
              </div>

              <div className="divide-y divide-zinc-900/50">
                {reversedHistory.map((item, idx) => (
                  <div key={idx} className="px-4 py-3.5 space-y-2">
                    <div className="grid grid-cols-3 items-center text-xs">
                      {/* Log Date */}
                      <div className="font-semibold text-zinc-400 flex items-center gap-1">
                        <span>{formatListDate(item.date)}</span>
                      </div>

                      {/* Weight */}
                      <div className="text-center font-extrabold text-zinc-200">
                        {item.weight} {item.unit !== 'BW' && item.unit}
                      </div>

                      {/* Sets x Reps */}
                      <div className="text-right font-semibold text-zinc-450">
                        {item.sets}s × {item.reps}r
                      </div>
                    </div>

                    {/* Session Log Notes */}
                    {item.notes && (
                      <div className="text-[11px] text-zinc-500 italic pl-1 flex items-start gap-1">
                        <FileText className="h-3 w-3 text-zinc-700 shrink-0 mt-0.5" />
                        <span>{item.notes}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {history && !isLoading && !isError && history.length === 0 && (
        <div className="text-center py-12 bg-zinc-900/10 border border-zinc-900 rounded-3xl text-zinc-500 text-xs">
          No historical data cataloged for this exercise.
        </div>
      )}
    </div>
  );
};
