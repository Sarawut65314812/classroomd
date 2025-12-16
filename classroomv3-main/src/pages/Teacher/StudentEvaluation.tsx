import { useState, useEffect } from 'react'
import './StudentEvaluation.css'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Student {
  id: string
  name: string
}

interface EvaluationCriteria {
  id: string
  description: string
}

function StudentEvaluation() {
  const [students, setStudents] = useState<Student[]>([])
  const [criteria, setCriteria] = useState<EvaluationCriteria[]>([])
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({})
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [isEditingCriteria, setIsEditingCriteria] = useState(false)
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null)
  const [editingCriteriaText, setEditingCriteriaText] = useState('')
  const [subjects, setSubjects] = useState<string[]>([])
  const [isManagingSubjects, setIsManagingSubjects] = useState(false)
  const [scoreOptions, setScoreOptions] = useState<Array<{value: number, label: string, color: string}>>([])
  const [editingScoreValue, setEditingScoreValue] = useState<number | null>(null)
  const [editingScoreLabel, setEditingScoreLabel] = useState('')
  const [teacherName, setTeacherName] = useState<string>('')
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFileName, setExportFileName] = useState<string>('')
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv')

  // เกณฑ์การประเมินเริ่มต้น 4 ข้อ
  const defaultCriteria: EvaluationCriteria[] = [
    { id: '1', description: 'มีความขยันหมั่นเพียร ตรงต่อเวลา' },
    { id: '2', description: 'มีความรับผิดชอบ ทั้งตนเองและส่วนรวม' },
    { id: '3', description: 'มีมารยาทดี ยิ้มแย้มแจ่มใส กล้าแสดงออก' },
    { id: '4', description: 'มีความมุ่งมั่นตั้งใจในการเรียน' }
  ]

  const defaultSubjects: string[] = []
  
  const defaultScoreOptions = [
    { value: 3, label: 'ดี', color: '#4CAF50' },
    { value: 2, label: 'พอใช้', color: '#FFC107' },
    { value: 1, label: 'ปรับปรุง', color: '#FF5722' }
  ]

  useEffect(() => {
    loadSubjects()
    loadStudents()
    loadCriteria()
    loadScores()
    loadScoreOptions()
    loadTeacherName()
  }, [selectedSubject])

  const loadSubjects = () => {
    const savedSubjects = localStorage.getItem('subjects')
    const list: string[] = savedSubjects ? JSON.parse(savedSubjects) : defaultSubjects
    const legacyDefaults = ['วิทยาศาสตร์', 'คณิตศาสตร์', 'ภาษาไทย', 'สังคม', 'ภาษาอังกฤษ', 'พละศึกษา', 'ศิลปะ']
    // If legacy defaults exist from previous versions, clear them to enforce empty start
    const isLegacySeed = Array.isArray(list) && list.length > 0 && list.every(s => legacyDefaults.includes(s))
    if (isLegacySeed) {
      localStorage.setItem('subjects', JSON.stringify([]))
      setSubjects([])
      setSelectedSubject('')
      setIsManagingSubjects(true)
      return
    }
    setSubjects(list)
    if (!savedSubjects) {
      // Do NOT seed defaults; start empty and let user add
      localStorage.setItem('subjects', JSON.stringify(list))
    }
    // Auto-select first subject if available, else clear selection and open manage dialog
    if (list.length > 0) {
      if (!selectedSubject || !list.includes(selectedSubject)) {
        setSelectedSubject(list[0])
      }
    } else {
      setSelectedSubject('')
      setIsManagingSubjects(true)
    }
  }

  const loadStudents = () => {
    // โหลดรายชื่อนักเรียนจาก localStorage
    const savedStudents = localStorage.getItem('students')
    if (savedStudents) {
      setStudents(JSON.parse(savedStudents))
    } else {
      // เริ่มต้นไม่มีข้อมูล ให้ครูเพิ่มเอง
      setStudents([])
    }
  }

  const loadCriteria = () => {
    if (!selectedSubject) {
      setCriteria([])
      return
    }
    const savedCriteria = localStorage.getItem(`criteria-${selectedSubject}`)
    if (savedCriteria) {
      setCriteria(JSON.parse(savedCriteria))
    } else {
      setCriteria(defaultCriteria)
    }
  }

  const loadScores = () => {
    if (!selectedSubject) {
      setScores({})
      return
    }
    const savedScores = localStorage.getItem(`evaluation-${selectedSubject}`)
    if (savedScores) {
      setScores(JSON.parse(savedScores))
    } else {
      setScores({})
    }
  }

  const loadScoreOptions = () => {
    const savedScoreOptions = localStorage.getItem('scoreOptions')
    if (savedScoreOptions) {
      setScoreOptions(JSON.parse(savedScoreOptions))
    } else {
      setScoreOptions(defaultScoreOptions)
      localStorage.setItem('scoreOptions', JSON.stringify(defaultScoreOptions))
    }
  }

  const loadTeacherName = () => {
    if (!selectedSubject) {
      setTeacherName('')
      return
    }
    const saved = localStorage.getItem(`teacher-${selectedSubject}`)
    setTeacherName(saved ? JSON.parse(saved) : '')
  }

  const saveTeacherName = (name: string) => {
    setTeacherName(name)
    if (selectedSubject) {
      localStorage.setItem(`teacher-${selectedSubject}`, JSON.stringify(name))
    }
  }

  const handleScoreChange = (studentId: string, criteriaId: string, score: number) => {
    setScores(prev => {
      const updated = {
        ...prev,
        [studentId]: {
          ...(prev[studentId] || {}),
          [criteriaId]: score
        }
      }
      // บันทึกลง localStorage
      localStorage.setItem(`evaluation-${selectedSubject}`, JSON.stringify(updated))
      return updated
    })
  }

  const getScore = (studentId: string, criteriaId: string): number | undefined => {
    return scores[studentId]?.[criteriaId]
  }

  const calculateAverage = (studentId: string): string => {
    const studentScores = scores[studentId]
    if (!studentScores) return '-'
    
    const scoreValues = Object.values(studentScores).filter(s => s > 0)
    if (scoreValues.length === 0) return '-'
    
    const avg = scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length
    return avg.toFixed(2)
  }

  const handleExport = () => {
    setExportFileName(`ประเมินพฤติกรรม-${selectedSubject}-${new Date().toLocaleDateString('th-TH')}`)
    setIsExportDialogOpen(true)
  }

  const confirmExport = () => {
    if (!exportFileName.trim()) {
      alert('กรุณากรอกชื่อไฟล์')
      return
    }

    const fileName = exportFileName.trim()

    if (exportFormat === 'csv') {
      exportCSV(fileName)
    } else if (exportFormat === 'excel') {
      exportExcel(fileName)
    } else if (exportFormat === 'pdf') {
      exportPDF(fileName)
    }

    setIsExportDialogOpen(false)
    setExportFileName('')
  }

  const exportCSV = (fileName: string) => {
    let csv = 'ที่,ชื่อ-สกุล,' + criteria.map(c => c.description).join(',') + ',เฉลี่ย\n'
    
    students.forEach((student, index) => {
      const row = [
        index + 1,
        student.name,
        ...criteria.map(c => {
          const score = getScore(student.id, c.id)
          return score ? scoreOptions.find(opt => opt.value === score)?.label || '' : ''
        }),
        calculateAverage(student.id)
      ]
      csv += row.map(cell => `"${cell}"`).join(',') + '\n'
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName}.csv`
    link.click()
  }

  const exportExcel = (fileName: string) => {
    // สร้าง header
    const headers = ['ที่', 'ชื่อ-สกุล', ...criteria.map(c => c.description), 'เฉลี่ย']

    // สร้าง data rows
    const data = students.map((student, index) => {
      return [
        index + 1,
        student.name,
        ...criteria.map(c => {
          const score = getScore(student.id, c.id)
          return score ? scoreOptions.find(opt => opt.value === score)?.label || '' : ''
        }),
        calculateAverage(student.id)
      ]
    })

    // สร้าง worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ประเมิน')

    // ตั้งความกว้างคอลัมน์
    ws['!cols'] = [
      { wch: 5 },  // ที่
      { wch: 20 }, // ชื่อ
      ...criteria.map(() => ({ wch: 15 })), // เกณฑ์
      { wch: 10 }  // เฉลี่ย
    ]

    XLSX.writeFile(wb, `${fileName}.xlsx`)
  }

  const exportPDF = async (fileName: string) => {
    try {
      // สร้าง HTML สำหรับ PDF
      const htmlContent = `
        <div style="padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="text-align: center; margin-bottom: 20px;">แบบประเมินพฤติกรรมนักเรียน</h2>
          <p><strong>วิชา:</strong> ${selectedSubject}</p>
          <p><strong>ครูผู้รับผิดชอบ:</strong> ${teacherName || '-'}</p>
          <p><strong>วันที่:</strong> ${new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          
          <table border="1" style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f0f0f0;">
                <th style="padding: 8px; text-align: center;">ที่</th>
                <th style="padding: 8px; text-align: center;">ชื่อ-สกุล</th>
                ${criteria.map((c, i) => `<th style="padding: 8px; text-align: center;">${i + 1}</th>`).join('')}
                <th style="padding: 8px; text-align: center;">เฉลี่ย</th>
              </tr>
            </thead>
            <tbody>
              ${students.map((student, idx) => `
                <tr>
                  <td style="padding: 8px; text-align: center;">${idx + 1}</td>
                  <td style="padding: 8px;">${student.name}</td>
                  ${criteria.map(c => {
                    const score = getScore(student.id, c.id)
                    const label = score ? scoreOptions.find(opt => opt.value === score)?.label || '' : ''
                    return `<td style="padding: 8px; text-align: center;">${label}</td>`
                  }).join('')}
                  <td style="padding: 8px; text-align: center;"><strong>${calculateAverage(student.id)}</strong></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div style="margin-top: 30px; font-size: 12px;">
            <div style="margin-bottom: 40px;">เกณฑ์การให้คะแนน: ${scoreOptions.map(opt => `${opt.label} = ${opt.value}`).join(', ')}</div>
            <div style="display: flex; justify-content: space-around;">
              <div style="text-align: center;">
                <div style="border-top: 1px solid #000; width: 150px; margin-bottom: 5px;"></div>
                <div>ลงชื่อผู้ประเมิน</div>
                <div style="margin-top: 20px;">..........................................</div>
              </div>
            </div>
          </div>
        </div>
      `

      // สร้าง canvas จาก HTML
      const element = document.createElement('div')
      element.innerHTML = htmlContent
      document.body.appendChild(element)

      const canvas = await html2canvas(element, { scale: 2, logging: false })
      document.body.removeChild(element)

      // สร้าง PDF
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgWidth = 210 // A4 width in mm
      const pageHeight = 297 // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`${fileName}.pdf`)
    } catch (error) {
      console.error('PDF export error:', error)
      alert('เกิดข้อผิดพลาดในการสร้าง PDF')
    }
  }

  const cancelExport = () => {
    setIsExportDialogOpen(false)
    setExportFileName('')
  }

  const handlePrint = () => {
    window.print()
  }

  const handleAddStudent = () => {
    const name = prompt('กรอกชื่อ-นามสกุลนักเรียน:')
    if (name && name.trim()) {
      const newStudent: Student = {
        id: `student-${Date.now()}`,
        name: name.trim()
      }
      const updatedStudents = [...students, newStudent]
      setStudents(updatedStudents)
      localStorage.setItem('students', JSON.stringify(updatedStudents))
    }
  }

  const handleDeleteStudent = (studentId: string) => {
    if (confirm('ต้องการลบนักเรียนคนนี้?')) {
      const updatedStudents = students.filter(s => s.id !== studentId)
      setStudents(updatedStudents)
      localStorage.setItem('students', JSON.stringify(updatedStudents))
      
      // ลบคะแนนด้วย
      const updatedScores = { ...scores }
      delete updatedScores[studentId]
      setScores(updatedScores)
      localStorage.setItem(`evaluation-${selectedSubject}`, JSON.stringify(updatedScores))
    }
  }

  const startEditCriteria = (criteriaId: string, currentText: string) => {
    setEditingCriteriaId(criteriaId)
    setEditingCriteriaText(currentText)
  }

  const saveCriteria = (criteriaId: string) => {
    if (editingCriteriaText.trim()) {
      const updatedCriteria = criteria.map(c => 
        c.id === criteriaId ? { ...c, description: editingCriteriaText.trim() } : c
      )
      setCriteria(updatedCriteria)
      localStorage.setItem(`criteria-${selectedSubject}`, JSON.stringify(updatedCriteria))
    }
    setEditingCriteriaId(null)
    setEditingCriteriaText('')
  }

  const cancelEditCriteria = () => {
    setEditingCriteriaId(null)
    setEditingCriteriaText('')
  }

  const toggleEditMode = () => {
    setIsEditingCriteria(!isEditingCriteria)
    if (editingCriteriaId) {
      cancelEditCriteria()
    }
  }

  const resetCriteria = () => {
    if (confirm('ต้องการรีเซ็ตเกณฑ์การประเมินกลับเป็นค่าเริ่มต้น?')) {
      setCriteria(defaultCriteria)
      localStorage.removeItem(`criteria-${selectedSubject}`)
    }
  }

  const deleteCriteria = (criteriaId: string) => {
    if (criteria.length <= 1) {
      alert('ต้องมีเกณฑ์การประเมินอย่างน้อย 1 ข้อ')
      return
    }
    
    if (confirm('ต้องการลบเกณฑ์การประเมินนี้?')) {
      const updatedCriteria = criteria.filter(c => c.id !== criteriaId)
      setCriteria(updatedCriteria)
      localStorage.setItem(`criteria-${selectedSubject}`, JSON.stringify(updatedCriteria))
      
      // ลบคะแนนที่เกี่ยวข้อง
      const updatedScores = { ...scores }
      Object.keys(updatedScores).forEach(studentId => {
        if (updatedScores[studentId][criteriaId]) {
          delete updatedScores[studentId][criteriaId]
        }
      })
      setScores(updatedScores)
      localStorage.setItem(`evaluation-${selectedSubject}`, JSON.stringify(updatedScores))
    }
  }

  const addNewCriteria = () => {
    const description = prompt('กรอกเกณฑ์การประเมินใหม่:')
    if (description && description.trim()) {
      const newCriteria: EvaluationCriteria = {
        id: `criteria-${Date.now()}`,
        description: description.trim()
      }
      const updatedCriteria = [...criteria, newCriteria]
      setCriteria(updatedCriteria)
      localStorage.setItem(`criteria-${selectedSubject}`, JSON.stringify(updatedCriteria))
    }
  }

  const startEditScore = (value: number, currentLabel: string) => {
    setEditingScoreValue(value)
    setEditingScoreLabel(currentLabel)
  }

  const saveScoreLabel = (value: number) => {
    if (editingScoreLabel.trim()) {
      const updatedScoreOptions = scoreOptions.map(opt =>
        opt.value === value ? { ...opt, label: editingScoreLabel.trim() } : opt
      )
      setScoreOptions(updatedScoreOptions)
      localStorage.setItem('scoreOptions', JSON.stringify(updatedScoreOptions))
    }
    setEditingScoreValue(null)
    setEditingScoreLabel('')
  }

  const cancelEditScore = () => {
    setEditingScoreValue(null)
    setEditingScoreLabel('')
  }

  const resetScoreOptions = () => {
    if (confirm('ต้องการรีเซ็ตชื่อเกณฑ์การให้คะแนนกลับเป็นค่าเริ่มต้น?')) {
      setScoreOptions(defaultScoreOptions)
      localStorage.setItem('scoreOptions', JSON.stringify(defaultScoreOptions))
    }
  }

  const toggleManageSubjects = () => {
    setIsManagingSubjects(!isManagingSubjects)
  }

  const addSubject = () => {
    const name = prompt('กรอกชื่อวิชาใหม่:')
    if (name && name.trim()) {
      if (subjects.includes(name.trim())) {
        alert('มีวิชานี้อยู่แล้ว')
        return
      }
      const updatedSubjects = [...subjects, name.trim()]
      setSubjects(updatedSubjects)
      localStorage.setItem('subjects', JSON.stringify(updatedSubjects))
    }
  }

  const deleteSubject = (subject: string) => {
    if (subjects.length <= 1) {
      alert('ต้องมีอย่างน้อย 1 วิชา')
      return
    }

    const hasData = localStorage.getItem(`evaluation-${subject}`)
    const confirmMsg = hasData 
      ? `ต้องการลบวิชา "${subject}"?\n⚠️ ข้อมูลการประเมินทั้งหมดของวิชานี้จะถูกลบด้วย`
      : `ต้องการลบวิชา "${subject}"?`

    if (confirm(confirmMsg)) {
      const updatedSubjects = subjects.filter(s => s !== subject)
      setSubjects(updatedSubjects)
      localStorage.setItem('subjects', JSON.stringify(updatedSubjects))

      // ลบข้อมูลที่เกี่ยวข้อง
      localStorage.removeItem(`criteria-${subject}`)
      localStorage.removeItem(`evaluation-${subject}`)

      // ถ้าวิชาที่ลบคือวิชาที่เลือกอยู่ ให้เปลี่ยนไปวิชาแรก
      if (selectedSubject === subject) {
        setSelectedSubject(updatedSubjects[0])
      }
    }
  }

  const editSubject = (oldName: string) => {
    const newName = prompt('แก้ไขชื่อวิชา:', oldName)
    if (newName && newName.trim() && newName.trim() !== oldName) {
      if (subjects.includes(newName.trim())) {
        alert('มีวิชานี้อยู่แล้ว')
        return
      }

      // อัปเดตชื่อวิชา
      const updatedSubjects = subjects.map(s => s === oldName ? newName.trim() : s)
      setSubjects(updatedSubjects)
      localStorage.setItem('subjects', JSON.stringify(updatedSubjects))

      // ย้ายข้อมูลไปยังชื่อใหม่
      const oldCriteria = localStorage.getItem(`criteria-${oldName}`)
      const oldEvaluation = localStorage.getItem(`evaluation-${oldName}`)

      if (oldCriteria) {
        localStorage.setItem(`criteria-${newName.trim()}`, oldCriteria)
        localStorage.removeItem(`criteria-${oldName}`)
      }
      if (oldEvaluation) {
        localStorage.setItem(`evaluation-${newName.trim()}`, oldEvaluation)
        localStorage.removeItem(`evaluation-${oldName}`)
      }

      // ถ้าวิชาที่แก้คือวิชาที่เลือกอยู่ ให้อัปเดตการเลือก
      if (selectedSubject === oldName) {
        setSelectedSubject(newName.trim())
      }
    }
  }

  return (
    <div className="evaluation-page">
      <div className="evaluation-header no-print">
        <div className="header-left">
          <button className="back-btn" onClick={() => window.history.back()}>
            ← กลับ
          </button>
          <h1>📋 ประเมินพฤติกรรมนักเรียน</h1>
        </div>
        <div className="header-right">
          <select 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="subject-select"
            title={subjects.length === 0 ? 'โปรดเพิ่มวิชาก่อน' : 'เลือกวิชา'}
          >
            {subjects.length === 0 && (
              <option value="" disabled>โปรดเพิ่มวิชาก่อน</option>
            )}
            {subjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          <button className="btn-secondary" onClick={toggleManageSubjects}>
            📚 จัดการวิชา
          </button>
          <button className="btn-secondary" onClick={handleAddStudent}>
            ➕ เพิ่มนักเรียน
          </button>
          <button 
            className={isEditingCriteria ? "btn-warning" : "btn-secondary"} 
            onClick={toggleEditMode}
          >
            {isEditingCriteria ? '✅ เสร็จสิ้น' : '✏️ แก้ไขหัวข้อ'}
          </button>
          {isEditingCriteria && (
            <>
              <button className="btn-secondary" onClick={addNewCriteria}>
                ➕ เพิ่มหัวข้อ
              </button>
              <button className="btn-secondary" onClick={resetCriteria}>
                🔄 รีเซ็ต
              </button>
            </>
          )}
          <button className="btn-primary" onClick={handleExport}>
            💾 Export CSV
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            🖨️ พิมพ์
          </button>
        </div>
      </div>

      {/* Teacher name bar (below header controls) */}
      <div className="teacher-bar no-print">
        <div className="teacher-bar-inner">
          <label htmlFor="teacherName" className="teacher-label">ครูผู้รับผิดชอบ:</label>
          <input
            id="teacherName"
            type="text"
            className="teacher-input"
            placeholder="ระบุชื่อครูผู้รับผิดชอบ"
            title="กรอกชื่อครูผู้รับผิดชอบ"
            value={teacherName}
            onChange={(e) => saveTeacherName(e.target.value)}
          />
        </div>
      </div>

      {/* Export Dialog Modal */}
      {isExportDialogOpen && (
        <div className="manage-subjects-modal">
          <div className="modal-content export-modal-content">
            <div className="modal-header">
              <h2>💾 Export</h2>
              <button className="close-btn" onClick={cancelExport}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <label className="export-file-label">เลือกรูปแบบไฟล์:</label>
              <div className="export-format-options">
                <label className="export-radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="csv"
                    checked={exportFormat === 'csv'}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel' | 'pdf')}
                    title="ส่งออกเป็นไฟล์ CSV"
                  />
                  📄 CSV
                </label>
                <label className="export-radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="excel"
                    checked={exportFormat === 'excel'}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel' | 'pdf')}
                    title="ส่งออกเป็นไฟล์ Excel"
                  />
                  📊 Excel
                </label>
                <label className="export-radio-label">
                  <input
                    type="radio"
                    name="exportFormat"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel' | 'pdf')}
                    title="ส่งออกเป็นไฟล์ PDF"
                  />
                  📕 PDF
                </label>
              </div>

              <label htmlFor="exportFileInput" className="export-file-label">ชื่อไฟล์:</label>
              <input
                id="exportFileInput"
                type="text"
                className="export-file-input"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                placeholder={`ชื่อไฟล์ (จะเพิ่ม .${exportFormat} โดยอัตโนมัติ)`}
                title="กรอกชื่อไฟล์สำหรับการ export"
                autoFocus
              />
              <div className="export-modal-buttons">
                <button className="btn-primary" onClick={confirmExport}>
                  ✓ ยืนยัน
                </button>
                <button className="btn-secondary" onClick={cancelExport}>
                  ✕ ยกเลิก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isManagingSubjects && (
        <div className="manage-subjects-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>📚 จัดการรายวิชา</h2>
              <button className="close-btn" onClick={toggleManageSubjects}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="subjects-list">
                {subjects.map((subject) => (
                  <div key={subject} className="subject-item">
                    <span className="subject-name">{subject}</span>
                    <div className="subject-actions">
                      <button
                        className="btn-edit"
                        onClick={() => editSubject(subject)}
                        title="แก้ไขชื่อวิชา"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => deleteSubject(subject)}
                        title="ลบวิชา"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-add-subject" onClick={addSubject}>
                ➕ เพิ่มวิชาใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="evaluation-info print-only">
        <h2>แบบประเมินพฤติกรรมนักเรียน</h2>
        <p>วิชา: {selectedSubject}</p>
        <p>ครูผู้รับผิดชอบ: {teacherName || '-'}</p>
        <p>วันที่: {new Date().toLocaleDateString('th-TH', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>

      <div className="score-legend no-print">
        <span className="legend-title">เกณฑ์การให้คะแนน:</span>
        {scoreOptions.map(opt => (
          <span key={opt.value} className="legend-item" style={{ color: opt.color }}>
            {editingScoreValue === opt.value ? (
              <span className="score-edit-inline">
                <input
                  type="text"
                  value={editingScoreLabel}
                  onChange={(e) => setEditingScoreLabel(e.target.value)}
                  className="score-input"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') saveScoreLabel(opt.value)
                  }}
                />
                <button className="btn-save-inline" onClick={() => saveScoreLabel(opt.value)}>✓</button>
                <button className="btn-cancel-inline" onClick={cancelEditScore}>✕</button>
              </span>
            ) : (
              <span 
                className="score-label-editable" 
                onClick={() => startEditScore(opt.value, opt.label)}
                title="คลิกเพื่อแก้ไข"
              >
                <strong>{opt.label}</strong> = {opt.value}
              </span>
            )}
          </span>
        ))}
        <button className="btn-reset-scores" onClick={resetScoreOptions} title="รีเซ็ตชื่อคะแนน">
          🔄
        </button>
      </div>

      <div className="evaluation-table-container">
        <table className="evaluation-table">
          <thead>
            <tr>
              <th className="col-no">ที่</th>
              <th className="col-name">ชื่อ-สกุล</th>
              {criteria.map((c, index) => (
                <th key={c.id} className="col-criteria">
                  <div className="criteria-header editable">
                    <span className="criteria-number">{index + 1}</span>
                    {editingCriteriaId === c.id ? (
                      <div className="criteria-edit-box">
                        <textarea
                          value={editingCriteriaText}
                          onChange={(e) => setEditingCriteriaText(e.target.value)}
                          className="criteria-textarea"
                          autoFocus
                          rows={3}
                        />
                        <div className="edit-buttons">
                          <button 
                            className="btn-save"
                            onClick={() => saveCriteria(c.id)}
                          >
                            ✓
                          </button>
                          <button 
                            className="btn-cancel"
                            onClick={cancelEditCriteria}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="criteria-edit-container">
                        <div 
                          className="criteria-text clickable"
                          onClick={() => startEditCriteria(c.id, c.description)}
                          title="คลิกเพื่อแก้ไข"
                        >
                          {c.description}
                          <span className="edit-icon">✏️</span>
                        </div>
                        {isEditingCriteria && (
                          <button
                            className="btn-delete-criteria"
                            onClick={() => deleteCriteria(c.id)}
                            title="ลบหัวข้อนี้"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>                </th>
              ))}
              <th className="col-avg">เฉลี่ย</th>
              <th className="col-actions no-print">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => (
              <tr key={student.id}>
                <td className="cell-center">{index + 1}</td>
                <td className="cell-name">{student.name}</td>
                {criteria.map(c => {
                  const currentScore = getScore(student.id, c.id)
                  return (
                    <td key={c.id} className="cell-score">
                      <div className="score-buttons">
                        {scoreOptions.map(opt => (
                          <button
                            key={opt.value}
                            className={`score-btn ${currentScore === opt.value ? 'active' : ''}`}
                            style={{
                              backgroundColor: currentScore === opt.value ? opt.color : '#f0f0f0',
                              color: currentScore === opt.value ? 'white' : '#666'
                            }}
                            onClick={() => handleScoreChange(student.id, c.id, opt.value)}
                            title={opt.label}
                          >
                            {opt.value}
                          </button>
                        ))}
                      </div>
                    </td>
                  )
                })}
                <td className="cell-center cell-avg">
                  <strong>{calculateAverage(student.id)}</strong>
                </td>
                <td className="cell-center no-print">
                  <button 
                    className="btn-delete"
                    onClick={() => handleDeleteStudent(student.id)}
                    title="ลบนักเรียน"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div className="empty-state">
          <p>📝 ยังไม่มีรายชื่อนักเรียน</p>
          <button className="btn-primary" onClick={handleAddStudent}>
            เพิ่มนักเรียนคนแรก
          </button>
        </div>
      )}

      <div className="evaluation-footer no-print">
        <div className="stats">
          <span>จำนวนนักเรียน: <strong>{students.length}</strong> คน</span>
          <span>วิชา: <strong>{selectedSubject}</strong></span>
          <span>เกณฑ์ประเมิน: <strong>{criteria.length}</strong> ข้อ</span>
        </div>
      </div>
    </div>
  )
}

export default StudentEvaluation
