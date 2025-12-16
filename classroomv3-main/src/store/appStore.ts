import { create } from 'zustand'

export interface Activity {
  id: string
  name: string
  type: 'coloring' | 'puzzle'
  imageUrl: string
  difficulty?: 'easy' | 'medium' | 'hard'
  createdAt: string
}

export interface Student {
  id: string
  name: string
  score: number
  completedAt?: string
}

interface AppState {
  currentActivity: Activity | null
  students: Student[]
  soundEnabled: boolean
  
  setCurrentActivity: (activity: Activity | null) => void
  addStudent: (student: Student) => void
  toggleSound: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentActivity: null,
  students: [],
  soundEnabled: true,
  
  setCurrentActivity: (activity) => set({ currentActivity: activity }),
  addStudent: (student) => set((state) => ({ 
    students: [...state.students, student] 
  })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled }))
}))
