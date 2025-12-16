import { useState, useEffect } from 'react'
import {
  getPuzzleConfigs,
  savePuzzleConfig,
  deletePuzzleConfig,
  getImages,
  PuzzleConfig
} from '../../services/storage'
import './ManagePuzzle.css'

function ManagePuzzle() {
  const [configs, setConfigs] = useState<PuzzleConfig[]>([])
  const [images, setImages] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    imageUrl: '',
    difficulty: 'easy' as 'easy' | 'medium' | 'hard'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setConfigs(getPuzzleConfigs())
    setImages(getImages().filter(img => img.category === 'puzzle'))
  }

  const handleSubmit = () => {
    if (!formData.name || !formData.imageUrl) {
      alert('กรุณากรอกชื่อและเลือกรูปภาพ')
      return
    }

    savePuzzleConfig(formData)
    setFormData({ name: '', imageUrl: '', difficulty: 'easy' })
    setShowForm(false)
    loadData()
  }

  const handleDelete = (id: string) => {
    if (confirm('ต้องการลบชุดจิ๊กซอว์นี้หรือไม่?')) {
      deletePuzzleConfig(id)
      loadData()
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      setFormData({ ...formData, imageUrl: url })
    }
    reader.readAsDataURL(file)
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'ง่าย (3×3)'
      case 'medium': return 'ปานกลาง (4×4)'
      case 'hard': return 'ยาก (5×5)'
      default: return difficulty
    }
  }

  return (
    <div className="manage-puzzle">
      <div className="page-header">
        <h1>🧩 จัดการเกมจิ๊กซอว์</h1>
        <div className="header-actions">
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
          <button className="add-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? '❌ ยกเลิก' : '➕ เพิ่มชุดจิ๊กซอว์'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="puzzle-form">
          <h2>➕ เพิ่มชุดจิ๊กซอว์ใหม่</h2>
          
          <div className="form-group">
            <label>ชื่อชุดจิ๊กซอว์</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="เช่น สัตว์น่ารัก, ผลไม้"
            />
          </div>

          <div className="form-group">
            <label>ระดับความยาก</label>
            <div className="difficulty-options">
              <label className={`difficulty-option ${formData.difficulty === 'easy' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="difficulty"
                  value="easy"
                  checked={formData.difficulty === 'easy'}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                />
                <div className="option-content">
                  <span className="icon">😊</span>
                  <span className="text">ง่าย</span>
                  <span className="desc">3×3 (9 ชิ้น)</span>
                </div>
              </label>

              <label className={`difficulty-option ${formData.difficulty === 'medium' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="difficulty"
                  value="medium"
                  checked={formData.difficulty === 'medium'}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                />
                <div className="option-content">
                  <span className="icon">🤔</span>
                  <span className="text">ปานกลาง</span>
                  <span className="desc">4×4 (16 ชิ้น)</span>
                </div>
              </label>

              <label className={`difficulty-option ${formData.difficulty === 'hard' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="difficulty"
                  value="hard"
                  checked={formData.difficulty === 'hard'}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                />
                <div className="option-content">
                  <span className="icon">🤯</span>
                  <span className="text">ยาก</span>
                  <span className="desc">5×5 (25 ชิ้น)</span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>รูปภาพ</label>
            {formData.imageUrl ? (
              <div className="selected-image">
                <img src={formData.imageUrl} alt="Selected" />
                <button onClick={() => setFormData({ ...formData, imageUrl: '' })}>
                  ❌ ลบ
                </button>
              </div>
            ) : (
              <div className="image-selector">
                <label className="upload-btn">
                  📤 อัปโหลดรูปใหม่
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                </label>

                <div className="divider">หรือเลือกจากคลัง</div>

                <div className="gallery-images">
                  {images.length === 0 ? (
                    <p className="no-images">ยังไม่มีรูปในคลัง อัปโหลดรูปใหม่หรือไปที่หน้าคลังรูปภาพ</p>
                  ) : (
                    images.map(img => (
                      <img
                        key={img.id}
                        src={img.url}
                        alt={img.name}
                        onClick={() => setFormData({ ...formData, imageUrl: img.url })}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button className="submit-btn" onClick={handleSubmit}>
              ✅ เพิ่มชุดจิ๊กซอว์
            </button>
            <button className="cancel-btn" onClick={() => setShowForm(false)}>
              ❌ ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="configs-list">
        <h2>ชุดจิ๊กซอว์ทั้งหมด ({configs.length} ชุด)</h2>
        
        {configs.length === 0 ? (
          <div className="empty-state">
            <p>ยังไม่มีชุดจิ๊กซอว์</p>
            <small>กดปุ่ม "เพิ่มชุดจิ๊กซอว์" เพื่อเริ่มต้น</small>
          </div>
        ) : (
          <div className="configs-grid">
            {configs.map(config => (
              <div key={config.id} className="config-card">
                <img src={config.imageUrl} alt={config.name} />
                <div className="config-info">
                  <h3>{config.name}</h3>
                  <p className="difficulty">{getDifficultyText(config.difficulty)}</p>
                  <p className="date">
                    สร้างเมื่อ {new Date(config.createdAt).toLocaleDateString('th-TH')}
                  </p>
                </div>
                <button onClick={() => handleDelete(config.id)} className="delete-btn">
                  🗑️ ลบ
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ManagePuzzle
