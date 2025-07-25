// PDF utilities for resume processing
export class PDFUtils {
  constructor() {
    this.pdfjsLib = window["pdfjs-dist/build/pdf"]
    this.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
  }

  async extractTextFromPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await this.pdfjsLib.getDocument(arrayBuffer).promise
      let fullText = ""

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item) => item.str).join(" ")
        fullText += pageText + "\n"
      }

      return fullText.trim()
    } catch (error) {
      console.error("Error extracting text from PDF:", error)
      throw error
    }
  }

  generateResumePDF(resumeData, template = 'professional') {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()

    // Set white background for all pages
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    let yPosition = 20
    const lineHeight = 7
    const margin = 20

    // Helper function to add text with word wrapping
    const addText = (text, fontSize = 12, isBold = false, color = [0,0,0], font = 'normal') => {
      doc.setFontSize(fontSize)
      doc.setTextColor(...color)
      if (isBold) {
        doc.setFont(undefined, "bold")
      } else {
        doc.setFont(undefined, font)
      }
      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin)
      lines.forEach((line) => {
        if (yPosition > 280) {
          doc.addPage()
          doc.setFillColor(255, 255, 255)
          doc.rect(0, 0, pageWidth, pageHeight, 'F')
          yPosition = 20
        }
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })
    }

    if (template === 'modern') {
      // Modern: colored header, white text, colored section titles
      doc.setFillColor(102, 126, 234) // blue gradient start
      doc.rect(0, 0, pageWidth, 30, 'F')
      doc.setTextColor(255,255,255)
      doc.setFontSize(22)
      doc.setFont(undefined, 'bold')
      doc.text(resumeData.fullName || 'Your Name', margin, 18)
      doc.setFontSize(12)
      doc.setFont(undefined, 'normal')
      doc.text([
        [resumeData.email, resumeData.phone].filter(Boolean).join(' | ')
      ], margin, 27)
      yPosition = 40
      const sectionColor = [102, 126, 234]
      doc.setTextColor(0,0,0)
      if (resumeData.summary) {
        addText('Professional Summary', 14, true, sectionColor)
        addText(resumeData.summary, 11)
        yPosition += 5
      }
      if (resumeData.experience) {
        addText('Experience', 14, true, sectionColor)
        addText(resumeData.experience, 11)
        yPosition += 5
      }
      if (resumeData.education) {
        addText('Education', 14, true, sectionColor)
        addText(resumeData.education, 11)
        yPosition += 5
      }
      if (resumeData.skills) {
        addText('Skills', 14, true, sectionColor)
        addText(resumeData.skills, 11)
      }
    } else if (template === 'classic') {
      // Classic: serif font, underlined section headers
      doc.setFont('times', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(0,0,0)
      doc.text(resumeData.fullName || 'Your Name', margin, yPosition)
      yPosition += 8
      doc.setFont('times', 'normal')
      doc.setFontSize(12)
      doc.text([
        [resumeData.email, resumeData.phone].filter(Boolean).join(' | ')
      ], margin, yPosition)
      yPosition += 10
      const underline = (label) => {
        doc.setFont('times', 'bold')
        doc.text(label, margin, yPosition)
        const labelWidth = doc.getTextWidth(label)
        doc.setDrawColor(0,0,0)
        doc.setLineWidth(0.5)
        doc.line(margin, yPosition+1, margin+labelWidth, yPosition+1)
        yPosition += 5
        doc.setFont('times', 'normal')
      }
      if (resumeData.summary) {
        underline('Professional Summary')
        addText(resumeData.summary, 11, false, [0,0,0], 'times')
        yPosition += 5
      }
      if (resumeData.experience) {
        underline('Experience')
        addText(resumeData.experience, 11, false, [0,0,0], 'times')
        yPosition += 5
      }
      if (resumeData.education) {
        underline('Education')
        addText(resumeData.education, 11, false, [0,0,0], 'times')
        yPosition += 5
      }
      if (resumeData.skills) {
        underline('Skills')
        addText(resumeData.skills, 11, false, [0,0,0], 'times')
      }
    } else {
      // Default: professional
      addText(resumeData.fullName || "Your Name", 20, true)
      yPosition += 5
      const contactInfo = [resumeData.email, resumeData.phone].filter(Boolean).join(" | ")
      addText(contactInfo, 12)
      yPosition += 10
      if (resumeData.summary) {
        addText("PROFESSIONAL SUMMARY", 14, true)
        yPosition += 3
        addText(resumeData.summary, 11)
        yPosition += 10
      }
      if (resumeData.experience) {
        addText("EXPERIENCE", 14, true)
        yPosition += 3
        addText(resumeData.experience, 11)
        yPosition += 10
      }
      if (resumeData.education) {
        addText("EDUCATION", 14, true)
        yPosition += 3
        addText(resumeData.education, 11)
        yPosition += 10
      }
      if (resumeData.skills) {
        addText("SKILLS", 14, true)
        yPosition += 3
        addText(resumeData.skills, 11)
      }
    }
    return doc
  }

  downloadPDF(doc, filename = "resume.pdf") {
    doc.save(filename)
  }
}

// Global instance
const pdfUtils = new PDFUtils()
