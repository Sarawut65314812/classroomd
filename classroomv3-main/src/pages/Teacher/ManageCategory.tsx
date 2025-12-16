import { useState, useEffect } from 'react'
import { getCategories, saveCategories, getCategoryItems, saveCategoryItems, Category, CategoryItem } from '../../services/storage'
import './ManageCategory.css'

function ManageCategory() {
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<CategoryItem[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingItem, setEditingItem] = useState<CategoryItem | null>(null)

  // Form states
  const [categoryName, setCategoryName] = useState('')
  const [categoryColor, setCategoryColor] = useState('#FF6B6B')
  const [categoryBackgroundImage, setCategoryBackgroundImage] = useState('')
  
  const [itemName, setItemName] = useState('')
  const [itemImage, setItemImage] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setCategories(getCategories())
    setItems(getCategoryItems())
  }

  // === Category Management ===
  const openCategoryModal = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
      setCategoryName(category.name)
      setCategoryColor(category.color)
      setCategoryBackgroundImage(category.backgroundImage || '')
    } else {
      setEditingCategory(null)
      setCategoryName('')
      setCategoryColor('#FF6B6B')
      setCategoryBackgroundImage('')
    }
    setShowCategoryModal(true)
  }

  const saveCategoryHandler = () => {
    if (!categoryName.trim()) {
      alert('กรุณากรอกชื่อหมวดหมู่')
      return
    }

    const newCategories = [...categories]
    
    if (editingCategory) {
      // Edit existing
      const index = newCategories.findIndex(c => c.id === editingCategory.id)
      if (index !== -1) {
        newCategories[index] = {
          ...newCategories[index],
          name: categoryName,
          color: categoryColor,
          backgroundImage: categoryBackgroundImage
        }
      }
    } else {
      // Add new
      const newCategory: Category = {
        id: Date.now().toString(),
        name: categoryName,
        color: categoryColor,
        backgroundImage: categoryBackgroundImage,
        order: categories.length
      }
      newCategories.push(newCategory)
    }

    saveCategories(newCategories)
    loadData()
    setShowCategoryModal(false)
  }

  const deleteCategory = (categoryId: string) => {
    if (!confirm('ต้องการลบหมวดหมู่นี้? (รายการในหมวดหมู่จะไม่ถูกลบ)')) return
    
    const newCategories = categories.filter(c => c.id !== categoryId)
    saveCategories(newCategories)
    loadData()
  }

  // === Item Management ===
  const openItemModal = (item?: CategoryItem) => {
    if (item) {
      setEditingItem(item)
      setItemName(item.name)
      setItemImage(item.imageUrl)
      setItemCategoryId(item.categoryId)
    } else {
      setEditingItem(null)
      setItemName('')
      setItemImage('')
      setItemCategoryId(categories[0]?.id || '')
    }
    setShowItemModal(true)
  }

  const saveItemHandler = () => {
    if (!itemName.trim()) {
      alert('กรุณากรอกชื่อรายการ')
      return
    }
    if (!itemCategoryId) {
      alert('กรุณาเลือกหมวดหมู่')
      return
    }

    const newItems = [...items]
    
    if (editingItem) {
      // Edit existing
      const index = newItems.findIndex(i => i.id === editingItem.id)
      if (index !== -1) {
        newItems[index] = {
          ...newItems[index],
          name: itemName,
          imageUrl: itemImage,
          categoryId: itemCategoryId
        }
      }
    } else {
      // Add new
      const newItem: CategoryItem = {
        id: Date.now().toString(),
        name: itemName,
        imageUrl: itemImage,
        categoryId: itemCategoryId,
        order: items.length
      }
      newItems.push(newItem)
    }

    saveCategoryItems(newItems)
    loadData()
    setShowItemModal(false)
  }

  const deleteItem = (itemId: string) => {
    if (!confirm('ต้องการลบรายการนี้?')) return
    
    const newItems = items.filter(i => i.id !== itemId)
    saveCategoryItems(newItems)
    loadData()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      setItemImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      setCategoryBackgroundImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const resetData = () => {
    if (!confirm('ต้องการรีเซ็ตข้อมูลทั้งหมด?')) return
    
    saveCategories([])
    saveCategoryItems([])
    loadData()
  }

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'ไม่ระบุ'
  }

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#999'
  }

  const getItemsByCategory = (categoryId: string) => {
    return items.filter(i => i.categoryId === categoryId)
  }

  return (
    <div className="manage-category-page">
      <div className="category-header">
        <div>
          <h1>🗂️ เกมจัดหมวดหมู่</h1>
          <p className="subtitle">เพิ่มหมวดหมู่และรายการสำหรับให้เด็กจัดหมวดหมู่</p>
        </div>
        <button className="back-btn" onClick={() => window.history.back()}>
          ← กลับ
        </button>
      </div>

      <div className="action-buttons">
        <button className="btn-add-category" onClick={() => openCategoryModal()}>
          ➕ เพิ่มหมวดหมู่
        </button>
        <button className="btn-add-item" onClick={() => openItemModal()}>
          ➕ เพิ่มรายการ
        </button>
        <button className="btn-reset" onClick={resetData}>
          🔄 รีเซ็ต
        </button>
      </div>

      <div className="content-grid">
        {/* Categories Section */}
        <div className="section categories-section">
          <h2>หมวดหมู่ที่สร้างไว้ ({categories.length})</h2>
          <div className="categories-list">
            {categories.length === 0 ? (
              <p className="empty-state">ยังไม่มีหมวดหมู่ กดเพิ่มหมวดหมู่ด้านบน</p>
            ) : (
              categories.map(category => (
                <div key={category.id} className="category-card">
                  <div 
                    className="category-color-bar" 
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="category-info">
                    <h3>{category.name}</h3>
                    <p className="category-count">
                      {getItemsByCategory(category.id).length} รายการ
                    </p>
                  </div>
                  <div className="category-actions">
                    <button 
                      className="btn-edit"
                      onClick={() => openCategoryModal(category)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-delete"
                      onClick={() => deleteCategory(category.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Items Section */}
        <div className="section items-section">
          <h2>รายการทั้งหมด ({items.length})</h2>
          <div className="items-grid">
            {items.length === 0 ? (
              <p className="empty-state">ยังไม่มีรายการ กดเพิ่มรายการด้านบน</p>
            ) : (
              items.map(item => (
                <div key={item.id} className="item-card">
                  <div className="item-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} />
                    ) : (
                      <div className="no-image">📷</div>
                    )}
                  </div>
                  <div className="item-info">
                    <h4>{item.name}</h4>
                    <span 
                      className="item-category-tag"
                      style={{ backgroundColor: getCategoryColor(item.categoryId) }}
                    >
                      {getCategoryName(item.categoryId)}
                    </span>
                  </div>
                  <div className="item-actions">
                    <button 
                      className="btn-edit-small"
                      onClick={() => openItemModal(item)}
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-delete-small"
                      onClick={() => deleteItem(item.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowCategoryModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingCategory ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h2>
            
            <div className="form-group">
              <label>ชื่อหมวดหมู่ *</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="เช่น ผลไม้, สัตว์, ผัก"
              />
            </div>

            <div className="form-group">
              <label>เลือกสี</label>
              <div className="color-picker-grid">
                {['#FF6B6B', '#4ECDC4', '#45B7D1', '#F7DC6F', '#BB8FCE', '#85C1E2', '#FF8E53', '#98D8C8'].map(color => (
                  <button
                    key={color}
                    className={`color-option ${categoryColor === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setCategoryColor(color)}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>รูปพื้นหลัง (แสดงจางๆ)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleCategoryImageUpload}
                style={{ marginBottom: '10px' }}
              />
              <input
                type="text"
                value={categoryBackgroundImage}
                onChange={(e) => setCategoryBackgroundImage(e.target.value)}
                placeholder="หรือใส่ URL รูปภาพ"
              />
              {categoryBackgroundImage && (
                <div className="image-preview">
                  <img src={categoryBackgroundImage} alt="Background Preview" />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowCategoryModal(false)}>
                ยกเลิก
              </button>
              <button className="btn-save" onClick={saveCategoryHandler}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingItem ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}</h2>
            
            <div className="form-group">
              <label>ชื่อรายการ *</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="เช่น แอปเปิ้ล, กล้วย, แมว"
              />
            </div>

            <div className="form-group">
              <label>เลือกหมวดหมู่ *</label>
              <select
                value={itemCategoryId}
                onChange={(e) => setItemCategoryId(e.target.value)}
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>รูปภาพ (เลือกหรือพิมพ์ URL)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ marginBottom: '10px' }}
              />
              <input
                type="text"
                value={itemImage}
                onChange={(e) => setItemImage(e.target.value)}
                placeholder="หรือใส่ URL รูปภาพ"
              />
              {itemImage && (
                <div className="image-preview">
                  <img src={itemImage} alt="Preview" />
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowItemModal(false)}>
                ยกเลิก
              </button>
              <button className="btn-save" onClick={saveItemHandler}>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ManageCategory
