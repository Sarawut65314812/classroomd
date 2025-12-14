/**
 * ป้องกันการดาวน์โหลดรูปภาพเมื่อกดค้าง (Long press / Right click)
 * สำหรับ Interactive Display, Windows Touch, Safari, Chrome
 */
(function() {
  'use strict';

  // ป้องกัน context menu (right click) บนรูปภาพ
  document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG' || e.target.closest('img')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, true);

  // ป้องกัน touch callout บน iOS/Safari
  document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'IMG') {
      e.target.style.webkitTouchCallout = 'none';
    }
  }, { passive: true });

  // ป้องกัน drag รูปภาพ
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      return false;
    }
  }, true);

  // เพิ่ม CSS ป้องกันให้รูปภาพทั้งหมด
  var style = document.createElement('style');
  style.textContent = `
    img {
      -webkit-touch-callout: none !important;
      -webkit-user-select: none !important;
      -khtml-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-user-drag: none !important;
      -khtml-user-drag: none !important;
      -moz-user-drag: none !important;
      -o-user-drag: none !important;
      user-drag: none !important;
      pointer-events: auto;
    }
  `;
  document.head.appendChild(style);

  // สำหรับ Windows Touch / Interactive Display
  // ป้องกัน long press ที่แปลงเป็น right click
  var longPressTimer;
  document.addEventListener('pointerdown', function(e) {
    if (e.target.tagName === 'IMG' && e.pointerType === 'touch') {
      longPressTimer = setTimeout(function() {
        // ยกเลิก default behavior
      }, 500);
    }
  }, { passive: true });

  document.addEventListener('pointerup', function(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  }, { passive: true });

  document.addEventListener('pointercancel', function(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
    }
  }, { passive: true });

  console.log('Image download protection loaded');
})();
