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
    // Restrict access to interview and resume builder for job seekers only
    const userRole = localStorage.getItem('userRole');
    const protectedSections = ['interviewPractice', 'resumeBuilder'];
    if (protectedSections.includes(sectionId) && userRole !== 'seeker') {
      if (typeof showLoginModal === 'function') {
        // Show the section, but immediately show the login modal overlay
        setTimeout(() => showLoginModal(), 0);
      }
      // Do not return here; allow section to render
    }
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
    ];
    sections.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add("hidden");
      }
    });
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.remove("hidden");
      targetSection.classList.add("fade-in");
    }
    this.currentSection = sectionId;
    // Initialize section-specific functionality
    if (sectionId === "resumeBuilder") {
      this.resumeBuilder.updatePreview();
    } else if (sectionId === "jobSearch") {
      this.loadJobListings();
    } else if (sectionId === "manageJobs") {
      this.loadPostedJobs();
    } else if (sectionId === "candidates") {
      this.loadCandidates();
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

    // Store isTechnical in localStorage for DSA round logic
    localStorage.setItem("isTechnicalRole", isTechnical ? "true" : "false")

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

      // Always hide coding section during first 10 questions
      const codingSection = document.getElementById("codingSection")
      if (codingSection) codingSection.classList.add("hidden")
    }
  }

  // Remove or disable handleTechnicalQuestion for first 10 questions
  async handleTechnicalQuestion(question) {
    // No-op during first 10 questions; codingSection is only used in DSA round now
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

  async handleRecordingComplete(finalTranscript) {
    // Store the answer (even if empty)
    const currentQuestion = this.interviewState.questions[this.interviewState.currentQuestionIndex]
    const confidenceScore = this.confidenceAnalyzer.getAverageConfidence()
    this.interviewState.answers.push({
      question: currentQuestion,
      response: finalTranscript,
      confidenceScore: confidenceScore,
    })
    this.interviewState.confidenceScores.push(confidenceScore)

    // Show immediate feedback in practice mode
    if (!this.interviewState.isMockInterview) {
      const feedbackArea = document.getElementById("practiceFeedback")
      if (feedbackArea) {
        feedbackArea.classList.remove("hidden")
        feedbackArea.innerHTML = '<span style="color:#888">Evaluating your answer...</span>'
      }
      try {
        const jobContext = this.interviewState.jobTitle
        const feedback = await this.geminiAPI.evaluateAnswer(currentQuestion, finalTranscript, jobContext)
        if (feedbackArea) {
          feedbackArea.innerHTML = `<div class="prose max-w-none">${feedback.replace(/\n/g, "<br>")}</div>`
        }
      } catch (error) {
        if (feedbackArea) {
          feedbackArea.innerHTML = '<span style="color:#e53e3e">Error getting feedback.</span>'
        }
      }
    }
  }

  async nextQuestion() {
    const currentIndex = this.interviewState.currentQuestionIndex
    // For practice interview, do not generate more than 10 questions
    if (!this.interviewState.isMockInterview) {
      // Hide feedback area for next question
      const feedbackArea = document.getElementById("practiceFeedback")
      if (feedbackArea) {
        feedbackArea.classList.add("hidden")
        feedbackArea.innerHTML = ""
      }
    }
    // Move to next question or finish interview
    if (currentIndex < this.interviewState.questions.length - 1 && currentIndex < 9) {
      this.interviewState.currentQuestionIndex++
      this.displayCurrentQuestion()
      this.confidenceAnalyzer.reset() // Reset confidence tracking for new question
    } else {
      // Check if technical role, then redirect to DSA, else finish interview
      const isTechnicalRole = localStorage.getItem("isTechnicalRole") === "true"
      if (isTechnicalRole) {
        window.location.href = "dsa.html"
      } else {
        await this.completeInterview()
      }
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

// Role-based feature protection for JobPrep Pro

document.addEventListener('DOMContentLoaded', function () {
    const userRole = localStorage.getItem('userRole');
    // Employer-only features
    const postJobBtn = document.querySelector('[onclick*="showSection(\'postJob\')"]');
    const manageJobsBtn = document.querySelector('[onclick*="showSection(\'manageJobs\')"]');
    // Seeker-only feature
    const jobSearchBtn = document.querySelector('[onclick*="showSection(\'jobSearch\')"]');
    // Interview and Resume Builder (seeker-only)
    const interviewPracticeBtn = document.querySelector('[onclick*="showSection(\'interviewPractice\')"]');
    const resumeBuilderBtn = document.querySelector('[onclick*="showSection(\'resumeBuilder\')"]');
    // Main content container
    const mainContainer = document.querySelector('.container.mx-auto');
    // Navbar role buttons
    const jobSeekerBtn = document.getElementById('jobSeekerBtn');
    const employerBtn = document.getElementById('employerBtn');

    // Modal for login prompt
    let loginModal = document.getElementById('loginModal');
    if (!loginModal) {
        loginModal = document.createElement('div');
        loginModal.id = 'loginModal';
        loginModal.innerHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div class="bg-white p-8 rounded-lg shadow-lg text-center max-w-xs w-full">
                    <h3 class="text-lg font-bold mb-2">Login Required</h3>
                    <p class="mb-4 text-gray-600">Please log in to access this feature.</p>
                    <button id="goToLoginBtn" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Go to Login</button>
                </div>
            </div>
        `;
        loginModal.style.display = 'none';
        document.body.appendChild(loginModal);
    }
    function showLoginModal() {
        loginModal.style.display = '';
        if (mainContainer) mainContainer.style.filter = 'blur(6px)';
        document.getElementById('goToLoginBtn').onclick = () => {
            window.location.href = 'auth.html';
        };
    }
    function hideLoginModal() {
        loginModal.style.display = 'none';
        if (mainContainer) mainContainer.style.filter = '';
    }

    // Always show features, but protect with modal if not logged in
    if (postJobBtn) {
        postJobBtn.style.display = '';
        postJobBtn.addEventListener('click', function (e) {
            if (userRole !== 'employer') {
                e.preventDefault();
                showLoginModal();
            } else {
                hideLoginModal();
            }
        });
    }
    if (manageJobsBtn) {
        manageJobsBtn.style.display = '';
        manageJobsBtn.addEventListener('click', function (e) {
            if (userRole !== 'employer') {
                e.preventDefault();
                showLoginModal();
            } else {
                hideLoginModal();
            }
        });
    }
    if (jobSearchBtn) {
        jobSearchBtn.style.display = '';
        jobSearchBtn.addEventListener('click', function (e) {
            if (userRole !== 'seeker') {
                e.preventDefault();
                showLoginModal();
            } else {
                hideLoginModal();
            }
        });
    }
    if (interviewPracticeBtn) {
        interviewPracticeBtn.addEventListener('click', function (e) {
            if (userRole !== 'seeker') {
                e.preventDefault();
                showLoginModal();
            } else {
                hideLoginModal();
            }
        });
    }
    if (resumeBuilderBtn) {
        resumeBuilderBtn.addEventListener('click', function (e) {
            if (userRole !== 'seeker') {
                e.preventDefault();
                showLoginModal();
            } else {
                hideLoginModal();
            }
        });
    }

    // Hide modal and blur if user logs in (on page load)
    if (userRole) {
        hideLoginModal();
    }

    // After login, show correct dashboard section
    if (userRole === 'seeker') {
        if (typeof showSection === 'function') showSection('jobSeekerDashboard');
    } else if (userRole === 'employer') {
        if (typeof showSection === 'function') showSection('employerDashboard');
    }

    // Prevent role switching after login
    if (jobSeekerBtn) {
        jobSeekerBtn.addEventListener('click', function (e) {
            if (userRole === 'employer') {
                e.preventDefault();
                showLoginModal();
            }
        });
    }
    if (employerBtn) {
        employerBtn.addEventListener('click', function (e) {
            if (userRole === 'seeker') {
                e.preventDefault();
                showLoginModal();
            }
        });
    }
});

// Initialize the application at the top level
const app = new JobPrepApp();
window.resumeBuilder = app.resumeBuilder;
window.selectRole = (...args) => app.selectRole(...args);
window.showSection = (...args) => app.showSection(...args);
window.startPracticeInterview = (...args) => app.startPracticeInterview(...args);
window.startMockInterview = (...args) => app.startMockInterview(...args);
window.initializePracticeInterview = (...args) => app.initializePracticeInterview(...args);
window.initializeMockInterview = (...args) => app.initializeMockInterview(...args);
window.toggleRecording = (...args) => app.toggleRecording(...args);
window.nextQuestion = (...args) => app.nextQuestion(...args);
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

// Add at the top:
const DSA_PROBLEMS = [
  {
    title: "Two Sum",
    description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.\n\nYou can return the answer in any order.`,
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
      { input: "nums = [3,3], target = 6", output: "[0,1]" },
    ],
    testCases: [
      { input: "[2,7,11,15]\n9", expected: "[0,1]" },
      { input: "[3,2,4]\n6", expected: "[1,2]" },
      { input: "[3,3]\n6", expected: "[0,1]" },
    ],
  },
  {
    title: "Reverse Linked List",
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.\n\nInput is a list of numbers, output is the reversed list as an array.`,
    examples: [
      { input: "head = [1,2,3,4,5]", output: "[5,4,3,2,1]" },
      { input: "head = [1,2]", output: "[2,1]" },
      { input: "head = []", output: "[]" },
    ],
    testCases: [
      { input: "[1,2,3,4,5]", expected: "[5,4,3,2,1]" },
      { input: "[1,2]", expected: "[2,1]" },
      { input: "[]", expected: "[]" },
    ],
  },
  {
    title: "Valid Parentheses",
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.`,
    examples: [
      { input: "s = '()'", output: "true" },
      { input: "s = '()[]{}'", output: "true" },
      { input: "s = '(]'", output: "false" },
    ],
    testCases: [
      { input: "()", expected: "true" },
      { input: "()[]{}", expected: "true" },
      { input: "(]", expected: "false" },
    ],
  },
  {
    title: "Maximum Subarray",
    description: `Given an integer array nums, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.`,
    examples: [
      { input: "nums = [-2,1,-3,4,-1,2,1,-5,4]", output: "6" },
      { input: "nums = [1]", output: "1" },
      { input: "nums = [5,4,-1,7,8]", output: "23" },
    ],
    testCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", expected: "6" },
      { input: "[1]", expected: "1" },
      { input: "[5,4,-1,7,8]", expected: "23" },
    ],
  },
  {
    title: "Climbing Stairs",
    description: `You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?` ,
    examples: [
      { input: "n = 2", output: "2" },
      { input: "n = 3", output: "3" },
    ],
    testCases: [
      { input: "2", expected: "2" },
      { input: "3", expected: "3" },
      { input: "5", expected: "8" },
    ],
  },
];

// Show coding interface and load problem
function showCodingInterface() {
  document.getElementById("codingInterface").classList.remove("hidden")
  dsaIndex = 0
  dsaResults = []
  showDsaProblem()
}

// Judge0 API integration
async function submitToJudge0(sourceCode, language, testCases) {
  // Map language to Judge0 id
  const langMap = { python: 71, javascript: 63, java: 62, cpp: 54 }
  const langId = langMap[language] || 71
  const results = []
  for (const tc of testCases) {
    const input = tc.input.replace(/\n/g, '\n')
    const expected = tc.expected
    const resp = await fetch("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-host": "judge0-ce.p.rapidapi.com",
        "x-rapidapi-key": "39049afc32msh2c7f47118d163ddp1cc143jsnfe6421e2fcfe"
      },
      body: JSON.stringify({
        source_code: sourceCode,
        language_id: langId,
        stdin: input,
      })
    })
    const data = await resp.json()
    results.push({
      input,
      expected,
      output: data.stdout ? data.stdout.trim() : (data.stderr || data.compile_output || ""),
      pass: data.stdout && data.stdout.trim() === expected
    })
  }
  return results
}

// Handle code submission
window.addEventListener("DOMContentLoaded", () => {
  const submitBtn = document.getElementById("submitCodeBtn")
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const code = document.getElementById("codeInput").value
      const lang = document.getElementById("languageSelect").value
      const testCases = DSA_PROBLEMS[0].testCases // Default to the first problem's test cases
      document.getElementById("testCaseResults").innerHTML = '<span style="color:#888">Running test cases...</span>'
      try {
        const results = await submitToJudge0(code, lang, testCases)
        let html = '<h4 class="font-semibold mb-2">Test Case Results:</h4><ul>'
        for (const r of results) {
          html += `<li><b>Input:</b> ${r.input} <b>Expected:</b> ${r.expected} <b>Output:</b> ${r.output} <span class='${r.pass ? "text-green-600" : "text-red-600"}'>${r.pass ? "PASS" : "FAIL"}</span></li>`
        }
        html += '</ul>'
        document.getElementById("testCaseResults").innerHTML = html
      } catch (e) {
        document.getElementById("testCaseResults").innerHTML = '<span style="color:#e53e3e">Error running code.</span>'
      }
    }
  }
})

// Add event listener for DSA modal button (ensure it always attaches)
function setupDsaModalListener() {
  const dsaBtn = document.getElementById("startDsaBtn")
  if (dsaBtn) {
    dsaBtn.onclick = () => {
      document.getElementById("dsaModal").classList.add("hidden")
      // Hide main interview interface if visible
      const interviewInterface = document.getElementById("interviewInterface")
      if (interviewInterface) interviewInterface.classList.add("hidden")
      showCodingInterface()
    }
  }
  const skipBtn = document.getElementById("skipDsaBtn")
  if (skipBtn) {
    skipBtn.onclick = () => {
      document.getElementById("dsaModal").classList.add("hidden")
      // Hide main interview interface if visible
      const interviewInterface = document.getElementById("interviewInterface")
      if (interviewInterface) interviewInterface.classList.add("hidden")
      // Show feedback for skipping DSA
      document.getElementById("dsaFeedback").innerHTML = '<div class="text-yellow-600 font-bold">You skipped the DSA round.</div>'
      document.getElementById("codingInterface").classList.add("hidden")
    }
  }
}

// DSA round state
let dsaProblems = DSA_PROBLEMS;
let dsaIndex = 0;
let dsaResults = [];

function showDsaProblem() {
  const p = dsaProblems[dsaIndex]
  let html = `<h3 class='text-xl font-bold mb-2'>${p.title} <span class='text-sm text-gray-500'>(Problem ${dsaIndex+1}/5)</span></h3><p>${p.description.replace(/\n/g, '<br>')}</p><div class='mt-2'><b>Examples:</b><ul>`
  for (const ex of p.examples) {
    html += `<li><b>Input:</b> ${ex.input} <b>Output:</b> ${ex.output}</li>`
  }
  html += '</ul></div>'
  document.getElementById("codingProblem").innerHTML = html
  document.getElementById("judgeEditor").innerHTML = `<div id='aceEditor' style='height: 300px; width: 100%; border-radius: 0.5rem;'></div>`
  setTimeout(() => {
    if (window.aceEditor) {
      window.aceEditor.destroy();
      window.aceEditor = null;
    }
    if (window.ace) {
      const langMap = { python: "python", javascript: "javascript", java: "java", cpp: "c_cpp" }
      const lang = document.getElementById("languageSelect").value
      window.aceEditor = ace.edit("aceEditor")
      window.aceEditor.setTheme("ace/theme/monokai")
      window.aceEditor.session.setMode(`ace/mode/${langMap[lang] || "python"}`)
      window.aceEditor.setValue("# Write your code here\n", 1)
      window.aceEditor.setOptions({ fontSize: "16px", fontFamily: "monospace", showPrintMargin: false })
      // Update language on dropdown change
      document.getElementById("languageSelect").onchange = function() {
        const newLang = langMap[this.value] || "python"
        window.aceEditor.session.setMode(`ace/mode/${newLang}`)
      }
    }
  }, 200)
  document.getElementById("testCaseResults").innerHTML = ""
  document.getElementById("dsaFeedback").innerHTML = ""
}

// Update code submission to get code from Ace
window.addEventListener("DOMContentLoaded", () => {
  const submitBtn = document.getElementById("submitCodeBtn")
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const code = window.aceEditor ? window.aceEditor.getValue() : document.getElementById("codeInput").value
      const lang = document.getElementById("languageSelect").value
      const testCases = dsaProblems[dsaIndex].testCases
      document.getElementById("testCaseResults").innerHTML = '<span style="color:#888">Running test cases...</span>'
      try {
        const results = await submitToJudge0(code, lang, testCases)
        let html = '<h4 class="font-semibold mb-2">Test Case Results:</h4><ul>'
        let passCount = 0
        for (const r of results) {
          if (r.pass) passCount++
          html += `<li><b>Input:</b> ${r.input} <b>Expected:</b> ${r.expected} <b>Output:</b> ${r.output} <span class='${r.pass ? "text-green-600" : "text-red-600"}'>${r.pass ? "PASS" : "FAIL"}</span></li>`
        }
        html += '</ul>'
        document.getElementById("testCaseResults").innerHTML = html
        dsaResults.push({ problem: dsaProblems[dsaIndex].title, attempted: true, passed: passCount })
        nextDsaProblem()
      } catch (e) {
        document.getElementById("testCaseResults").innerHTML = '<span style="color:#e53e3e">Error running code.</span>'
      }
    }
  }
  const skipCodeBtn = document.getElementById("skipCodeBtn")
  if (skipCodeBtn) {
    skipCodeBtn.onclick = () => {
      dsaResults.push({ problem: dsaProblems[dsaIndex].title, attempted: false, passed: 0 })
      nextDsaProblem()
    }
  }
})

function nextDsaProblem() {
  dsaIndex++
  if (dsaIndex < dsaProblems.length) {
    showDsaProblem()
  } else {
    showDsaFeedback()
  }
}

function showDsaFeedback() {
  // For demo, just show summary. You can call Gemini for feedback if desired.
  let html = '<h3 class="text-xl font-bold mb-4">DSA Round Feedback</h3><ul>'
  dsaResults.forEach((r, i) => {
    html += `<li>Problem ${i+1}: ${r.attempted ? `Attempted, Passed ${r.passed} test cases` : 'Skipped'}</li>`
  })
  html += '</ul>'
  document.getElementById("dsaFeedback").innerHTML = html
  document.getElementById("codingInterface").scrollIntoView({ behavior: 'smooth' })
  // Hide the code editor after feedback
  document.getElementById("codingInterface").classList.add("hidden")
}

window.addEventListener("DOMContentLoaded", setupDsaModalListener)

document.addEventListener('DOMContentLoaded', () => {
  const dlBtn = document.querySelector('[data-resume-action="download"]');
  if (dlBtn) dlBtn.onclick = () => {
    const data = window.resumeBuilder.collectFormData();
    const html = window.resumeBuilder.templates[window.resumeBuilder.currentTemplate](data);
    localStorage.setItem('resumeHtml', html);
    window.location.href = 'resume-download.html';
  };
});
