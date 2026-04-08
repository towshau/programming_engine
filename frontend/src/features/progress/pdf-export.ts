import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * Capture the DOM element identified by `elementId` as a WYSIWYG screenshot
 * and embed it into an A4-landscape jsPDF document, then trigger download.
 *
 * Recharts SVG elements are captured correctly because html2canvas renders the
 * live DOM (not a server snapshot).  Chart animations should be disabled
 * before calling this (isAnimationActive={false} on Recharts components) to
 * avoid partially-drawn captures.
 */
export async function downloadProgressReport(
  elementId: string,
  memberName: string,
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) {
    console.error(`[pdf-export] Element #${elementId} not found`)
    return
  }

  const canvas = await html2canvas(element, {
    useCORS: true,
    backgroundColor: '#f0f2f5', // matches --bg
    scale: 2, // retina sharpness
    logging: false,
    // Ensure full scroll height is captured, not just the visible viewport
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  })

  const imgData = canvas.toDataURL('image/png')

  // A4 landscape in mm: 297 × 210
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  // Scale the capture to fit the page width, preserving aspect ratio
  const aspectRatio = canvas.height / canvas.width
  const imgWidth = pageWidth
  const imgHeight = imgWidth * aspectRatio

  if (imgHeight <= pageHeight) {
    // Fits on a single page
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
  } else {
    // Multi-page: slice the image vertically to fill additional pages
    const totalPages = Math.ceil(imgHeight / pageHeight)
    for (let i = 0; i < totalPages; i++) {
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, -(i * pageHeight), imgWidth, imgHeight)
    }
  }

  const safeName = memberName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  const dateStr = new Date().toISOString().split('T')[0]
  pdf.save(`${safeName}-Progress-Report-${dateStr}.pdf`)
}
