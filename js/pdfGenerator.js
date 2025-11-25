// PDF generation function extracted for reuse
async function shareResult(config) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Extract config values with defaults
    const topic = config.topic || 'ไม่ระบุ';
    const playerName = config.playerName || 'ไม่ระบุชื่อ';
    const scoreText = config.scoreText || '0/0';
    const resultMessage = config.resultMessage || 'ไม่มีข้อความ';
    const date = new Date();
    const dateStr = date.toLocaleDateString('th-TH');
    const timeStr = date.toLocaleTimeString('th-TH');

    // --- Background ---
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');

    // --- Header ---
    doc.setFillColor(93, 93, 180);
    doc.roundedRect(15, 15, 180, 25, 5, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('รายงานผลการประเมิน', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Smart Classroom Learning System', 105, 33, { align: 'center' });

    // --- Score Box ---
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(1);
    doc.roundedRect(15, 50, 180, 35, 5, 5, 'S');
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(12);
    doc.text('คะแนนที่ได้รับ', 105, 60, { align: 'center' });

    // --- Score ---
    doc.setFontSize(32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 180, 0);
    doc.text(scoreText, 60, 77, { align: 'center' });

    // --- Result Message ---
    doc.setFillColor(255, 200, 100);
    doc.roundedRect(120, 64, 70, 15, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(resultMessage, 155, 74, { align: 'center' });

    // --- Topic ---
    doc.setFillColor(255, 220, 130);
    doc.rect(15, 95, 180, 10, 'F');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('ครั้งที่ 1 - ' + topic, 20, 102);

    // --- Teacher Info Box ---
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(15, 110, 180, 45, 3, 3, 'S');
    doc.setFontSize(12);
    doc.text(`ชื่อผู้เล่น: ${playerName}`, 20, 120);
    doc.text(`วันที่: ${dateStr}`, 20, 130);
    doc.text(`เวลา: ${timeStr}`, 20, 140);

    // --- Save PDF ---
    doc.save(`ผลการประเมิน_${playerName}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('เกิดข้อผิดพลาดในการสร้าง PDF');
  }
}