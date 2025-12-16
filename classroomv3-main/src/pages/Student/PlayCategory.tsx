import { useState, useEffect } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MouseTransition, TouchTransition } from 'react-dnd-multi-backend'
import { MultiBackend } from 'react-dnd-multi-backend'
import { getCategories, getCategoryItems, Category, CategoryItem } from '../../services/storage'
import { audioManager } from '../../utils/audio'
import './PlayCategory.css'

// Multi-backend configuration
const HTML5toTouch = {
  backends: [
    {
      id: 'html5',
      backend: HTML5Backend,
      transition: MouseTransition,
    },
    {
      id: 'touch',
      backend: TouchBackend,
      options: { 
        enableMouseEvents: true,
        delayTouchStart: 200,
        ignoreContextMenu: true
      },
      preview: true,
      transition: TouchTransition,
    },
  ],
}

interface PlayItem extends CategoryItem {
  placed: boolean
  placedInCategoryId?: string
}

function PlayCategory() {
  const [started, setStarted] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<PlayItem[]>([])
  const [score, setScore] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (started) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [started])

  const loadData = () => {
    const cats = getCategories()
    const allItems = getCategoryItems()
    
    setCategories(cats)
    setItems(allItems.map(item => ({ ...item, placed: false })))
  }

  const handleStart = () => {
    // Shuffle items
    const shuffled = [...items].sort(() => Math.random() - 0.5)
    setItems(shuffled.map(item => ({ ...item, placed: false, placedInCategoryId: undefined })))
    setScore(0)
    setCompleted(false)
    setStarted(true)
    audioManager.playClick()
  }

  const handleDrop = (itemId: string, targetCategoryId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    
    // ถ้าวางซ้ำที่เดิม ไม่ทำอะไร
    if (item.placed && item.placedInCategoryId === targetCategoryId) {
      return
    }
    
    // ถ้าเคยวางไว้แล้ว ต้องหักคะแนนเดิมก่อน
    if (item.placed && item.placedInCategoryId) {
      const wasCorrect = item.categoryId === item.placedInCategoryId
      if (wasCorrect) {
        setScore(prev => Math.max(0, prev - 10)) // หักคะแนนที่ได้มา
      } else {
        setScore(prev => prev + 5) // คืนคะแนนที่หักไป
      }
    }

    const isCorrect = item.categoryId === targetCategoryId

    setItems(prevItems => prevItems.map(i => 
      i.id === itemId 
        ? { ...i, placed: true, placedInCategoryId: targetCategoryId } 
        : i
    ))

    if (isCorrect) {
      audioManager.playCorrect()
      setScore(prev => prev + 10)
    } else {
      audioManager.playFail()
      setScore(prev => Math.max(0, prev - 5))
    }

    // Check if all items are placed (after this drop)
    setTimeout(() => {
      setItems(currentItems => {
        const allPlaced = currentItems.every(i => i.placed)
        
        if (allPlaced) {
          const allCorrect = currentItems.every(i => 
            i.placed && i.categoryId === i.placedInCategoryId
          )
          
          if (allCorrect) {
            setCompleted(true)
            audioManager.playEndgame()
          }
        }
        
        return currentItems
      })
    }, 500)
  }

  const handleRemove = (itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item || !item.placed) return
    
    // หักคะแนนตามที่วางไว้
    const wasCorrect = item.categoryId === item.placedInCategoryId
    if (wasCorrect) {
      setScore(prev => Math.max(0, prev - 10))
    } else {
      setScore(prev => prev + 5) // คืนคะแนนที่หักไป
    }
    
    setItems(prevItems => prevItems.map(i => 
      i.id === itemId 
        ? { ...i, placed: false, placedInCategoryId: undefined } 
        : i
    ))
    audioManager.playClick()
  }

  const toggleMusic = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  const getUnplacedItems = () => {
    return items.filter(i => !i.placed)
  }

  const getItemsInCategory = (categoryId: string) => {
    return items.filter(i => i.placed && i.placedInCategoryId === categoryId)
  }

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || ''
  }

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#999'
  }

  if (!started) {
    return (
      <div className="category-setup">
        <div className="setup-header">
          <h1>🗂️ เกมจัดหมวดหมู่</h1>
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
        </div>

        <div className="setup-container">
          {categories.length === 0 || items.length === 0 ? (
            <div className="setup-card">
              <div className="no-data-message">
                <div className="no-data-icon">📭</div>
                <h2>ยังไม่มีข้อมูล</h2>
                <p>ครูยังไม่ได้สร้างหมวดหมู่และรายการ</p>
                <p>กรุณาแจ้งครูเพื่อเพิ่มข้อมูลในหน้าจัดการเกม</p>
              </div>
            </div>
          ) : (
            <>
              <div className="info-banner">
                ✅ พบ {categories.length} หมวดหมู่ และ {items.length} รายการ
              </div>

              <div className="setup-card">
                <h2>วิธีเล่น</h2>
                <div className="instructions">
                  <div className="instruction-item">
                    <span className="step-number">1</span>
                    <p>ดูรายการด้านล่าง</p>
                  </div>
                  <div className="instruction-item">
                    <span className="step-number">2</span>
                    <p>ลากรายการไปวางในหมวดหมู่ที่ถูกต้อง</p>
                  </div>
                  <div className="instruction-item">
                    <span className="step-number">3</span>
                    <p>จัดให้ถูกทุกรายการเพื่อชนะ!</p>
                  </div>
                </div>
              </div>

              <div className="preview-categories">
                <h3>หมวดหมู่ ({categories.length})</h3>
                <div className="preview-grid">
                  {categories.map(cat => (
                    <div 
                      key={cat.id} 
                      className="preview-category-card"
                      style={{ borderLeftColor: cat.color }}
                    >
                      <div 
                        className="preview-color-dot"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="start-btn" onClick={handleStart}>
                🎮 เริ่มเล่น!
              </button>
            </>
          )}
        </div>

        <div className="mascot">
          <div className="mascot-avatar">🦊</div>
          <div className="mascot-speech">จัดหมวดหมู่ให้ถูกต้องนะ!</div>
        </div>
      </div>
    )
  }

  return (
    <DndProvider backend={MultiBackend} options={HTML5toTouch}>
      <div className="play-category-page">
        <div className="category-game-header">
          <div className="header-left">
            <h1>🗂️ จัดหมวดหมู่</h1>
            {/* score hidden per request */}
          </div>
          <div className="header-actions">
            <button className="music-btn" onClick={toggleMusic}>
              {isMusicPlaying ? '🔊' : '🔇'}
            </button>
            <button className="back-btn" onClick={() => setStarted(false)}>
              ← เริ่มใหม่
            </button>
          </div>
        </div>

        <div className="game-layout">
          {/* Categories Zones */}
          <div className="categories-zones">
            {categories.map(category => (
              <CategoryZone
                key={category.id}
                category={category}
                items={getItemsInCategory(category.id)}
                onDrop={handleDrop}
                onRemove={handleRemove}
                selectedItemId={selectedItemId}
                setSelectedItemId={setSelectedItemId}
              />
            ))}
          </div>

          {/* Items Tray */}
          <div className="items-tray">
            <h3>🧩 รายการ ({getUnplacedItems().length}/{items.length})</h3>
            <div className="tray-items">
              {getUnplacedItems().length === 0 ? (
                <p className="tray-empty">✅ วางครบทุกรายการแล้ว!</p>
              ) : (
                getUnplacedItems().map(item => (
                  <DraggableItem
                    key={item.id}
                    item={item}
                    isSelected={selectedItemId === item.id}
                    onSelect={(id) => setSelectedItemId(selectedItemId === id ? null : id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Completion Modal */}
        {completed && (
          <div className="completion-overlay">
            <div className="completion-modal">
              <div className="completion-icon">🎉</div>
              <h2>ยินดีด้วย!</h2>
              {/* completion score hidden per request */}
              <button className="play-again-btn" onClick={handleStart}>
                เล่นอีกครั้ง
              </button>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  )
}

// Category Drop Zone Component
interface CategoryZoneProps {
  category: Category
  items: PlayItem[]
  onDrop: (itemId: string, categoryId: string) => void
  onRemove: (itemId: string) => void
  selectedItemId: string | null
  setSelectedItemId: (id: string | null) => void
}

function CategoryZone({ category, items, onDrop, onRemove, selectedItemId, setSelectedItemId }: CategoryZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'CATEGORY_ITEM',
    drop: (item: { id: string }) => {
      onDrop(item.id, category.id)
      setSelectedItemId(null)
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop()
    })
  }), [category.id, setSelectedItemId])

  const handleZoneClick = () => {
    if (selectedItemId) {
      onDrop(selectedItemId, category.id)
      setSelectedItemId(null)
    }
  }

  return (
    <div 
      ref={drop}
      className={`category-zone ${isOver && canDrop ? 'drag-over' : ''} ${selectedItemId ? 'tap-target' : ''}`}
      style={{ borderColor: category.color }}
      onClick={handleZoneClick}
    >
      <div 
        className="category-zone-header"
        style={{ backgroundColor: category.color }}
      >
        <h3>{category.name}</h3>
        <span className="item-count">{items.length} รายการ</span>
      </div>
      <div 
        className="category-zone-content"
        style={{ 
          backgroundColor: `${category.color}15`,
          backgroundImage: category.backgroundImage ? `url(${category.backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          position: 'relative'
        }}
      >
        {category.backgroundImage && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            zIndex: 0
          }} />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {items.length === 0 ? (
            <p className="zone-empty">ลากรายการมาวางที่นี่</p>
          ) : (
            <div className="zone-items">
              {items.map(item => (
                <PlacedItem 
                  key={item.id} 
                  item={item} 
                  categoryColor={category.color}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Draggable Item Component
interface DraggableItemProps {
  item: PlayItem
  isSelected: boolean
  onSelect: (id: string) => void
}

function DraggableItem({ item, isSelected, onSelect }: DraggableItemProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CATEGORY_ITEM',
    item: { id: item.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [item.id])

  return (
    <div
      ref={drag}
      className={`draggable-item ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(item.id)}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="item-no-image">📷</div>
      )}
      <span className="item-name">{item.name}</span>
    </div>
  )
}

// Placed Item Component
interface PlacedItemProps {
  item: PlayItem
  categoryColor: string
  onRemove: (itemId: string) => void
}

function PlacedItem({ item, categoryColor, onRemove }: PlacedItemProps) {
  const isCorrect = item.categoryId === item.placedInCategoryId

  // ทำให้ลากได้อีกครั้ง
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'CATEGORY_ITEM',
    item: { id: item.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  }), [item.id])

  return (
    <div 
      ref={drag}
      className={`placed-item ${isCorrect ? 'correct' : 'incorrect'} ${isDragging ? 'dragging' : ''}`}
      title="ลากเพื่อย้าย หรือคลิกเพื่อนำออก"
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="item-no-image">📷</div>
      )}
      <span className="item-name">{item.name}</span>
      <div className="correctness-indicator">
        {isCorrect ? '✓' : '✗'}
      </div>
      <button 
        className="remove-btn"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(item.id)
        }}
        title="นำออก"
      >
        ✕
      </button>
    </div>
  )
}

export default PlayCategory
