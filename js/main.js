import { ResumeBuilder } from './resume-builder.js';
import { ConfidenceAnalyzer } from './tensorflow-analysis.js';
import { GeminiAPI } from './gemini-api.js';
import { SpeechManager } from './speech-recognition.js';
import { PDFUtils } from './pdf-utils.js';
import { CodeEditor } from './code-editor.js';
import { JobManager } from './job-management.js';

// Main application logic
class JobPrepApp {
  constructor() {
    this.currentRole = null
    this.currentSection = null
    this.interviewState = {
      questions: [],
      currentQuestionIndex: 0,
      answers: [],
      isRecording: false,
      isTechnical: false,
      confidenceScores: [],
    }
    this.mediaStream = null
    this.confidenceAnalyzer = new ConfidenceAnalyzer();
    this.speechManager = new SpeechManager();
    this.resumeBuilder = new ResumeBuilder();
    this.geminiAPI = new GeminiAPI();
    this.pdfUtils = new PDFUtils();
    this.codeEditor = new CodeEditor();
    this.jobManager = new JobManager();
    this.init()
  }

  async init() {
    // Initialize all components
    await this.initializeComponents()
    this.setupEventListeners()
    this.showSection("roleSelection")
  }

  async initializeComponents() {
    try {
      // Initialize TensorFlow models
      await this.confidenceAnalyzer.initialize()

      // Initialize speech recognition
      this.speechManager.initialize()

      // Set up speech callbacks
      this.speechManager.setTranscriptCallback((transcript, final) => {
        this.updateTranscript(transcript, final)
      })

      this.speechManager.setRecordingCompleteCallback((finalTranscript) => {
        this.handleRecordingComplete(finalTranscript)
      })

      console.log("All components initialized successfully")
    } catch (error) {
      console.error("Error initializing components:", error)
    }
  }

  setupEventListeners() {
    // Role selection buttons
    document.getElementById("jobSeekerBtn")?.addEventListener("click", () => this.selectRole("jobseeker"))
    document.getElementById("employerBtn")?.addEventListener("click", () => this.selectRole("employer"))

    // Resume builder form listeners
    const resumeFields = ["fullName", "email", "phone", "summary", "experience", "education", "skills"]
    resumeFields.forEach((field) => {
      const element = document.getElementById(field)
      if (element) {
        element.addEventListener("input", () => this.resumeBuilder.updatePreview())
      }
    })

    // File upload listeners
    document.getElementById("existingResume")?.addEventListener("change", this.handleResumeUpload.bind(this))
    document.getElementById("resumeFile")?.addEventListener("change", this.handleMockResumeUpload.bind(this))
  }

  selectRole(role) {
    this.currentRole = role
    this.showSection(role === "jobseeker" ? "jobSeekerDashboard" : "employerDashboard")
  }

  showSection(sectionId) {
    // Hide all sections
    const sections = [
      "roleSelection",
      "jobSeekerDashboard",
      "employerDashboard",
      "interviewPractice",
      "practiceSetup",
      "mockSetup",
      "interviewInterface",
      "interviewResults",
      "resumeBuilder",
      "jobSearch",
      "postJob",
      "manageJobs",
      "candidates",
    ]

    sections.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        element.classList.add("hidden")
      }
    })

    // Show selected section
    const targetSection = document.getElementById(sectionId)
    if (targetSection) {
      targetSection.classList.remove("hidden")
      targetSection.classList.add("fade-in")
    }

    this.currentSection = sectionId

    // Initialize section-specific functionality
    if (sectionId === "resumeBuilder") {
      this.resumeBuilder.updatePreview()
    } else if (sectionId === "jobSearch") {
      this.loadJobListings()
    } else if (sectionId === "manageJobs") {
      this.loadPostedJobs()
    } else if (sectionId === "candidates") {
      this.loadCandidates()
    }
  }

  // Interview Practice Functions
  startPracticeInterview() {
    this.showSection("practiceSetup")
  }

  startMockInterview() {
    this.showSection("mockSetup")
  }

  async initializePracticeInterview() {
    const jobTitle = document.getElementById("practiceJobTitle")?.value
    const isTechnical = document.querySelector('input[name="isTechnical"]:checked')?.value === "yes"

    if (!jobTitle.trim()) {
      alert("Please enter a job title or topic.")
      return
    }

    try {
      showLoading(true)

      // Reset interview state
      this.interviewState = {
        questions: [],
        currentQuestionIndex: 0,
        answers: [],
        isRecording: false,
        isTechnical: isTechnical,
        confidenceScores: [],
        jobTitle: jobTitle,
        isMockInterview: false,
        behavioralQuestions: [],
        codingQuestions: [],
      }

      // Generate the first 10 questions up front (5 behavioral, 5 coding for technical)
      const questionsText = await this.geminiAPI.generateInterviewQuestions(jobTitle, isTechnical, 10)
      const questions = questionsText
        .split("\n")
        .filter((q) => q.trim())
        .map((q) => q.replace(/^\d+\.\s*/, "").trim())
        .slice(0, 10)
      this.interviewState.questions = questions
      if (isTechnical) {
        this.interviewState.behavioralQuestions = questions.slice(0, 5)
        this.interviewState.codingQuestions = questions.slice(5, 10)
      }

      // Initialize camera and start interview
      await this.setupCamera()
      this.showSection("interviewInterface")
      this.confidenceAnalyzer.startAnalysis()
      this.startConfidenceMonitoring()
      this.displayCurrentQuestion()
    } catch (error) {
      console.error("Error initializing practice interview:", error)
      alert("Error starting interview. Please try again.")
    } finally {
      showLoading(false)
    }
  }

  async initializeMockInterview() {
    const resumeFile = document.getElementById("resumeFile")?.files[0]
    const jobDescription = document.getElementById("jobDescription")?.value
    const isTechnical = document.querySelector('input[name="mockIsTechnical"]:checked')?.value === "yes"

    if (!jobDescription.trim()) {
      alert("Please provide a job description.")
      return
    }

    try {
      showLoading(true)
      let resumeText = ""
      if (resumeFile) {
        // Extract resume text if provided
        resumeText = await this.pdfUtils.extractTextFromPDF(resumeFile)
      }
      // Generate all 10 questions at once
      let questionsText
      if (resumeText) {
        questionsText = await this.geminiAPI.generateMockInterviewQuestions(resumeText, jobDescription, isTechnical)
      } else {
        // If no resume, use only job description
        questionsText = await this.geminiAPI.generateInterviewQuestions(jobDescription, isTechnical, 10)
      }
      const questions = questionsText
        .split("\n")
        .filter((q) => q.trim())
        .map((q) => q.replace(/^\d+\.\s*/, "").trim())
        .slice(0, 10)

      // Reset interview state
      this.interviewState = {
        questions: questions,
        currentQuestionIndex: 0,
        answers: [],
        isRecording: false,
        isTechnical: isTechnical,
        confidenceScores: [],
        resumeText: resumeText,
        jobDescription: jobDescription,
        isMockInterview: true,
      }

      // Initialize camera and start interview
      await this.setupCamera()
      this.showSection("interviewInterface")
      this.confidenceAnalyzer.startAnalysis()
      this.startConfidenceMonitoring()
      this.displayCurrentQuestion()
    } catch (error) {
      console.error("Error initializing mock interview:", error)
      alert("Error starting mock interview. Please try again.")
    } finally {
      showLoading(false)
    }
  }

  async setupCamera() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      const videoElement = document.getElementById("userVideo")
      if (videoElement) {
        videoElement.srcObject = this.mediaStream
      }
      // Do NOT start confidence analysis here
      // this.confidenceAnalyzer.startAnalysis()
      // this.startConfidenceMonitoring()
    } catch (error) {
      console.error("Error accessing camera:", error)
      alert("Camera access is required for the interview. Please allow camera permissions.")
    }
  }

  startConfidenceMonitoring() {
    const videoElement = document.getElementById("userVideo")
    const confidenceElement = document.getElementById("confidenceScore")
    const indicator = document.getElementById("confidenceIndicator")

    const analyzeFrame = async () => {
      console.log('[JobPrepApp] Monitoring loop running.');
      if (this.currentSection === "interviewInterface" && videoElement) {
        console.log('[JobPrepApp] Calling analyzeFrame...');
        const score = await this.confidenceAnalyzer.analyzeFrame(videoElement)

        if (confidenceElement) {
          confidenceElement.textContent = score
        }

        // Update indicator color based on confidence
        if (indicator) {
          indicator.className = indicator.className.replace(/confidence-\w+/, "")
          if (score >= 70) {
            indicator.classList.add("confidence-high")
          } else if (score >= 50) {
            indicator.classList.add("confidence-medium")
          } else {
            indicator.classList.add("confidence-low")
          }
        }

        // Continue monitoring
        setTimeout(analyzeFrame, 333) // ~3fps
      } else {
        console.log('[JobPrepApp] Monitoring loop stopped or video element missing.');
      }
    }

    console.log('[JobPrepApp] Starting confidence monitoring loop.');
    analyzeFrame()
  }

  displayCurrentQuestion() {
    const questionElement = document.getElementById("currentQuestion")
    const questionNumberElement = document.getElementById("questionNumber")
    const transcriptionElement = document.getElementById("transcription")

    if (questionElement && this.interviewState.questions.length > 0) {
      const currentQuestion = this.interviewState.questions[this.interviewState.currentQuestionIndex]
      questionElement.textContent = currentQuestion

      if (questionNumberElement) {
        questionNumberElement.textContent = this.interviewState.currentQuestionIndex + 1
      }

      if (transcriptionElement) {
        transcriptionElement.textContent = "Your speech will appear here..."
      }

      // Speak the question
      this.speechManager.speak(currentQuestion)

      // Show coding section for technical questions if applicable (only for last 5 questions)
      if (
        this.interviewState.isTechnical &&
        this.interviewState.currentQuestionIndex >= 5
      ) {
        this.handleTechnicalQuestion(currentQuestion)
      } else {
        // Hide coding section if not a coding question
        const codingSection = document.getElementById("codingSection")
        if (codingSection) codingSection.classList.add("hidden")
      }
    }
  }

  async handleTechnicalQuestion(question) {
    const codingSection = document.getElementById("codingSection")

    if (codingSection) {
      codingSection.classList.remove("hidden")

      // Initialize code editor if not already done
      if (!this.codeEditor.isInitialized) {
        await this.codeEditor.initialize("codeEditor")
      }

      // Optionally, set language and test cases here in the future
      // this.codeEditor.setLanguage('javascript');
      // this.codeEditor.setTestCases([...]);

      // Generate a coding problem (for now, just show the question)
      this.codeEditor.setValue(
        `/*\n${question}\n*/\n\nfunction solution() {\n    // Your implementation here\n    \n}`,
      )
    }
  }

  isCodingQuestion(question) {
    const codingKeywords = ["algorithm", "code", "implement", "function", "data structure", "programming", "solve"]
    return codingKeywords.some((keyword) => question.toLowerCase().includes(keyword))
  }

  toggleRecording() {
    const recordBtn = document.getElementById("recordBtn")
    const nextBtn = document.getElementById("nextBtn")

    if (!this.interviewState.isRecording) {
      // Start recording
      if (this.speechManager.startRecording()) {
        this.interviewState.isRecording = true
        recordBtn.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop Recording'
        recordBtn.classList.add("recording")
        recordBtn.classList.remove("bg-red-500", "hover:bg-red-600")
        recordBtn.classList.add("bg-gray-500", "hover:bg-gray-600")

        if (nextBtn) nextBtn.disabled = true
      }
    } else {
      // Stop recording
      this.speechManager.stopRecording()
      this.interviewState.isRecording = false
      recordBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Start Recording'
      recordBtn.classList.remove("recording")
      recordBtn.classList.remove("bg-gray-500", "hover:bg-gray-600")
      recordBtn.classList.add("bg-red-500", "hover:bg-red-600")

      if (nextBtn) nextBtn.disabled = false
    }
  }

  updateTranscript(transcript, final) {
    const transcriptionElement = document.getElementById("transcription")
    if (transcriptionElement) {
      transcriptionElement.textContent = transcript || "Your speech will appear here..."
    }
  }

  handleRecordingComplete(finalTranscript) {
    // Store the answer (even if empty)
    const currentQuestion = this.interviewState.questions[this.interviewState.currentQuestionIndex]
    const confidenceScore = this.confidenceAnalyzer.getAverageConfidence()
    this.interviewState.answers.push({
      question: currentQuestion,
      response: finalTranscript,
      confidenceScore: confidenceScore,
    })
    this.interviewState.confidenceScores.push(confidenceScore)
  }

  async nextQuestion() {
    const currentIndex = this.interviewState.currentQuestionIndex
    // For practice interview, do not generate more than 10 questions
    if (!this.interviewState.isMockInterview) {
      // No more questions to generate, just move to next or finish
    }
    // Move to next question or finish interview
    if (currentIndex < this.interviewState.questions.length - 1 && currentIndex < 9) {
      this.interviewState.currentQuestionIndex++
      this.displayCurrentQuestion()
      this.confidenceAnalyzer.reset() // Reset confidence tracking for new question
    } else {
      // Interview complete after 10 questions
      await this.completeInterview()
    }
  }

  async completeInterview() {
    try {
      showLoading(true)

      // Stop camera and confidence analysis
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop())
      }
      this.confidenceAnalyzer.stopAnalysis()

      // Generate comprehensive feedback
      const jobContext = this.interviewState.isMockInterview
        ? this.interviewState.jobDescription
        : this.interviewState.jobTitle

      const feedback = await this.geminiAPI.generateComprehensiveFeedback(
        this.interviewState.answers,
        this.interviewState.confidenceScores,
        jobContext,
        this.interviewState.isTechnical,
      )

      // Display results
      this.displayInterviewResults(feedback)
      this.showSection("interviewResults")
    } catch (error) {
      console.error("Error completing interview:", error)
      alert("Error generating feedback. Please try again.")
    } finally {
      showLoading(false)
    }
  }

  displayInterviewResults(feedback) {
    let parsed = null;
    try {
      parsed = JSON.parse(feedback);
    } catch (e) {
      // fallback: show raw feedback if not JSON
      document.getElementById("overallConfidence").textContent = "-";
      document.getElementById("answerRelevancy").textContent = "-";
      document.getElementById("communicationScore").textContent = "-";
      document.getElementById("technicalScore").textContent = "-";
      document.getElementById("detailedFeedback").innerHTML = `<div class="prose max-w-none">${feedback.replace(/\n/g, "<br>")}</div>`;
      return;
    }
    document.getElementById("overallConfidence").textContent =
      parsed.overallConfidence !== undefined && parsed.overallConfidence !== null ? `${parsed.overallConfidence}%` : "-";
    document.getElementById("answerRelevancy").textContent =
      parsed.answerRelevancy !== undefined && parsed.answerRelevancy !== null ? `${parsed.answerRelevancy}%` : "-";
    document.getElementById("communicationScore").textContent =
      parsed.communicationSkills !== undefined && parsed.communicationSkills !== null ? `${parsed.communicationSkills}%` : "-";
    document.getElementById("technicalScore").textContent =
      parsed.technicalSkills !== undefined && parsed.technicalSkills !== null && parsed.technicalSkills !== "N/A" ? `${parsed.technicalSkills}%` : "N/A";
    document.getElementById("detailedFeedback").innerHTML = `<div class="prose max-w-none">${parsed.detailedFeedback}</div>`;
  }

  // Resume Builder Functions
  async handleResumeUpload(event) {
    const file = event.target.files[0]
    if (file && file.type === "application/pdf") {
      try {
        showLoading(true)
        await this.resumeBuilder.analyzeExistingResume(file)
      } catch (error) {
        console.error("Error analyzing resume:", error)
        alert("Error analyzing resume. Please try again.")
      } finally {
        showLoading(false)
      }
    }
  }

  async handleMockResumeUpload(event) {
    const file = event.target.files[0]
    if (file && file.type === "application/pdf") {
      // Just store the file for later use
      console.log("Resume uploaded for mock interview")
    }
  }

  // Job Management Functions
  loadJobListings() {
    const jobResults = document.getElementById("jobResults")
    if (jobResults) {
      const jobs = this.jobManager.searchJobs("")
      jobResults.innerHTML = jobs.map((job) => this.jobManager.renderJobCard(job, false)).join("")
    }
  }

  loadPostedJobs() {
    const postedJobs = document.getElementById("postedJobs")
    if (postedJobs) {
      const jobs = this.jobManager.jobs
      if (jobs.length === 0) {
        postedJobs.innerHTML = '<p class="text-gray-500 text-center py-8">No jobs posted yet.</p>'
      } else {
        postedJobs.innerHTML = jobs.map((job) => this.jobManager.renderJobCard(job, true)).join("")
      }
    }
  }

  loadCandidates() {
    const candidatesList = document.getElementById("candidatesList")
    if (candidatesList) {
      const applications = this.jobManager.getAllApplications()
      if (applications.length === 0) {
        candidatesList.innerHTML = '<p class="text-gray-500 text-center py-8">No applications received yet.</p>'
      } else {
        candidatesList.innerHTML = applications.map((app) => this.jobManager.renderApplicationCard(app)).join("")
      }
    }
  }

  goHome() {
    this.selectRole(this.currentRole)
  }
}

// Global functions for HTML onclick handlers
function selectRole(role) {
  const app = new JobPrepApp()
  app.selectRole(role)
}

function showSection(section) {
  const app = new JobPrepApp()
  app.showSection(section)
}

function startPracticeInterview() {
  const app = new JobPrepApp()
  app.startPracticeInterview()
}

function startMockInterview() {
  const app = new JobPrepApp()
  app.startMockInterview()
}

function initializePracticeInterview() {
  const app = new JobPrepApp()
  app.initializePracticeInterview()
}

function initializeMockInterview() {
  const app = new JobPrepApp()
  app.initializeMockInterview()
}

function toggleRecording() {
  const app = new JobPrepApp()
  app.toggleRecording()
}

function nextQuestion() {
  const app = new JobPrepApp()
  app.nextQuestion()
}

function generateResume() {
  const ResumeBuilder = new ResumeBuilder()
  ResumeBuilder.updatePreview()
}

function getResumeSuggestions() {
  const ResumeBuilder = new ResumeBuilder()
  ResumeBuilder.getSuggestions()
}

function downloadResume() {
  const ResumeBuilder = new ResumeBuilder()
  ResumeBuilder.generatePDF()
}

function searchJobs() {
  const query = document.getElementById("jobSearchQuery")?.value || ""
  const jobResults = document.getElementById("jobResults")
  if (jobResults) {
    const jobs = this.jobManager.searchJobs(query)
    jobResults.innerHTML = jobs.map((job) => this.jobManager.renderJobCard(job, false)).join("")
  }
}

function viewJobDetails(jobId) {
  const job = this.jobManager.jobs.find((j) => j.id === jobId)
  if (job) {
    alert(
      `Job Details:\n\n${job.title} at ${job.company}\n\nDescription: ${job.description}\n\nRequirements: ${job.requirements}`,
    )
  }
}

function applyForJob(jobId) {
  const name = prompt("Enter your name:")
  const coverLetter = prompt("Enter a brief cover letter (optional):")

  if (name) {
    try {
      this.jobManager.applyForJob(jobId, { name, coverLetter })
      alert("Application submitted successfully!")
    } catch (error) {
      alert("Error submitting application. Please try again.")
    }
  }
}

function postNewJob() {
  const jobData = {
    title: document.getElementById("jobTitle")?.value,
    company: document.getElementById("companyName")?.value,
    location: document.getElementById("jobLocation")?.value,
    type: document.getElementById("jobType")?.value,
    salary: document.getElementById("salaryRange")?.value,
    description: document.getElementById("jobDescriptionPost")?.value,
    requirements: document.getElementById("jobRequirements")?.value,
  }

  if (!jobData.title || !jobData.company || !jobData.description) {
    alert("Please fill in all required fields.")
    return
  }

  try {
    this.jobManager.postJob(jobData)
    alert("Job posted successfully!")

    // Clear form
    Object.keys(jobData).forEach((key) => {
      const element = document.getElementById(key === "description" ? "jobDescriptionPost" : key)
      if (element) element.value = ""
    })

    // Refresh job listings
    const app = new JobPrepApp()
    app.loadPostedJobs()
  } catch (error) {
    alert("Error posting job. Please try again.")
  }
}

function viewJobApplications(jobId) {
  const applications = this.jobManager.getJobApplications(jobId)
  if (applications.length === 0) {
    alert("No applications received for this job yet.")
  } else {
    const applicationsList = applications
      .map(
        (app) =>
          `${app.applicantName} - Applied: ${new Date(app.appliedDate).toLocaleDateString()} - Status: ${app.status}`,
      )
      .join("\n")
    alert(`Applications:\n\n${applicationsList}`)
  }
}

function updateApplicationStatus(applicationId, status) {
  this.jobManager.updateApplicationStatus(applicationId, status)
  const app = new JobPrepApp()
  app.loadCandidates()
  alert(`Application status updated to: ${status}`)
}

function editJob(jobId) {
  alert("Job editing functionality would be implemented here.")
}

function runCode() {
  const result = this.codeEditor.runCode()
  const output = document.getElementById("codeOutput")
  if (output) {
    if (result.success) {
      output.innerHTML = `<div class="text-green-600">Output:</div><div>${result.output}</div>`
    } else {
      output.innerHTML = `<div class="text-red-600">Error:</div><div>${result.error}</div>`
    }
  }
}

function submitCode() {
  const code = this.codeEditor.getValue()
  console.log("Code submitted:", code)
  alert("Code submitted successfully!")
}

function skipCoding() {
  const codingSection = document.getElementById("codingSection")
  if (codingSection) {
    codingSection.classList.add("hidden")
  }
}

function goHome() {
  const app = new JobPrepApp()
  app.goHome()
}

function showLoading(show) {
  const overlay = document.getElementById("loadingOverlay")
  if (overlay) {
    if (show) {
      overlay.classList.remove("hidden")
    } else {
      overlay.classList.add("hidden")
    }
  }
}

// Initialize the application
let app
document.addEventListener("DOMContentLoaded", () => {
  app = new JobPrepApp()
})

window.selectRole = (...args) => app.selectRole(...args);
window.showSection = (...args) => app.showSection(...args);
window.startPracticeInterview = (...args) => app.startPracticeInterview(...args);
window.startMockInterview = (...args) => app.startMockInterview(...args);
window.initializePracticeInterview = (...args) => app.initializePracticeInterview(...args);
window.initializeMockInterview = (...args) => app.initializeMockInterview(...args);
window.toggleRecording = (...args) => app.toggleRecording(...args);
window.nextQuestion = (...args) => app.nextQuestion(...args);
window.generateResume = (...args) => app.generateResume(...args);
window.getResumeSuggestions = (...args) => app.getResumeSuggestions(...args);
window.downloadResume = (...args) => app.downloadResume(...args);
window.searchJobs = (...args) => app.searchJobs(...args);
window.viewJobDetails = (...args) => app.viewJobDetails(...args);
window.applyForJob = (...args) => app.applyForJob(...args);
window.postNewJob = (...args) => app.postNewJob(...args);
window.viewJobApplications = (...args) => app.viewJobApplications(...args);
window.updateApplicationStatus = (...args) => app.updateApplicationStatus(...args);
window.editJob = (...args) => app.editJob(...args);
window.runCode = (...args) => app.runCode(...args);
window.submitCode = (...args) => app.submitCode(...args);
window.skipCoding = (...args) => app.skipCoding(...args);
window.goHome = (...args) => app.goHome(...args);
window.showLoading = showLoading;
