import type { Workout, WorkoutSummary, ExerciseHistoryItem, ExerciseSuggestion } from '../types';

export function getApiUrl(): string {
  return import.meta.env.VITE_GAS_API_URL || '';
}

// --- Fetch helpers ---
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const result = await response.json();
  if (result && result.error) {
    throw new Error(result.error);
  }
  return result as T;
}

// --- API Client Implementation ---
export const apiClient = {
  // GET /workouts
  async getWorkouts(): Promise<WorkoutSummary[]> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return [];
    }
    return request<WorkoutSummary[]>(`${apiUrl}?action=getWorkouts`);
  },

  // GET /workouts/:id
  async getWorkoutDetail(id: string): Promise<Workout> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    return request<Workout>(`${apiUrl}?action=getWorkoutDetail&id=${id}`);
  },

  // POST /workouts (create)
  async createWorkout(workout: Omit<Workout, 'id'> & { id?: string }): Promise<{ success: boolean; id: string }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    const newId = workout.id || `w_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullWorkout: Workout = {
      ...workout,
      id: newId,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        weight: ex.weight ? ex.weight.toString().trim() : "0",
        exerciseNotes: ex.exerciseNotes ? ex.exerciseNotes.trim() : ""
      }))
    };

    return request<{ success: boolean; id: string }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Avoid CORS options flight bugs in Apps Script
      body: JSON.stringify({ action: 'createWorkout', data: fullWorkout })
    });
  },

  // POST /workouts/:id (update)
  async updateWorkout(id: string, workout: Omit<Workout, 'id'>): Promise<{ success: boolean }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    const fullWorkout = {
      ...workout,
      exercises: workout.exercises.map(ex => ({
        ...ex,
        weight: ex.weight ? ex.weight.toString().trim() : "0",
        exerciseNotes: ex.exerciseNotes ? ex.exerciseNotes.trim() : ""
      }))
    };
    return request<{ success: boolean }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'updateWorkout', id, data: fullWorkout })
    });
  },

  // POST /workouts/:id (delete)
  async deleteWorkout(id: string): Promise<{ success: boolean }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    return request<{ success: boolean }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteWorkout', id })
    });
  },

  // GET /exerciseHistory?name=
  async getExerciseHistory(name: string): Promise<ExerciseHistoryItem[]> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return [];
    }
    return request<ExerciseHistoryItem[]>(`${apiUrl}?action=getExerciseHistory&name=${encodeURIComponent(name)}`);
  },

  // GET /exerciseSuggestions
  async getExerciseSuggestions(): Promise<ExerciseSuggestion[]> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return [];
    }
    return request<ExerciseSuggestion[]>(`${apiUrl}?action=getExerciseSuggestions`);
  },

  // POST /uploadFile (Google Drive media uploads)
  async uploadFile(filename: string, mimeType: string, base64Data: string): Promise<{ success: boolean; viewUrl: string; downloadUrl: string; fileId: string }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured. Upload requires a connected Apps Script.");
    }
    return request<{ success: boolean; viewUrl: string; downloadUrl: string; fileId: string }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'uploadFile',
        data: { filename, mimeType, base64Data }
      })
    });
  },

  // POST /deleteFile (Deletes a file from Google Drive via Apps Script)
  async deleteFile(url: string): Promise<{ success: boolean; error?: string }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    return request<{ success: boolean; error?: string }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deleteFile',
        url
      })
    });
  },

  // POST /updateExerciseDetails
  async updateExerciseDetails(
    name: string,
    details: { imageUrl?: string; machineImageUrl?: string; videoUrl?: string; exerciseNotes?: string }
  ): Promise<{ success: boolean }> {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new Error("API URL not configured.");
    }
    return request<{ success: boolean }>(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'updateExerciseDetails',
        name,
        imageUrl: details.imageUrl,
        machineImageUrl: details.machineImageUrl,
        videoUrl: details.videoUrl,
        exerciseNotes: details.exerciseNotes
      })
    });
  }
};
