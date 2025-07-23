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

  generateResumePDF(resumeData) {
    const { jsPDF } = window.jspdf
    const doc = new jsPDF()

    let yPosition = 20
    const lineHeight = 7
    const pageWidth = doc.internal.pageSize.width
    const margin = 20

    // Helper function to add text with word wrapping
    const addText = (text, fontSize = 12, isBold = false) => {
      doc.setFontSize(fontSize)
      if (isBold) {
        doc.setFont(undefined, "bold")
      } else {
        doc.setFont(undefined, "normal")
      }

      const lines = doc.splitTextToSize(text, pageWidth - 2 * margin)
      lines.forEach((line) => {
        if (yPosition > 280) {
          // Check if we need a new page
          doc.addPage()
          yPosition = 20
        }
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })
    }

    // Header
    addText(resumeData.fullName || "Your Name", 20, true)
    yPosition += 5

    const contactInfo = [resumeData.email, resumeData.phone].filter(Boolean).join(" | ")

    addText(contactInfo, 12)
    yPosition += 10

    // Professional Summary
    if (resumeData.summary) {
      addText("PROFESSIONAL SUMMARY", 14, true)
      yPosition += 3
      addText(resumeData.summary, 11)
      yPosition += 10
    }

    // Experience
    if (resumeData.experience) {
      addText("EXPERIENCE", 14, true)
      yPosition += 3
      addText(resumeData.experience, 11)
      yPosition += 10
    }

    // Education
    if (resumeData.education) {
      addText("EDUCATION", 14, true)
      yPosition += 3
      addText(resumeData.education, 11)
      yPosition += 10
    }

    // Skills
    if (resumeData.skills) {
      addText("SKILLS", 14, true)
      yPosition += 3
      addText(resumeData.skills, 11)
    }

    return doc
  }

  downloadPDF(doc, filename = "resume.pdf") {
    doc.save(filename)
  }
}

// Global instance
const pdfUtils = new PDFUtils()
