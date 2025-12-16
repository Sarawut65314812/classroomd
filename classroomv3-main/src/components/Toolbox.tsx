import { audioManager } from '../utils/audio'
import './Toolbox.css'

interface ToolboxProps {
  currentColor: string
  onColorChange: (color: string) => void
  brushSize: number
  onBrushSizeChange: (size: number) => void
  onUndo: () => void
  onClear: () => void
  onSave: () => void
  showOutline: boolean
  onToggleOutline: () => void
  isEraser: boolean
  onToggleEraser: () => void
}

const COLORS = [
  // แถวที่ 1: สีชมพู
  '#FF2E63', '#FF6B9D', '#FF69B4', '#FFB6D9', '#FFC0CB',
  // แถวที่ 2: สีเหลือง-ส้ม
  '#FFC75F', '#FFD700', '#FFA500', '#FF8C00', '#FF6347',
  // แถวที่ 3: สีแดง-บานเงา
  '#E74C3C', '#DC143C', '#C71585', '#8B0000', '#FF1493',
  // แถวที่ 4: สีม่วง
  '#9C27B0', '#673AB7', '#7B68EE', '#8A2BE2', '#DA70D6',
  // แถวที่ 5: สีฟ้า
  '#3F51B5', '#00BCD4', '#00D2FC', '#00B4D8', '#1E90FF',
  // แถวที่ 6: สีเขียว
  '#4ECDC4', '#52BE80', '#2ECC71', '#32CD32', '#00FF00',
  // แถวที่ 7: สีน้ำตาล-เทา
  '#F7DC6F', '#FFB347', '#D2B48C', '#A9A9A9', '#808080',
  // แถวที่ 8: สีดำ-ขาว
  '#000000', '#FFFFFF', '#696969', '#C0C0C0', '#CCCCCC'
]

function Toolbox({
  currentColor,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  onUndo,
  onClear,
  onSave,
  showOutline,
  onToggleOutline,
  isEraser,
  onToggleEraser
}: ToolboxProps) {
  
  const handleColorClick = (color: string) => {
    onColorChange(color)
    audioManager.playClick()
  }

  return (
    <div className="toolbox">
      <h3>🎨 เครื่องมือ</h3>

      <div className="tool-section">
        <label>🎨 เลือกสี</label>
        <div className="color-palette">
          {COLORS.map(color => (
            <button
              key={color}
              className={`color-btn ${currentColor === color ? 'active' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorClick(color)}
              aria-label={`เลือกสี ${color}`}
            />
          ))}
        </div>
        <div className="color-picker-container">
          <input
            type="color"
            value={currentColor}
            onChange={(e) => {
              onColorChange(e.target.value)
              audioManager.playClick()
            }}
            className="color-picker"
            aria-label="เลือกสีเองด้วย color picker"
          />
          <span className="color-code">{currentColor.toUpperCase()}</span>
        </div>
      </div>

      <div className="tool-section">
        <label>🖌️ ขนาดพู่กัน: {brushSize}px</label>
        <input
          type="range"
          min="2"
          max="50"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="slider"
        />
        <div className="brush-preview" style={{
          width: brushSize,
          height: brushSize,
          backgroundColor: currentColor
        }} />
      </div>

      <div className="tool-section">
        <label>🖌️ โหมด</label>
        <div className="button-group">
          <button 
            className={`tool-btn ${!isEraser ? 'active' : ''}`} 
            onClick={() => { if (isEraser) onToggleEraser(); audioManager.playClick(); }}
          >
            ✏️ พู่กัน
          </button>
          <button 
            className={`tool-btn ${isEraser ? 'active' : ''}`} 
            onClick={() => { if (!isEraser) onToggleEraser(); audioManager.playClick(); }}
          >
            🧹 ยางลบ
          </button>
        </div>
      </div>

      <div className="tool-section">
        <button className="tool-btn" onClick={() => { onToggleOutline(); audioManager.playClick(); }}>
          {showOutline ? '👁️ ซ่อนเส้นขอบ' : '👁️ แสดงเส้นขอบ'}
        </button>
      </div>

      <div className="tool-section">
        <button className="tool-btn secondary" onClick={onUndo}>
          ↶ ย้อนกลับ
        </button>
        <button className="tool-btn danger" onClick={onClear}>
          🗑️ ลบทั้งหมด
        </button>
        <button className="tool-btn success" onClick={onSave}>
          💾 บันทึก
        </button>
      </div>
    </div>
  )
}

export default Toolbox
    