import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  getGames, 
  updateGame, 
  toggleGame,
  getImages,
  saveImage,
  deleteImage,
  getStudentProgress,
  exportProgressCSV,
  GameConfig,
  ImageAsset
} from '../../services/storage'
import './Dashboard.css'

type Tab = 'games' | 'images' | 'progress'

function Dashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('games')
  const [games, setGames] = useState<GameConfig[]>([])
  const [images, setImages] = useState<ImageAsset[]>([])
  const [progress, setProgress] = useState<any[]>([])
  const [editingGame, setEditingGame] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<GameConfig>>({})

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = () => {
    setGames(getGames())
    setImages(getImages())
    setProgress(getStudentProgress())
  }

  // === Game Management ===
  const handleToggleGame = (gameId: string) => {
    toggleGame(gameId)
    loadData()
  }

  const startEdit = (game: GameConfig) => {
    setEditingGame(game.id)
    setEditForm(game)
  }

  const saveEdit = () => {
    if (editingGame && editForm) {
      updateGame(editingGame, editForm)
      setEditingGame(null)
      setEditForm({})
      loadData()
    }
  }

  const cancelEdit = () => {
    setEditingGame(null)
    setEditForm({})
  }

  const moveGame = (gameId: string, direction: 'up' | 'down') => {
    // Filter เฉพาะเกมที่มีจริง
    const activeGames = games.filter(game => ['coloring', 'puzzle', 'category'].includes(game.id))
    const sorted = [...activeGames].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex(g => g.id === gameId)
    if (index === -1) return
    
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= sorted.length) return

    // Swap orders
    const temp = sorted[index].order
    updateGame(sorted[index].id, { order: sorted[newIndex].order })
    updateGame(sorted[newIndex].id, { order: temp })
    loadData()
  }

  // === Image Management ===
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: ImageAsset['category']) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      saveImage({
        name: file.name,
        url,
        category
      })
      loadData()
    }
    reader.readAsDataURL(file)
  }

  const handleDeleteImage = (imageId: string) => {
    if (confirm('ต้องการลบรูปนี้หรือไม่?')) {
      deleteImage(imageId)
      loadData()
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>👩‍🏫 จัดการห้องเรียน</h1>
        <button className="back-btn" onClick={() => window.history.back()}>
          ← กลับหน้าหลัก
        </button>
      </div>

      {/* Advanced Management Links */}
      <div className="management-links">
        <h3>🛠️ การจัดการขั้นสูง</h3>
        <div className="links-grid">
          <button className="link-card" onClick={() => navigate('/teacher/evaluation')}>
            <span className="icon">📋</span>
            <span className="title">ประเมินพฤติกรรมนักเรียน</span>
            <span className="desc">กรอกตารางประเมิน</span>
          </button>
          <button className="link-card" onClick={() => navigate('/teacher/puzzle')}>
            <span className="icon">🧩</span>
            <span className="title">จัดการเกมจิ๊กซอว์</span>
            <span className="desc">สร้างชุดจิ๊กซอว์</span>
          </button>
          <button className="link-card" onClick={() => navigate('/teacher/category')}>
            <span className="icon">🗂️</span>
            <span className="title">จัดการเกมจัดหมวดหมู่</span>
            <span className="desc">เพิ่มหมวดหมู่และรายการ</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-btn ${activeTab === 'games' ? 'active' : ''}`}
          onClick={() => setActiveTab('games')}
        >
          🎮 จัดการเกม
        </button>
        <button 
          className={`tab-btn ${activeTab === 'images' ? 'active' : ''}`}
          onClick={() => setActiveTab('images')}
        >
          🖼️ คลังรูปภาพ
        </button>
        <button 
          className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('progress')}
          disabled
          style={{ opacity: 0.5, cursor: 'not-allowed' }}
          title="กำลังพัฒนา"
        >
          📊 สถิติการเรียน (กำลังพัฒนา)
        </button>
      </div>

      <div className="dashboard-content">
        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className="games-management">
            <h2>จัดการเกมที่แสดงในหน้าหลัก</h2>
            <div className="games-list">
              {games
                .filter(game => ['coloring', 'puzzle', 'category'].includes(game.id))
                .sort((a, b) => a.order - b.order)
                .map(game => (
                <div key={game.id} className={`game-item ${!game.enabled ? 'disabled' : ''}`}>
                  {editingGame === game.id ? (
                    <div className="game-edit-form">
                      <input
                        type="text"
                        value={editForm.name || ''}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="ชื่อเกม"
                      />
                      <input
                        type="text"
                        value={editForm.icon || ''}
                        onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })}
                        placeholder="ไอคอน (emoji)"
                        maxLength={2}
                      />
                      <textarea
                        value={editForm.description || ''}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="คำอธิบาย"
                        rows={2}
                      />
                      <div className="edit-actions">
                        <button onClick={saveEdit} className="save-btn">✅ บันทึก</button>
                        <button onClick={cancelEdit} className="cancel-btn">❌ ยกเลิก</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="game-info">
                        <span className="game-icon-large">{game.icon}</span>
                        <div>
                          <h3>{game.name}</h3>
                          <p>{game.description}</p>
                        </div>
                      </div>
                      <div className="game-actions">
                        <button onClick={() => moveGame(game.id, 'up')} title="เลื่อนขึ้น">⬆️</button>
                        <button onClick={() => moveGame(game.id, 'down')} title="เลื่อนลง">⬇️</button>
                        <button onClick={() => startEdit(game)} className="edit-btn">✏️ แก้ไข</button>
                        <button 
                          onClick={() => handleToggleGame(game.id)}
                          className={game.enabled ? 'toggle-btn enabled' : 'toggle-btn disabled'}
                        >
                          {game.enabled ? '👁️ แสดง' : '🚫 ซ่อน'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div className="images-management">
            <h2>คลังรูปภาพ</h2>
            
            <div className="upload-section">
              <h3>อัปโหลดรูปใหม่</h3>
              <div className="upload-categories">
                {(['coloring', 'puzzle'] as const).map(category => (
                  <div key={category} className="upload-box">
                    <label className="upload-label">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, category)}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-placeholder">
                        <span className="upload-icon">📤</span>
                        <p>{category === 'coloring' ? 'ระบายสี' : 'จิ๊กซอว์'}</p>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="images-gallery">
              {(['coloring', 'puzzle', 'other'] as const).map(category => {
                const categoryImages = images.filter(img => img.category === category)
                if (categoryImages.length === 0) return null
                
                return (
                  <div key={category} className="category-section">
                    <h3>
                      {category === 'coloring' ? '🎨 ระบายสี' : 
                       category === 'puzzle' ? '🧩 จิ๊กซอว์' : '📁 อื่นๆ'}
                      <span className="count">({categoryImages.length})</span>
                    </h3>
                    <div className="images-grid">
                      {categoryImages.map(img => (
                        <div key={img.id} className="image-card">
                          <img src={img.url} alt={img.name} />
                          <div className="image-overlay">
                            <p className="image-name">{img.name}</p>
                            <button 
                              onClick={() => handleDeleteImage(img.id)}
                              className="delete-image-btn"
                            >
                              🗑️ ลบ
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Progress Tab - Coming Soon */}
        {activeTab === 'progress' && (
          <div className="progress-management">
            <div className="coming-soon-box">
              <div className="coming-soon-icon">🚧</div>
              <h2>ฟีเจอร์สถิติการเรียน</h2>
              <p className="coming-soon-text">กำลังอยู่ระหว่างการพัฒนา</p>
              <p className="coming-soon-description">
                เร็วๆ นี้คุณจะสามารถดูสถิติการเรียนของนักเรียน<br />
                ติดตามความคืบหน้า และส่งออกรายงานได้
              </p>
              <div className="coming-soon-features">
                <div className="feature-item">✓ ดูคะแนนนักเรียนแต่ละคน</div>
                <div className="feature-item">✓ ติดตามความคืบหน้า</div>
                <div className="feature-item">✓ ส่งออกรายงาน CSV</div>
                <div className="feature-item">✓ วิเคราะห์ข้อมูลเชิงลึก</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
