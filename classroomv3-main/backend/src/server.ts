import express, { Request, Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const app = express()
const PORT = process.env.PORT || 5000

// TypeScript Interfaces
interface PuzzleScore {
  id: string
  studentName: string
  difficulty: 'easy' | 'medium' | 'hard'
  timeSeconds: number
  moves: number
  completed: boolean
  timestamp: string
  puzzleConfigId?: string
}

interface PuzzleConfig {
  id: string
  name: string
  imageUrl: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdBy: string
  createdAt: string
}

interface Activity {
  id: string
  type: string
  name: string
  config: any
  createdAt: string
}

interface Submission {
  id: string
  activityId: string
  studentName: string
  score: number
  data: any
  submittedAt: string
}

// Middleware
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static('uploads'))

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads')
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'))
    }
  }
})

// In-memory storage (replace with database in production)
let activities: Activity[] = []
let gallery: any[] = []
let submissions: Submission[] = []
let puzzleScores: PuzzleScore[] = []
let puzzleConfigs: PuzzleConfig[] = []

// Routes

// Upload image
app.post('/api/upload-image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    // Optimize image with Sharp
    const optimizedFilename = 'optimized-' + req.file.filename
    await sharp(req.file.path)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(path.join('uploads', optimizedFilename))

    const imageUrl = `/uploads/${optimizedFilename}`
    
    gallery.push({
      id: Date.now().toString(),
      url: imageUrl,
      originalName: req.file.originalname,
      createdAt: new Date().toISOString()
    })

    res.json({ imageUrl, message: 'Image uploaded successfully' })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// Slice image for puzzle
app.post('/api/slice-image', async (req: Request, res: Response) => {
  try {
    const { imageUrl, level } = req.body
    
    const gridSize = level === 'easy' ? 3 : level === 'medium' ? 4 : 5
    
    // Return configuration for client-side slicing
    res.json({
      gridSize,
      pieces: gridSize * gridSize,
      message: 'Slice configuration ready'
    })
  } catch (error) {
    console.error('Slice error:', error)
    res.status(500).json({ error: 'Failed to slice image' })
  }
})

// Get gallery images
app.get('/api/gallery', (req: Request, res: Response) => {
  res.json(gallery)
})

// Create activity
app.post('/api/activity', (req: Request, res: Response) => {
  try {
    const activity = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString()
    }
    activities.push(activity)
    res.json(activity)
  } catch (error) {
    console.error('Create activity error:', error)
    res.status(500).json({ error: 'Failed to create activity' })
  }
})

// Get all activities
app.get('/api/activities', (req: Request, res: Response) => {
  res.json(activities)
})

// Get activity results
app.get('/api/activity/:id/results', (req: Request, res: Response) => {
  const { id } = req.params
  const results = submissions.filter((s: any) => s.activityId === id)
  res.json(results)
})

// Submit student work
app.post('/api/submit', (req: Request, res: Response) => {
  try {
    const submission: Submission = {
      id: Date.now().toString(),
      ...req.body,
      submittedAt: new Date().toISOString()
    }
    submissions.push(submission)
    res.json({ message: 'Submission successful', submission })
  } catch (error) {
    console.error('Submit error:', error)
    res.status(500).json({ error: 'Failed to submit work' })
  }
})

// === Puzzle-specific APIs ===

// Save puzzle score
app.post('/api/puzzle/score', (req: Request, res: Response) => {
  try {
    const scoreData: PuzzleScore = {
      id: Date.now().toString(),
      studentName: req.body.studentName || 'Anonymous',
      difficulty: req.body.difficulty,
      timeSeconds: req.body.timeSeconds,
      moves: req.body.moves,
      completed: req.body.completed,
      timestamp: new Date().toISOString(),
      puzzleConfigId: req.body.puzzleConfigId
    }
    
    puzzleScores.push(scoreData)
    res.json({ 
      message: 'Score saved successfully', 
      score: scoreData,
      rank: calculateRank(scoreData)
    })
  } catch (error) {
    console.error('Save score error:', error)
    res.status(500).json({ error: 'Failed to save score' })
  }
})

// Get puzzle leaderboard
app.get('/api/puzzle/leaderboard', (req: Request, res: Response) => {
  try {
    const { difficulty, limit = '10' } = req.query
    
    let filteredScores = puzzleScores.filter(s => s.completed)
    
    if (difficulty) {
      filteredScores = filteredScores.filter(s => s.difficulty === difficulty)
    }
    
    // Sort by time (ascending) and then by moves (ascending)
    const sortedScores = filteredScores.sort((a, b) => {
      if (a.timeSeconds !== b.timeSeconds) {
        return a.timeSeconds - b.timeSeconds
      }
      return a.moves - b.moves
    })
    
    const topScores = sortedScores.slice(0, parseInt(limit as string))
    
    res.json({
      scores: topScores,
      total: filteredScores.length
    })
  } catch (error) {
    console.error('Get leaderboard error:', error)
    res.status(500).json({ error: 'Failed to get leaderboard' })
  }
})

// Get puzzle statistics
app.get('/api/puzzle/stats', (req: Request, res: Response) => {
  try {
    const completedPuzzles = puzzleScores.filter(s => s.completed)
    
    const stats = {
      totalPlayed: puzzleScores.length,
      totalCompleted: completedPuzzles.length,
      completionRate: puzzleScores.length > 0 
        ? (completedPuzzles.length / puzzleScores.length * 100).toFixed(1) 
        : '0',
      byDifficulty: {
        easy: {
          played: puzzleScores.filter(s => s.difficulty === 'easy').length,
          completed: completedPuzzles.filter(s => s.difficulty === 'easy').length
        },
        medium: {
          played: puzzleScores.filter(s => s.difficulty === 'medium').length,
          completed: completedPuzzles.filter(s => s.difficulty === 'medium').length
        },
        hard: {
          played: puzzleScores.filter(s => s.difficulty === 'hard').length,
          completed: completedPuzzles.filter(s => s.difficulty === 'hard').length
        }
      },
      averageTime: completedPuzzles.length > 0
        ? Math.round(completedPuzzles.reduce((sum, s) => sum + s.timeSeconds, 0) / completedPuzzles.length)
        : 0,
      averageMoves: completedPuzzles.length > 0
        ? Math.round(completedPuzzles.reduce((sum, s) => sum + s.moves, 0) / completedPuzzles.length)
        : 0
    }
    
    res.json(stats)
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: 'Failed to get statistics' })
  }
})

// Save puzzle configuration (Teacher)
app.post('/api/puzzle/config', (req: Request, res: Response) => {
  try {
    const config: PuzzleConfig = {
      id: Date.now().toString(),
      name: req.body.name,
      imageUrl: req.body.imageUrl,
      difficulty: req.body.difficulty,
      createdBy: req.body.createdBy || 'Teacher',
      createdAt: new Date().toISOString()
    }
    
    puzzleConfigs.push(config)
    res.json({ 
      message: 'Puzzle configuration saved', 
      config 
    })
  } catch (error) {
    console.error('Save config error:', error)
    res.status(500).json({ error: 'Failed to save configuration' })
  }
})

// Get all puzzle configurations
app.get('/api/puzzle/configs', (req: Request, res: Response) => {
  try {
    res.json(puzzleConfigs)
  } catch (error) {
    console.error('Get configs error:', error)
    res.status(500).json({ error: 'Failed to get configurations' })
  }
})

// Delete puzzle configuration
app.delete('/api/puzzle/config/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const index = puzzleConfigs.findIndex(c => c.id === id)
    
    if (index === -1) {
      return res.status(404).json({ error: 'Configuration not found' })
    }
    
    puzzleConfigs.splice(index, 1)
    res.json({ message: 'Configuration deleted successfully' })
  } catch (error) {
    console.error('Delete config error:', error)
    res.status(500).json({ error: 'Failed to delete configuration' })
  }
})

// Helper function to calculate rank
function calculateRank(newScore: PuzzleScore): number {
  const sameLevel = puzzleScores
    .filter(s => s.difficulty === newScore.difficulty && s.completed)
    .sort((a, b) => {
      if (a.timeSeconds !== b.timeSeconds) {
        return a.timeSeconds - b.timeSeconds
      }
      return a.moves - b.moves
    })
  
  return sameLevel.findIndex(s => s.id === newScore.id) + 1
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Server is running' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📁 Uploads directory: ${path.resolve('uploads')}`)
})
