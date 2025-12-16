import { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Line, Image as KonvaImage } from 'react-konva'
import Toolbox from '../../components/Toolbox'
import { audioManager } from '../../utils/audio'
import { getImages } from '../../services/storage'
import { defaultColoringImages } from '../../config/defaultImages'
import './PlayColoring.css'

interface LineData {
  points: number[]
  stroke: string
  strokeWidth: number
  isEraser?: boolean
}

function PlayColoring() {
  const [lines, setLines] = useState<LineData[]>([])
  const [currentColor, setCurrentColor] = useState('#FF6B6B')
  const [brushSize, setBrushSize] = useState(10)
  const [isDrawing, setIsDrawing] = useState(false)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  // Multi-touch support: เก็บเส้นที่กำลังวาดแยกตาม touch ID
  const activeLines = useRef<Map<number, number>>(new Map()) // touchId -> lineIndex
  const [showOutline, setShowOutline] = useState(true)
  const [isEraser, setIsEraser] = useState(false)
  const [coloringImages, setColoringImages] = useState<any[]>([])
  const [isStarted, setIsStarted] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const stageRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load images from teacher and default images
    const teacherImages = getImages().filter(img => img.category === 'coloring')
    const allImages = [...defaultColoringImages, ...teacherImages]
    setColoringImages(allImages)
  }, [])

  // Calculate responsive canvas size - รองรับทุกอุปกรณ์รวม Smart TV
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!isStarted) return
      
      // Get actual viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Reserve space for UI elements
      const headerHeight = 100
      const paddingSpace = 60
      
      // Calculate available space
      const availableWidth = viewportWidth - paddingSpace
      const availableHeight = viewportHeight - headerHeight - 80
      
      // Dynamic max size based on screen resolution
      let maxWidth: number
      let maxHeight: number
      
      // Smart TV / 4K Displays (>= 1920px)
      if (viewportWidth >= 1920) {
        // ใช้พื้นที่ 70% ของหน้าจอ แต่ไม่เกิน 1800px
        maxWidth = Math.min(availableWidth * 0.7, 1800)
        maxHeight = Math.min(availableHeight * 0.85, 1200)
      }
      // Large Desktop (1600-1919px)
      else if (viewportWidth >= 1600) {
        maxWidth = Math.min(availableWidth * 0.75, 1400)
        maxHeight = Math.min(availableHeight * 0.85, 1000)
      }
      // Desktop (1200-1599px)
      else if (viewportWidth >= 1200) {
        maxWidth = Math.min(availableWidth * 0.8, 1100)
        maxHeight = Math.min(availableHeight * 0.85, 850)
      }
      // Tablet Landscape / Small Desktop (900-1199px)
      else if (viewportWidth >= 900) {
        maxWidth = Math.min(availableWidth * 0.85, 850)
        maxHeight = Math.min(availableHeight * 0.85, 700)
      }
      // Tablet Portrait (768-899px)
      else if (viewportWidth >= 768) {
        maxWidth = availableWidth * 0.9
        maxHeight = availableHeight * 0.8
      }
      // Mobile (< 768px)
      else {
        maxWidth = availableWidth
        maxHeight = availableHeight * 0.75
      }
      
      // Ensure minimum usable size
      const minDimension = viewportWidth >= 1920 ? 600 : 300
      maxWidth = Math.max(maxWidth, minDimension)
      maxHeight = Math.max(maxHeight, minDimension)
      
      // Calculate final canvas size
      if (image) {
        // Maintain image aspect ratio
        const imgRatio = image.width / image.height
        const maxRatio = maxWidth / maxHeight
        
        let newWidth: number, newHeight: number
        
        if (imgRatio > maxRatio) {
          // Wider image - fit to width
          newWidth = maxWidth
          newHeight = maxWidth / imgRatio
        } else {
          // Taller image - fit to height
          newHeight = maxHeight
          newWidth = maxHeight * imgRatio
        }
        
        // Ensure not too small on large screens
        if (viewportWidth >= 1920) {
          const minSize = 700
          if (newWidth < minSize || newHeight < minSize) {
            const scale = minSize / Math.min(newWidth, newHeight)
            newWidth *= scale
            newHeight *= scale
          }
        }
        
        setCanvasSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        })
      } else {
        // Blank canvas - use 4:3 aspect ratio
        const ratio = 4 / 3
        let newWidth = maxWidth
        let newHeight = maxWidth / ratio
        
        if (newHeight > maxHeight) {
          newHeight = maxHeight
          newWidth = maxHeight * ratio
        }
        
        setCanvasSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        })
      }
    }
    
    // Initial size calculation
    updateCanvasSize()
    
    // Update on window resize
    window.addEventListener('resize', updateCanvasSize)
    window.addEventListener('orientationchange', updateCanvasSize)
    
    // Delayed recalculation for DOM rendering
    const timer = setTimeout(updateCanvasSize, 150)
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      window.removeEventListener('orientationchange', updateCanvasSize)
      clearTimeout(timer)
    }
  }, [isStarted, image])

  // Play/Pause background music
  useEffect(() => {
    if (isStarted) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [isStarted])

  // Mouse handlers (single touch)
  const handleMouseDown = (e: any) => {
    setIsDrawing(true)
    const pos = e.target.getStage().getPointerPosition()
    const size = isEraser ? brushSize * 2 : brushSize
    const newLine = { 
      points: [pos.x, pos.y], 
      stroke: currentColor, 
      strokeWidth: size,
      isEraser: isEraser
    }
    setLines(prev => {
      activeLines.current.set(0, prev.length) // Mouse ใช้ ID = 0
      return [...prev, newLine]
    })
    audioManager.playClick()
  }

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return

    const stage = e.target.getStage()
    const point = stage.getPointerPosition()
    const lineIndex = activeLines.current.get(0)
    
    if (lineIndex !== undefined) {
      setLines(prev => {
        const newLines = [...prev]
        if (newLines[lineIndex]) {
          newLines[lineIndex] = {
            ...newLines[lineIndex],
            points: [...newLines[lineIndex].points, point.x, point.y]
          }
        }
        return newLines
      })
    }
  }

  const handleMouseUp = () => {
    setIsDrawing(false)
    activeLines.current.delete(0)
  }

  // Multi-touch handlers - วาดหลายนิ้วพร้อมกัน! 🎨
  const handleTouchStart = (e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const touches = e.evt.changedTouches
    
    setLines(prev => {
      const newLines = [...prev]
      
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i]
        const pos = stage.getPointerPosition(touch)
        if (!pos) continue
        
        const size = isEraser ? brushSize * 2 : brushSize
        const newLine = {
          points: [pos.x, pos.y],
          stroke: currentColor,
          strokeWidth: size,
          isEraser: isEraser
        }
        
        activeLines.current.set(touch.identifier, newLines.length)
        newLines.push(newLine)
      }
      
      return newLines
    })
    
    setIsDrawing(true)
    audioManager.playClick()
  }

  const handleTouchMove = (e: any) => {
    e.evt.preventDefault()
    const stage = e.target.getStage()
    const touches = e.evt.changedTouches
    
    setLines(prev => {
      const newLines = [...prev]
      
      for (let i = 0; i < touches.length; i++) {
        const touch = touches[i]
        const lineIndex = activeLines.current.get(touch.identifier)
        
        if (lineIndex !== undefined && newLines[lineIndex]) {
          const pos = stage.getPointerPosition(touch)
          if (!pos) continue
          
          newLines[lineIndex] = {
            ...newLines[lineIndex],
            points: [...newLines[lineIndex].points, pos.x, pos.y]
          }
        }
      }
      
      return newLines
    })
  }

  const handleTouchEnd = (e: any) => {
    const touches = e.evt.changedTouches
    
    for (let i = 0; i < touches.length; i++) {
      activeLines.current.delete(touches[i].identifier)
    }
    
    if (activeLines.current.size === 0) {
      setIsDrawing(false)
    }
  }

  const handleUndo = () => {
    if (lines.length > 0) {
      setLines(lines.slice(0, -1))
      audioManager.playClick()
    }
  }

  const handleClear = () => {
    setLines([])
    audioManager.playClick()
  }

  const handleSave = () => {
    if (stageRef.current) {
      const uri = stageRef.current.toDataURL()
      const link = document.createElement('a')
      link.download = `my-drawing-${Date.now()}.png`
      link.href = uri
      link.click()
      audioManager.playSuccess()
      alert('บันทึกภาพเรียบร้อย! 🎉')
    }
  }

  const toggleMusic = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = new window.Image()
        img.src = event.target?.result as string
        img.onload = () => {
          setImage(img)
          setLines([])
          setIsStarted(true)
          // Canvas size will be calculated by useEffect
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSelectImage = (imageUrl: string) => {
    const img = new window.Image()
    img.src = imageUrl
    img.onload = () => {
      setImage(img)
      setLines([])
      setIsStarted(true)
      audioManager.playClick()
      // Canvas size will be calculated by useEffect
    }
  }

  if (!isStarted) {
    return (
      <div className="coloring-page">
        <div className="coloring-header">
          <h1>🎨 ระบายสี</h1>
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
        </div>

        <div className="coloring-setup">
          <div className="setup-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>🖼️ เลือกรูป</h2>
              <span style={{ color: '#999', fontSize: '0.9rem' }}>👆 เลื่อนดูรูปเพิ่ม →</span>
            </div>
            <div className="image-gallery">
              {/* กระดาษเปล่า - การ์ดแรก */}
              <div 
                className="gallery-item blank-paper-item"
                onClick={() => {
                  setImage(null)
                  setLines([])
                  setIsStarted(true)
                  setShowOutline(false)
                  audioManager.playClick()
                }}
              >
                <div className="blank-paper-preview">
                  <span style={{ fontSize: '4rem' }}>📄</span>
                </div>
                <span>กระดาษเปล่า</span>
              </div>

              {/* รูปจากครู */}
              {coloringImages.map(img => (
                <div 
                  key={img.id} 
                  className="gallery-item"
                  onClick={() => handleSelectImage(img.url)}
                >
                  <img src={img.url} alt={img.name} />
                  <span>{img.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="coloring-page">
      <div className="coloring-header">
        <h1>🎨 ระบายสี</h1>
        <div className="header-actions">
          <button className="music-btn" onClick={toggleMusic} title={isMusicPlaying ? 'ปิดเสียง' : 'เปิดเสียง'}>
            {isMusicPlaying ? '🔊' : '🔇'}
          </button>
          <button className="change-image-btn" onClick={() => setIsStarted(false)}>
            🖼️ เปลี่ยนรูป
          </button>
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
        </div>
      </div>

      <div className="coloring-container" ref={containerRef}>
        <Toolbox
          currentColor={currentColor}
          onColorChange={setCurrentColor}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          onUndo={handleUndo}
          onClear={handleClear}
          onSave={handleSave}
          showOutline={showOutline}
          onToggleOutline={() => setShowOutline(!showOutline)}
          isEraser={isEraser}
          onToggleEraser={() => setIsEraser(!isEraser)}
        />

        <div className="canvas-wrapper">
          <Stage
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            ref={stageRef}
            className="drawing-stage"
          >
            {/* Layer 1: รูปพื้นหลัง (ไม่ถูกลบ) */}
            <Layer>
              {image && showOutline && (
                <KonvaImage
                  image={image}
                  width={canvasSize.width}
                  height={canvasSize.height}
                  opacity={0.3}
                />
              )}
            </Layer>
            
            {/* Layer 2: เส้นวาด (ลบได้) */}
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.isEraser ? 'white' : line.stroke}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.isEraser ? 'destination-out' : 'source-over'}
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="mascot">
        <div className="mascot-avatar">🦊</div>
        <div className="mascot-speech">วาดสวย ๆ นะ!</div>
      </div>
    </div>
  )
}

export default PlayColoring
