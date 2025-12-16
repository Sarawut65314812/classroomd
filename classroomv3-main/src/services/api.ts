import axios from 'axios'

const API_BASE_URL = '/api'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Image upload
export const uploadImage = async (file: File) => {
  const formData = new FormData()
  formData.append('image', file)
  
  const response = await api.post('/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return response.data
}

// Get gallery images
export const getGallery = async () => {
  const response = await api.get('/gallery')
  return response.data
}

// Slice image for puzzle
export const sliceImage = async (imageUrl: string, level: string) => {
  const response = await api.post('/slice-image', { imageUrl, level })
  return response.data
}

// Activities
export const createActivity = async (activityData: any) => {
  const response = await api.post('/activity', activityData)
  return response.data
}

export const getActivities = async () => {
  const response = await api.get('/activities')
  return response.data
}

export const getActivityResults = async (activityId: string) => {
  const response = await api.get(`/activity/${activityId}/results`)
  return response.data
}

// Submit student work
export const submitWork = async (workData: any) => {
  const response = await api.post('/submit', workData)
  return response.data
}

// === Puzzle APIs ===

export interface PuzzleScore {
  studentName?: string
  difficulty: 'easy' | 'medium' | 'hard'
  timeSeconds: number
  moves: number
  completed: boolean
  puzzleConfigId?: string
}

export interface PuzzleConfig {
  id?: string
  name: string
  imageUrl: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdBy?: string
}

// Save puzzle score
export const savePuzzleScore = async (scoreData: PuzzleScore) => {
  const response = await api.post('/puzzle/score', scoreData)
  return response.data
}

// Get puzzle leaderboard
export const getPuzzleLeaderboard = async (difficulty?: string, limit: number = 10) => {
  const params = new URLSearchParams()
  if (difficulty) params.append('difficulty', difficulty)
  params.append('limit', limit.toString())
  
  const response = await api.get(`/puzzle/leaderboard?${params}`)
  return response.data
}

// Get puzzle statistics
export const getPuzzleStats = async () => {
  const response = await api.get('/puzzle/stats')
  return response.data
}

// Save puzzle configuration (Teacher)
export const savePuzzleConfig = async (config: PuzzleConfig) => {
  const response = await api.post('/puzzle/config', config)
  return response.data
}

// Get all puzzle configurations
export const getPuzzleConfigs = async () => {
  const response = await api.get('/puzzle/configs')
  return response.data
}

// Delete puzzle configuration
export const deletePuzzleConfig = async (configId: string) => {
  const response = await api.delete(`/puzzle/config/${configId}`)
  return response.data
}
