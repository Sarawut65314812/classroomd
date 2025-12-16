// Default images configuration for each game type

// Use Vite base path so assets load correctly when the app is served under /studio
const BASE = (typeof import.meta !== 'undefined' ? import.meta.env.BASE_URL : '/') || '/'
const withBase = (path: string) => `${BASE.replace(/\/$/, '/')}${path.replace(/^\//, '')}`

export interface ImageItem {
  id: string
  name: string
  url: string
  category: 'coloring' | 'puzzle' | 'matching' | 'shadow'
  thumbnail?: string
}

// Coloring Images - 31 images
export const defaultColoringImages: ImageItem[] = Array.from({ length: 31 }, (_, i) => {
  const num = i + 1
  const ext = num === 15 ? 'png' : num === 26 ? 'jpeg' : 'jpg'
  return {
    id: `coloring-${num}`,
    name: `รูประบายสี ${num}`,
    url: withBase(`/images/coloring/image-${num}.${ext}`),
    category: 'coloring' as const
  }
})

// Puzzle Images - 10 images
export const defaultPuzzleImages: ImageItem[] = [
  { id: 'puzzle-1', name: 'จิ๊กซอว์ 1', url: withBase('/images/puzzle/image-1.jpg'), category: 'puzzle' },
  { id: 'puzzle-2', name: 'จิ๊กซอว์ 2', url: withBase('/images/puzzle/image-2.jpg'), category: 'puzzle' },
  { id: 'puzzle-3', name: 'จิ๊กซอว์ 3', url: withBase('/images/puzzle/image-3.jpg'), category: 'puzzle' },
  { id: 'puzzle-4', name: 'จิ๊กซอว์ 4', url: withBase('/images/puzzle/image-4.png'), category: 'puzzle' },
  { id: 'puzzle-5', name: 'จิ๊กซอว์ 5', url: withBase('/images/puzzle/image-5.jpg'), category: 'puzzle' },
  { id: 'puzzle-6', name: 'จิ๊กซอว์ 6', url: withBase('/images/puzzle/image-6.jpg'), category: 'puzzle' },
  { id: 'puzzle-7', name: 'จิ๊กซอว์ 7', url: withBase('/images/puzzle/image-7.png'), category: 'puzzle' },
  { id: 'puzzle-8', name: 'จิ๊กซอว์ 8', url: withBase('/images/puzzle/image-8.png'), category: 'puzzle' },
  { id: 'puzzle-9', name: 'จิ๊กซอว์ 9', url: withBase('/images/puzzle/image-9.jpg'), category: 'puzzle' },
  { id: 'puzzle-10', name: 'จิ๊กซอว์ 10', url: withBase('/images/puzzle/image-10.jpg'), category: 'puzzle' }
]

// Matching Pairs
export const defaultMatchingImages: ImageItem[] = [
  {
    id: 'matching-1',
    name: 'จับคู่ 1',
    url: withBase('/images/matching/image-1.png'),
    category: 'matching'
  },
  {
    id: 'matching-2',
    name: 'จับคู่ 2',
    url: withBase('/images/matching/image-2.png'),
    category: 'matching'
  }
]

// Shadow Matching
export const defaultShadowImages: ImageItem[] = [
  {
    id: 'shadow-1',
    name: 'เงา 1',
    url: withBase('/images/shadow/image-1.png'),
    category: 'shadow'
  },
  {
    id: 'shadow-2',
    name: 'เงา 2',
    url: withBase('/images/shadow/image-2.png'),
    category: 'shadow'
  }
]

// Helper function to get images by category
export const getDefaultImagesByCategory = (category: 'coloring' | 'puzzle' | 'matching' | 'shadow'): ImageItem[] => {
  switch (category) {
    case 'coloring':
      return defaultColoringImages
    case 'puzzle':
      return defaultPuzzleImages
    case 'matching':
      return defaultMatchingImages
    case 'shadow':
      return defaultShadowImages
    default:
      return []
  }
}

// Check if image exists
export const checkImageExists = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// Get available images (filter out missing files)
export const getAvailableImages = async (category: 'coloring' | 'puzzle' | 'matching' | 'shadow'): Promise<ImageItem[]> => {
  const images = getDefaultImagesByCategory(category)
  const availableImages: ImageItem[] = []

  for (const image of images) {
    const exists = await checkImageExists(image.url)
    if (exists) {
      availableImages.push(image)
    }
  }

  return availableImages
}
