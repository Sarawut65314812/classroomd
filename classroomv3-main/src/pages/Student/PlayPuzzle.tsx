import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MouseTransition, TouchTransition } from 'react-dnd-multi-backend'
import { MultiBackend } from 'react-dnd-multi-backend'
import { useEffect, useState } from 'react'
import PuzzleBoard from '../../components/PuzzleBoard'
import { usePuzzle } from '../../hooks/usePuzzle'
import { audioManager } from '../../utils/audio'
import './PlayPuzzle.css'

// Multi-backend configuration สำหรับรองรับทั้งเมาส์และทัช
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

function PlayPuzzle() {
  const [isMusicPlaying, setIsMusicPlaying] = useState(true)
  const {
    difficulty,
    imageUrl,
    started,
    puzzleConfigs,
    selectedConfig,
    isLoading,
    error,
    toast,
    setDifficulty,
    handleImageUpload,
    handleConfigSelect,
    handleStart,
    setStarted,
    clearToast,
  } = usePuzzle()

  // เล่นเพลง background เมื่อเริ่มเกม
  useEffect(() => {
    if (started) {
      audioManager.playBackgroundMusic()
    } else {
      audioManager.pauseBackgroundMusic()
    }

    // Cleanup: หยุดเพลงเมื่อออกจากหน้านี้
    return () => {
      audioManager.pauseBackgroundMusic()
    }
  }, [started])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleImageUpload(file)
    }
  }

  const handleMusicToggle = () => {
    const isPlaying = audioManager.toggleBackgroundMusic()
    setIsMusicPlaying(isPlaying)
    audioManager.playClick()
  }

  if (started && imageUrl) {
    return (
      <DndProvider backend={MultiBackend} options={HTML5toTouch}>
        <div className="puzzle-page">
          <div className="puzzle-header">
            <h1>🧩 จิ๊กซอว์</h1>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="music-toggle-btn"
                onClick={handleMusicToggle}
                title={isMusicPlaying ? 'ปิดเพลง' : 'เปิดเพลง'}
                style={{
                  padding: '10px 15px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  border: '2px solid #667eea',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {isMusicPlaying ? '🔊' : '🔇'}
              </button>
              <button className="back-btn" onClick={() => setStarted(false)}>
                ← เริ่มใหม่
              </button>
            </div>
          </div>
          <PuzzleBoard imageUrl={imageUrl} difficulty={difficulty} />
          
          <div className="mascot">
            <div className="mascot-avatar">🦊</div>
            <div className="mascot-speech">ต่อให้สำเร็จนะ!</div>
          </div>
        </div>
      </DndProvider>
    )
  }

  // Loading Overlay
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <div className="puzzle-setup">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`} onClick={clearToast}>
          {toast.message}
        </div>
      )}

      <div className="setup-header">
        <h1>🧩 เกมจิ๊กซอว์</h1>
        <button className="back-btn" onClick={() => window.history.back()}>
          ← กลับ
        </button>
      </div>

      <div className="setup-container">
        {puzzleConfigs.length > 0 && (
          <div className="setup-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>📦 เลือกชุดจิ๊กซอว์จากครู</h2>
              <span style={{ color: '#999', fontSize: '0.9rem' }}>👆 เลื่อนดูรูปเพิ่ม →</span>
            </div>
            <div className="config-list">
              {puzzleConfigs.map(config => (
                <div 
                  key={config.id} 
                  className={`config-item ${selectedConfig === config.id ? 'selected' : ''}`}
                  onClick={() => handleConfigSelect(config.id)}
                >
                  <img src={config.imageUrl} alt={config.name} />
                  <div className="config-info">
                    <h3>{config.name}</h3>
                    <span className="difficulty-badge">{config.difficulty === 'easy' ? 'ง่าย' : config.difficulty === 'medium' ? 'ปานกลาง' : 'ยาก'}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="divider">หรือ</div>
          </div>
        )}
        
        <div className="setup-card">
          <h2>1. เลือกรูปภาพ</h2>
          <div className="upload-area">
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              id="puzzle-upload"
              className="file-input-hidden"
              disabled={isLoading}
            />
            <label 
              htmlFor="puzzle-upload" 
              className={`upload-label ${isLoading ? 'loading' : ''} ${error ? 'error' : ''}`}
            >
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Preview" 
                  className={`preview-image ${isLoading ? 'loading' : ''}`}
                  loading="lazy"
                />
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-icon">📸</span>
                  <p>คลิกเพื่ออัปโหลดรูป</p>
                  <p style={{ fontSize: '0.9rem', color: '#999', marginTop: '8px' }}>
                    JPG, PNG, GIF หรือ WEBP (สูงสุด 10MB)
                  </p>
                </div>
              )}
            </label>
            {error && (
              <p style={{ color: '#ef4444', marginTop: '10px', textAlign: 'center' }}>
                ⚠️ {error}
              </p>
            )}
          </div>
        </div>

        <div className="setup-card">
          <h2>2. เลือกระดับความยาก</h2>
          <div className="difficulty-buttons">
            <button
              className={`difficulty-btn ${difficulty === 'easy' ? 'active' : ''}`}
              onClick={() => setDifficulty('easy')}
              disabled={isLoading}
              aria-label="เลือกระดับง่าย"
            >
              <div className="difficulty-icon">😊</div>
              <div className="difficulty-name">ง่าย</div>
              <div className="difficulty-desc">9 ชิ้น (3×3)</div>
            </button>
            
            <button
              className={`difficulty-btn ${difficulty === 'medium' ? 'active' : ''}`}
              onClick={() => setDifficulty('medium')}
              disabled={isLoading}
              aria-label="เลือกระดับปานกลาง"
            >
              <div className="difficulty-icon">🤔</div>
              <div className="difficulty-name">ปานกลาง</div>
              <div className="difficulty-desc">16 ชิ้น (4×4)</div>
            </button>
            
            <button
              className={`difficulty-btn ${difficulty === 'hard' ? 'active' : ''}`}
              onClick={() => setDifficulty('hard')}
              disabled={isLoading}
              aria-label="เลือกระดับยาก"
            >
              <div className="difficulty-icon">🤯</div>
              <div className="difficulty-name">ยาก</div>
              <div className="difficulty-desc">25 ชิ้น (5×5)</div>
            </button>
          </div>
        </div>

        <button 
          className={`start-btn ${isLoading ? 'loading' : ''}`}
          onClick={handleStart}
          disabled={isLoading}
          aria-label="เริ่มเล่นเกมจิ๊กซอว์"
        >
          {isLoading ? 'กำลังโหลด...' : '🎮 เริ่มเล่น!'}
        </button>
      </div>

      <div className="mascot">
        <div className="mascot-avatar">🦊</div>
        <div className="mascot-speech">ต่อจิ๊กซอว์สนุกนะ!</div>
      </div>
    </div>
  )
}

export default PlayPuzzle
