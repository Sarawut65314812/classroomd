// Service สำหรับจัดการข้อมูลใน localStorage

export interface GameConfig {
  id: string
  name: string
  icon: string
  description: string
  path: string
  enabled: boolean
  order: number
}

export interface ImageAsset {
  id: string
  name: string
  url: string
  category: 'coloring' | 'puzzle' | 'matching' | 'shadow' | 'other'
  uploadedAt: string
}

export interface MatchingPair {
  id: number
  leftImage: string
  rightImage: string
  leftText?: string
  rightText?: string
}

export interface ShadowItem {
  id: string
  realImage: string
  shadowImage: string
  realX: number
  realY: number
  shadowX: number
  shadowY: number
  placed: boolean
}

export interface PuzzleConfig {
  id: string
  name: string
  imageUrl: string
  difficulty: 'easy' | 'medium' | 'hard'
  createdAt: string
}

export interface Category {
  id: string
  name: string
  color: string
  backgroundImage?: string
  order: number
}

export interface CategoryItem {
  id: string
  name: string
  imageUrl: string
  categoryId: string
  order: number
}

export interface StudentProgress {
  studentName: string
  gameName: string
  score: number
  completedAt: string
  duration: number // วินาที
}

export interface SoundPair {
  id: number
  image: string
  sound: string
  name: string
}

const KEYS = {
  GAMES: 'classroom_games',
  IMAGES: 'classroom_images',
  MATCHING_PAIRS: 'classroom_matching_pairs',
  SHADOW_ITEMS: 'classroom_shadow_items',
  PUZZLE_CONFIGS: 'classroom_puzzle_configs',
  CATEGORIES: 'classroom_categories',
  CATEGORY_ITEMS: 'classroom_category_items',
  STUDENT_PROGRESS: 'classroom_student_progress',
  SOUND_PAIRS: 'classroom_sound_pairs'
}

// === Game Management ===
export const getGames = (): GameConfig[] => {
  const data = localStorage.getItem(KEYS.GAMES)
  if (!data) {
    // Default games
    const defaultGames: GameConfig[] = [
      {
        id: 'coloring',
        name: 'ระบายสี',
        icon: '🎨',
        description: 'สนุกกับการวาดและระบายสีด้วยนิ้วหรือปากกาสไตลัส',
        path: '/coloring',
        enabled: true,
        order: 1
      },
      {
        id: 'puzzle',
        name: 'จิ๊กซอว์',
        icon: '🧩',
        description: 'ต่อภาพจิ๊กซอว์สนุก ๆ ลากวางชิ้นส่วนให้ถูกที่',
        path: '/puzzle',
        enabled: true,
        order: 2
      },
      {
        id: 'matching',
        name: 'โยงเส้นจับคู่',
        icon: '🎯',
        description: 'ลากเส้นเชื่อมรูปภาพที่เข้าคู่กัน',
        path: '/matching',
        enabled: true,
        order: 3
      },
      {
        id: 'beads',
        name: 'ลูกปัดลอย',
        icon: '🎮',
        description: 'แตะลูกปัดตามลำดับหรือลากใส่ตะกร้า',
        path: '/beads',
        enabled: true,
        order: 4
      },
      {
        id: 'shadow',
        name: 'ลากเงาให้ตรง',
        icon: '🌙',
        description: 'ลากรูปภาพไปจับคู่กับเงาที่ตรงกัน',
        path: '/shadow',
        enabled: true,
        order: 5
      },
      {
        id: 'category',
        name: 'จัดหมวดหมู่',
        icon: '🗂️',
        description: 'ลากรายการไปจัดเข้าหมวดหมู่ที่ถูกต้อง',
        path: '/category',
        enabled: true,
        order: 6
      },
      {
        id: 'sound',
        name: 'จับคู่เสียง',
        icon: '🔊',
        description: 'ฟังเสียงแล้วเลือกรูปภาพที่ถูกต้อง',
        path: '/sound',
        enabled: true,
        order: 7
      }
    ]
    saveGames(defaultGames)
    return defaultGames
  }
  return JSON.parse(data)
}

export const saveGames = (games: GameConfig[]) => {
  localStorage.setItem(KEYS.GAMES, JSON.stringify(games))
}

export const updateGame = (gameId: string, updates: Partial<GameConfig>) => {
  const games = getGames()
  const index = games.findIndex(g => g.id === gameId)
  if (index !== -1) {
    games[index] = { ...games[index], ...updates }
    saveGames(games)
  }
}

export const toggleGame = (gameId: string) => {
  const games = getGames()
  const game = games.find(g => g.id === gameId)
  if (game) {
    game.enabled = !game.enabled
    saveGames(games)
  }
}

// === Image Management ===
export const getImages = (): ImageAsset[] => {
  const data = localStorage.getItem(KEYS.IMAGES)
  return data ? JSON.parse(data) : []
}

export const saveImage = (image: Omit<ImageAsset, 'id' | 'uploadedAt'>): ImageAsset => {
  const images = getImages()
  const newImage: ImageAsset = {
    ...image,
    id: Date.now().toString(),
    uploadedAt: new Date().toISOString()
  }
  images.push(newImage)
  localStorage.setItem(KEYS.IMAGES, JSON.stringify(images))
  return newImage
}

export const deleteImage = (imageId: string) => {
  const images = getImages().filter(img => img.id !== imageId)
  localStorage.setItem(KEYS.IMAGES, JSON.stringify(images))
}

export const getImagesByCategory = (category: ImageAsset['category']) => {
  return getImages().filter(img => img.category === category)
}

// === Matching Pairs Management ===
export const getMatchingPairs = (): MatchingPair[] => {
  const data = localStorage.getItem(KEYS.MATCHING_PAIRS)
  return data ? JSON.parse(data) : []
}

export const saveMatchingPairs = (pairs: MatchingPair[]) => {
  localStorage.setItem(KEYS.MATCHING_PAIRS, JSON.stringify(pairs))
}

export const addMatchingPair = (pair: Omit<MatchingPair, 'id'>): MatchingPair => {
  const pairs = getMatchingPairs()
  const newPair: MatchingPair = {
    ...pair,
    id: pairs.length > 0 ? Math.max(...pairs.map(p => p.id)) + 1 : 1
  }
  pairs.push(newPair)
  saveMatchingPairs(pairs)
  return newPair
}

export const deleteMatchingPair = (pairId: number) => {
  const pairs = getMatchingPairs().filter(p => p.id !== pairId)
  saveMatchingPairs(pairs)
}

// === Shadow Items Management ===
export const getShadowItems = (): ShadowItem[] => {
  const data = localStorage.getItem(KEYS.SHADOW_ITEMS)
  return data ? JSON.parse(data) : []
}

export const saveShadowItems = (items: ShadowItem[]) => {
  localStorage.setItem(KEYS.SHADOW_ITEMS, JSON.stringify(items))
}

export const addShadowItem = (item: Omit<ShadowItem, 'id'>): ShadowItem => {
  const items = getShadowItems()
  const newItem: ShadowItem = {
    ...item,
    id: Date.now().toString()
  }
  items.push(newItem)
  saveShadowItems(items)
  return newItem
}

export const deleteShadowItem = (itemId: string) => {
  const items = getShadowItems().filter(i => i.id !== itemId)
  saveShadowItems(items)
}

// === Puzzle Configs Management ===
export const getPuzzleConfigs = (): PuzzleConfig[] => {
  const data = localStorage.getItem(KEYS.PUZZLE_CONFIGS)
  return data ? JSON.parse(data) : []
}

export const savePuzzleConfig = (config: Omit<PuzzleConfig, 'id' | 'createdAt'>): PuzzleConfig => {
  const configs = getPuzzleConfigs()
  const newConfig: PuzzleConfig = {
    ...config,
    id: Date.now().toString(),
    createdAt: new Date().toISOString()
  }
  configs.push(newConfig)
  localStorage.setItem(KEYS.PUZZLE_CONFIGS, JSON.stringify(configs))
  return newConfig
}

export const deletePuzzleConfig = (configId: string) => {
  const configs = getPuzzleConfigs().filter(c => c.id !== configId)
  localStorage.setItem(KEYS.PUZZLE_CONFIGS, JSON.stringify(configs))
}

export const updatePuzzleConfig = (configId: string, updates: Partial<PuzzleConfig>) => {
  const configs = getPuzzleConfigs()
  const index = configs.findIndex(c => c.id === configId)
  if (index !== -1) {
    configs[index] = { ...configs[index], ...updates }
    localStorage.setItem(KEYS.PUZZLE_CONFIGS, JSON.stringify(configs))
  }
}

// === Student Progress ===
export const getStudentProgress = (): StudentProgress[] => {
  const data = localStorage.getItem(KEYS.STUDENT_PROGRESS)
  return data ? JSON.parse(data) : []
}

export const addStudentProgress = (progress: StudentProgress) => {
  const allProgress = getStudentProgress()
  allProgress.push(progress)
  localStorage.setItem(KEYS.STUDENT_PROGRESS, JSON.stringify(allProgress))
}

export const clearStudentProgress = () => {
  localStorage.setItem(KEYS.STUDENT_PROGRESS, JSON.stringify([]))
}

export const getProgressByStudent = (studentName: string) => {
  return getStudentProgress().filter(p => p.studentName === studentName)
}

export const getProgressByGame = (gameName: string) => {
  return getStudentProgress().filter(p => p.gameName === gameName)
}

// Export CSV
export const exportProgressCSV = () => {
  const progress = getStudentProgress()
  const csv = [
    ['ชื่อนักเรียน', 'เกม', 'คะแนน', 'เวลาที่เล่น', 'ใช้เวลา (วินาที)'],
    ...progress.map(p => [
      p.studentName,
      p.gameName,
      p.score,
      new Date(p.completedAt).toLocaleString('th-TH'),
      p.duration
    ])
  ].map(row => row.join(',')).join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `student-progress-${Date.now()}.csv`
  link.click()
}

// === Category Management ===
export const getCategories = (): Category[] => {
  const data = localStorage.getItem(KEYS.CATEGORIES)
  return data ? JSON.parse(data) : []
}

export const saveCategories = (categories: Category[]) => {
  localStorage.setItem(KEYS.CATEGORIES, JSON.stringify(categories))
}

export const addCategory = (category: Omit<Category, 'id'>): Category => {
  const categories = getCategories()
  const newCategory: Category = {
    ...category,
    id: Date.now().toString()
  }
  categories.push(newCategory)
  saveCategories(categories)
  return newCategory
}

export const deleteCategory = (categoryId: string) => {
  const categories = getCategories().filter(c => c.id !== categoryId)
  saveCategories(categories)
}

// === Category Items Management ===
export const getCategoryItems = (): CategoryItem[] => {
  const data = localStorage.getItem(KEYS.CATEGORY_ITEMS)
  return data ? JSON.parse(data) : []
}

export const saveCategoryItems = (items: CategoryItem[]) => {
  localStorage.setItem(KEYS.CATEGORY_ITEMS, JSON.stringify(items))
}

export const addCategoryItem = (item: Omit<CategoryItem, 'id'>): CategoryItem => {
  const items = getCategoryItems()
  const newItem: CategoryItem = {
    ...item,
    id: Date.now().toString()
  }
  items.push(newItem)
  saveCategoryItems(items)
  return newItem
}

export const deleteCategoryItem = (itemId: string) => {
  const items = getCategoryItems().filter(i => i.id !== itemId)
  saveCategoryItems(items)
}

// === Sound Pairs Management ===
export const getSoundPairs = (): SoundPair[] => {
  const data = localStorage.getItem(KEYS.SOUND_PAIRS)
  return data ? JSON.parse(data) : []
}

export const saveSoundPairs = (pairs: SoundPair[]) => {
  localStorage.setItem(KEYS.SOUND_PAIRS, JSON.stringify(pairs))
}

export const addSoundPair = (pair: Omit<SoundPair, 'id'>): SoundPair => {
  const pairs = getSoundPairs()
  const newPair: SoundPair = {
    ...pair,
    id: pairs.length > 0 ? Math.max(...pairs.map(p => p.id)) + 1 : 1
  }
  pairs.push(newPair)
  saveSoundPairs(pairs)
  return newPair
}

export const deleteSoundPair = (pairId: number) => {
  const pairs = getSoundPairs().filter(p => p.id !== pairId)
  saveSoundPairs(pairs)
}

export const getItemsByCategory = (categoryId: string) => {
  return getCategoryItems().filter(i => i.categoryId === categoryId)
}
