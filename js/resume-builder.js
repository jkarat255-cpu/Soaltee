// Resume builder functionality
import { PDFUtils } from "./pdf-utils.js";
import { GeminiAPI } from "./gemini-api.js";
// Remove showLoading import, use global showLoading instead

export class ResumeBuilder {
  constructor() {
    this.currentResumeData = {}
    this.templates = {
      professional: this.professionalTemplate,
      modern: this.modernTemplate,
      creative: this.creativeTemplate,
    }
    this.currentTemplate = "professional"
  }

  async analyzeExistingResume(file) {
    try {
      const pdfUtils = new PDFUtils();
      const geminiAPI = new GeminiAPI();
      const text = await pdfUtils.extractTextFromPDF(file)
      const analysis = await geminiAPI.generateContent(
        `Analyze this resume text and extract structured information:
                
                ${text}
                
                Extract and format as JSON:
                {
                    "fullName": "",
                    "email": "",
                    "phone": "",
                    "summary": "",
                    "experience": "",
                    "education": "",
                    "skills": ""
                }
                
                Return only the JSON object.`,
      )

      try {
        const resumeData = JSON.parse(analysis)
        this.populateForm(resumeData)
        return resumeData
      } catch (parseError) {
        console.error("Error parsing resume analysis:", parseError)
        return null
      }
    } catch (error) {
      console.error("Error analyzing resume:", error)
      throw error
    }
  }

  populateForm(data) {
    const fields = ["fullName", "email", "phone", "summary", "experience", "education", "skills"]

    fields.forEach((field) => {
      const element = document.getElementById(field)
      if (element && data[field]) {
        element.value = data[field]
      }
    })

    this.updatePreview()
  }

  collectFormData() {
    return {
      fullName: document.getElementById("fullName")?.value || "",
      email: document.getElementById("email")?.value || "",
      phone: document.getElementById("phone")?.value || "",
      summary: document.getElementById("summary")?.value || "",
      experience: document.getElementById("experience")?.value || "",
      education: document.getElementById("education")?.value || "",
      skills: document.getElementById("skills")?.value || "",
    }
  }

  updatePreview() {
    const data = this.collectFormData()
    console.log('[ResumeBuilder] updatePreview called with:', data)
    this.currentResumeData = data

    const preview = document.getElementById("resumePreview")
    if (preview) {
      preview.innerHTML = this.templates[this.currentTemplate](data)
    }

    // Enable download button if we have basic info
    const downloadBtn = document.getElementById("downloadResumeBtn")
    if (downloadBtn) {
      downloadBtn.disabled = !data.fullName || !data.email
    }
  }

  professionalTemplate(data) {
    return `
            <div class="resume-template">
                <div class="contact-info">
                    <h1>${data.fullName || "Your Name"}</h1>
                    <p>${[data.email, data.phone].filter(Boolean).join(" | ")}</p>
                </div>
                
                ${
                  data.summary
                    ? `
                <div class="section">
                    <h2>Professional Summary</h2>
                    <p>${data.summary}</p>
                </div>
                `
                    : ""
                }
                
                ${
                  data.experience
                    ? `
                <div class="section">
                    <h2>Experience</h2>
                    <div>${data.experience.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.education
                    ? `
                <div class="section">
                    <h2>Education</h2>
                    <div>${data.education.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.skills
                    ? `
                <div class="section">
                    <h2>Skills</h2>
                    <p>${data.skills}</p>
                </div>
                `
                    : ""
                }
            </div>
        `
  }

  modernTemplate(data) {
    return `
            <div class="resume-template" style="font-family: Arial, sans-serif;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; margin: -20px -20px 20px -20px;">
                    <h1 style="margin: 0; font-size: 28px;">${data.fullName || "Your Name"}</h1>
                    <p style="margin: 5px 0 0 0; opacity: 0.9;">${[data.email, data.phone].filter(Boolean).join(" | ")}</p>
                </div>
                
                ${
                  data.summary
                    ? `
                <div class="section">
                    <h2 style="color: #667eea; border-bottom: 2px solid #667eea;">Professional Summary</h2>
                    <p>${data.summary}</p>
                </div>
                `
                    : ""
                }
                
                ${
                  data.experience
                    ? `
                <div class="section">
                    <h2 style="color: #667eea; border-bottom: 2px solid #667eea;">Experience</h2>
                    <div>${data.experience.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.education
                    ? `
                <div class="section">
                    <h2 style="color: #667eea; border-bottom: 2px solid #667eea;">Education</h2>
                    <div>${data.education.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.skills
                    ? `
                <div class="section">
                    <h2 style="color: #667eea; border-bottom: 2px solid #667eea;">Skills</h2>
                    <p>${data.skills}</p>
                </div>
                `
                    : ""
                }
            </div>
        `
  }

  creativeTemplate(data) {
    return `
            <div class="resume-template" style="font-family: 'Georgia', serif;">
                <div style="text-align: left; border-left: 5px solid #e74c3c; padding-left: 20px; margin-bottom: 30px;">
                    <h1 style="margin: 0; color: #2c3e50; font-size: 32px;">${data.fullName || "Your Name"}</h1>
                    <p style="margin: 5px 0 0 0; color: #7f8c8d; font-style: italic;">${[data.email, data.phone].filter(Boolean).join(" | ")}</p>
                </div>
                
                ${
                  data.summary
                    ? `
                <div class="section">
                    <h2 style="color: #e74c3c; border-bottom: 3px solid #e74c3c; display: inline-block; padding-bottom: 5px;">Professional Summary</h2>
                    <p style="font-style: italic; color: #34495e;">${data.summary}</p>
                </div>
                `
                    : ""
                }
                
                ${
                  data.experience
                    ? `
                <div class="section">
                    <h2 style="color: #e74c3c; border-bottom: 3px solid #e74c3c; display: inline-block; padding-bottom: 5px;">Experience</h2>
                    <div style="color: #34495e;">${data.experience.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.education
                    ? `
                <div class="section">
                    <h2 style="color: #e74c3c; border-bottom: 3px solid #e74c3c; display: inline-block; padding-bottom: 5px;">Education</h2>
                    <div style="color: #34495e;">${data.education.replace(/\n/g, "<br>")}</div>
                </div>
                `
                    : ""
                }
                
                ${
                  data.skills
                    ? `
                <div class="section">
                    <h2 style="color: #e74c3c; border-bottom: 3px solid #e74c3c; display: inline-block; padding-bottom: 5px;">Skills</h2>
                    <p style="color: #34495e;">${data.skills}</p>
                </div>
                `
                    : ""
                }
            </div>
        `
  }

  async getSuggestions() {
    const data = this.collectFormData()

    if (!data.fullName && !data.experience && !data.skills) {
      alert("Please fill in some basic information first.")
      return
    }

    try {
      window.showLoading(true)
      const geminiAPI = new GeminiAPI();
      const suggestions = await geminiAPI.generateResumeSuggestions(data)

      // Display suggestions in a modal or alert
      alert(`Resume Improvement Suggestions:\n\n${suggestions}`)
    } catch (error) {
      console.error("Error getting suggestions:", error)
      alert("Error getting suggestions. Please try again.")
    } finally {
      window.showLoading(false)
    }
  }

  generatePDF() {
    const data = this.collectFormData()

    if (!data.fullName || !data.email) {
      alert("Please fill in at least your name and email.")
      return
    }

    try {
      const pdfUtils = new PDFUtils();
      const pdf = pdfUtils.generateResumePDF(data)
      pdfUtils.downloadPDF(pdf, `${data.fullName.replace(/\s+/g, "_")}_Resume.pdf`)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF. Please try again.")
    }
  }

  setTemplate(templateName) {
    if (this.templates[templateName]) {
      this.currentTemplate = templateName
      this.updatePreview()
    }
  }
}

// Global instance
const resumeBuilder = new ResumeBuilder()
