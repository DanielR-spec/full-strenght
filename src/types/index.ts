export interface Exercise {
  name: string;
  weight: string;
  unit: 'kg' | 'lb' | 'BW';
  sets: number;
  reps: number;
  notes?: string; // Session-specific notes (e.g. "RPE 9")
  imageUrl?: string; // Reference image
  machineImageUrl?: string; // Secondary/equipment reference (optional fallback)
  videoUrl?: string; // Comma-separated video URLs list
  exerciseNotes?: string; // Library general exercise cues/notes (optional)
}

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // E.g., "1U", "1L", "Push", "Pull"
  exercises: Exercise[];
}

export interface WorkoutSummary {
  id: string;
  date: string;
  name: string;
  exerciseCount: number;
}

export interface ExerciseHistoryItem {
  date: string;
  weight: string;
  unit: 'kg' | 'lb' | 'BW';
  sets: number;
  reps: number;
  notes?: string;
  imageUrl?: string;
  machineImageUrl?: string;
  videoUrl?: string;
  exerciseNotes?: string;
}

export interface ExerciseSuggestion {
  name: string;
  weight: string;
  unit: 'kg' | 'lb' | 'BW';
  sets: number;
  reps: number;
  notes?: string;
  imageUrl?: string;
  machineImageUrl?: string;
  videoUrl?: string;
  exerciseNotes?: string;
  date: string;
}
