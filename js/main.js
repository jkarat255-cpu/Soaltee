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

    // Add: Refresh List button for Candidates section
    const refreshBtn = document.getElementById("refreshCandidatesBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.loadApplicationsForEmployer());
    }
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
      // "candidates", // Remove candidates section from sections array
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
    } // Remove candidates section logic

    // Add: Load applications from Supabase for employer
    if (sectionId === "candidates") {
      this.loadApplicationsForEmployer();
    }
  }

  // Interview Practice Functions
  startPracticeInterview() {
    this.showSection("practiceSetup")
  }

  startMockInterview() {
    window.location.href = 'mock-interview.html';
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
      // Ensure TensorFlow models are loaded before starting analysis
      const tfOk = await this.confidenceAnalyzer.initialize()
      if (!tfOk) {
        alert("Error loading TensorFlow models for confidence analysis. Please check your internet connection and reload the page.")
        return
      }
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
    window.location.href = 'mock-interview.html';
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
          // Parse score and feedback by criteria
          let scoreMatch = feedback.match(/Score:\s*(\d{1,2})\/10/i)
          let score = scoreMatch ? parseInt(scoreMatch[1]) : null
          let criteria = { relevancy: '', completeness: '', communication: '', improvements: '' }
          let lines = feedback.split(/\n|<br>/)
          let current = ''
          for (let line of lines) {
            if (/relevancy/i.test(line)) current = 'relevancy'
            else if (/completeness/i.test(line)) current = 'completeness'
            else if (/professional communication|communication/i.test(line)) current = 'communication'
            else if (/improvement/i.test(line)) current = 'improvements'
            else if (current) criteria[current] += (criteria[current] ? ' ' : '') + line.trim()
          }
          // Fallback: if not parsed, put all in improvements
          if (!criteria.relevancy && !criteria.completeness && !criteria.communication) criteria.improvements = feedback

          // Score circle
          let scoreCircle = `<div style="display:flex;justify-content:center;align-items:center;margin-bottom:1rem;">
            <div style="width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#4f8cff,#6ee7b7,#fbbf24);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 8px #0001;">
              <span style="font-size:2rem;font-weight:bold;color:#222;">${score !== null ? score : '?'}</span>
              <span style="font-size:0.9rem;color:#555;">/10</span>
            </div>
          </div>`

          // Criteria flexboxes
          let criteriaBoxes = `<div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">
            <div style="flex:1;min-width:180px;background:#e0f2fe;border-radius:1rem;padding:1rem 1.2rem;box-shadow:0 1px 4px #38bdf81a;">
              <div style="font-weight:600;color:#0284c7;margin-bottom:0.3rem;">Relevancy</div>
              <div style="color:#0369a1;">${criteria.relevancy || '-'}</div>
            </div>
            <div style="flex:1;min-width:180px;background:#fef9c3;border-radius:1rem;padding:1rem 1.2rem;box-shadow:0 1px 4px #fbbf241a;">
              <div style="font-weight:600;color:#b45309;margin-bottom:0.3rem;">Completeness</div>
              <div style="color:#a16207;">${criteria.completeness || '-'}</div>
            </div>
            <div style="flex:1;min-width:180px;background:#f3e8ff;border-radius:1rem;padding:1rem 1.2rem;box-shadow:0 1px 4px #a78bfa1a;">
              <div style="font-weight:600;color:#7c3aed;margin-bottom:0.3rem;">Communication</div>
              <div style="color:#6d28d9;">${criteria.communication || '-'}</div>
            </div>
          </div>`

          // Improvements box
          let improvementsBox = ''
          if (criteria.improvements) {
            improvementsBox = `<div style="margin-top:1.2rem;background:#fef2f2;border-radius:1rem;padding:1rem 1.2rem;box-shadow:0 1px 4px #f871711a;">
              <div style="font-weight:600;color:#dc2626;margin-bottom:0.3rem;">Improvements</div>
              <div style="color:#b91c1c;">${criteria.improvements}</div>
            </div>`
          }

          feedbackArea.innerHTML = scoreCircle + criteriaBoxes + improvementsBox
        }
      } catch (error) {
        if (feedbackArea) {
          feedbackArea.innerHTML = `<span style='color:#e53e3e'>Gemini API Error:<br>${error && error.stack ? error.stack : error.message || error}</span>`
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
      // Check if technical role, then show Q&A feedback/hireability, then redirect to DSA, else finish interview
      const isTechnicalRole = localStorage.getItem("isTechnicalRole") === "true"
      if (isTechnicalRole) {
        // Show Q&A feedback/hireability modal/section
        await this.showQnAFeedbackBeforeDSA()
      } else {
        await this.completeInterview()
      }
    }
  }

  async showQnAFeedbackBeforeDSA() {
    // Generate Q&A feedback (without DSA)
    try {
      showLoading(true)
      const jobContext = this.interviewState.jobTitle
      const feedback = await this.geminiAPI.generateComprehensiveFeedback(
        this.interviewState.answers,
        this.interviewState.confidenceScores,
        jobContext,
        this.interviewState.isTechnical,
      )
      // Store Q&A feedback in localStorage for later use
      localStorage.setItem('qnaFeedback', feedback)
      // Show modal/section with feedback and hireability
      this.showSection('interviewResults')
      this.displayInterviewResults(feedback, { onlyQnA: true })
      // Add a button to continue to DSA
      let dsaBtn = document.createElement('button')
      dsaBtn.textContent = 'Continue to DSA Round'
      dsaBtn.style = 'margin-top:2rem;background:#64b5f6;color:#23201a;font-weight:600;padding:0.8rem 2.2rem;border-radius:0.8rem;font-size:1.1rem;box-shadow:0 1px 4px #0002;'
      dsaBtn.onclick = () => { window.location.href = 'dsa.html' }
      const resultsDiv = document.getElementById('interviewResults')
      if (resultsDiv && !document.getElementById('continueToDsaBtn')) {
        dsaBtn.id = 'continueToDsaBtn'
        resultsDiv.appendChild(dsaBtn)
      }
    } catch (error) {
      const feedbackArea = document.getElementById("detailedFeedback")
      if (feedbackArea) {
        feedbackArea.innerHTML = `<span style='color:#e53e3e'>Gemini API Error:<br>${error && error.stack ? error.stack : error.message || error}</span>`
      } else {
        alert('Gemini API Error: ' + (error && error.stack ? error.stack : error.message || error))
      }
    } finally {
      showLoading(false)
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
      const feedbackArea = document.getElementById("detailedFeedback")
      if (feedbackArea) {
        feedbackArea.innerHTML = `<span style='color:#e53e3e'>Gemini API Error:<br>${error && error.stack ? error.stack : error.message || error}</span>`
      } else {
        alert('Gemini API Error: ' + (error && error.stack ? error.stack : error.message || error))
      }
    } finally {
      showLoading(false)
    }
  }

  displayInterviewResults(feedback, opts = {}) {
    let parsed = null;
    try {
      parsed = JSON.parse(feedback);
    } catch (e) {
      document.getElementById("confidenceScoreCircle").innerHTML = '';
      document.getElementById("answerRelevancy").textContent = "-";
      document.getElementById("communicationScore").textContent = "-";
      document.getElementById("technicalScore").textContent = "-";
      document.getElementById("detailedFeedback").innerHTML = `<div class="prose max-w-none">${feedback.replace(/\n/g, "<br>")}</div>`;
      document.getElementById("hireabilityBox").style.display = "none";
      document.getElementById("dsaSummary").style.display = "none";
      return;
    }
    let conf = parsed.overallConfidence !== undefined && parsed.overallConfidence !== null ? parsed.overallConfidence : null;
    document.getElementById("confidenceScoreCircle").innerHTML = `<div style="width:90px;height:90px;border-radius:50%;background:linear-gradient(135deg,#4f8cff,#6ee7b7,#fbbf24);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 8px #0001;"><span style="font-size:2.3rem;font-weight:bold;color:#222;">${conf !== null ? conf : '?'}</span><span style="font-size:1rem;color:#555;">% Confidence</span></div>`;
    document.getElementById("answerRelevancy").textContent = parsed.answerRelevancy !== undefined && parsed.answerRelevancy !== null ? `${parsed.answerRelevancy}%` : "-";
    document.getElementById("communicationScore").textContent = parsed.communicationSkills !== undefined && parsed.communicationSkills !== null ? `${parsed.communicationSkills}%` : "-";
    const isTechnical = this.interviewState.isTechnical;
    const techBox = document.getElementById("technicalScoreBox");
    if (isTechnical && parsed.technicalSkills !== undefined && parsed.technicalSkills !== null && parsed.technicalSkills !== "N/A") {
      techBox.style.display = "block";
      document.getElementById("technicalScore").textContent = `${parsed.technicalSkills}%`;
    } else {
      techBox.style.display = "none";
      document.getElementById("technicalScore").textContent = "N/A";
    }
    document.getElementById("detailedFeedback").innerHTML = `<div class="prose max-w-none">${parsed.detailedFeedback}</div>`;
    // DSA Summary (for technical)
    const dsaSummary = document.getElementById("dsaSummary");
    let dsaScore = null;
    let dsaLevel = null;
    let dsaMsg = null;
    let dsaData = null;
    if (isTechnical) {
      let dsaLocal = localStorage.getItem('dsaSummary');
      if (dsaLocal) {
        try {
          dsaData = JSON.parse(dsaLocal);
          dsaScore = dsaData.dsaScore;
          dsaLevel = dsaData.dsaLevel;
          dsaMsg = dsaData.dsaMsg;
        } catch (e) {}
      }
    }
    // Control which sections are visible
    if (opts.onlyQnA) {
      dsaSummary.style.display = "none";
    } else if (opts.onlyDSA) {
      // Hide QnA scores
      document.getElementById("confidenceScoreCircle").innerHTML = '';
      document.getElementById("answerRelevancy").textContent = "-";
      document.getElementById("communicationScore").textContent = "-";
      techBox.style.display = "none";
      document.getElementById("technicalScore").textContent = "N/A";
      document.getElementById("detailedFeedback").innerHTML = '';
      // Show only DSA summary
      if (isTechnical && dsaData) {
        dsaSummary.style.display = "block";
        let html = `<div style="background:#e0f2fe;border-radius:1rem;padding:1.2rem;box-shadow:0 1px 4px #38bdf81a;"><div style="font-weight:600;color:#0284c7;margin-bottom:0.3rem;">DSA/Coding Round</div><div style="color:#0369a1;">Problems Solved: <b>${dsaData.solved}/${dsaData.total}</b> &nbsp;|&nbsp; Test Cases Passed: <b>${dsaData.totalPassed}/${dsaData.maxTestCases}</b></div><div style="margin-bottom:1rem;font-weight:600;color:#0284c7;">DSA: ${dsaLevel} - ${dsaMsg}</div><div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">`;
        dsaData.dsaResults.forEach((r, i) => {
          html += `<div style="flex:1;min-width:140px;background:${r.attempted ? (r.passed > 0 ? '#d1fae5' : '#fee2e2') : '#f3f4f6'};border-radius:0.8rem;padding:0.7rem 1rem;box-shadow:0 1px 4px #0001;display:flex;align-items:center;gap:0.5rem;">`;
          html += r.attempted ? (r.passed > 0 ? '<span style="color:#22c55e;font-size:1.3rem;">✔️</span>' : '<span style="color:#ef4444;font-size:1.3rem;">❌</span>') : '<span style="color:#a1a1aa;font-size:1.3rem;">⏭️</span>';
          html += `<span style="font-weight:600;">Problem ${i+1}</span><span style="margin-left:auto;font-size:0.95rem;">${r.attempted ? (r.passed > 0 ? `${r.passed} passed` : 'No test cases passed') : 'Skipped'}</span></div>`;
        });
        html += `</div></div>`;
        dsaSummary.innerHTML = html;
      } else {
        dsaSummary.style.display = "none";
      }
      // Show DSA hireability
      let hireability = '';
      let hireColor = '#a16207';
      let hireScore = dsaScore;
      if (hireScore !== null) {
        if (hireScore >= 80) { hireability = 'Highly Hireable (Coding)'; hireColor = '#22c55e'; }
        else if (hireScore >= 65) { hireability = 'Hireable for Coding with Minor Improvements'; hireColor = '#eab308'; }
        else if (hireScore >= 50) { hireability = 'Potential, Needs Coding Improvement'; hireColor = '#f59e42'; }
        else { hireability = 'Not Hireable for Coding Yet'; hireColor = '#ef4444'; }
      }
      if (hireability) {
        document.getElementById("hireabilityBox").style.display = "block";
        document.getElementById("hireabilityText").textContent = hireability;
        document.getElementById("hireabilityText").style.color = hireColor;
      } else {
        document.getElementById("hireabilityBox").style.display = "none";
      }
      return;
    }
    // Default: show both QnA and DSA if present (final review)
    if (isTechnical && dsaData) {
      dsaSummary.style.display = "block";
      let html = `<div style="background:#e0f2fe;border-radius:1rem;padding:1.2rem;box-shadow:0 1px 4px #38bdf81a;"><div style="font-weight:600;color:#0284c7;margin-bottom:0.3rem;">DSA/Coding Round</div><div style="color:#0369a1;">Problems Solved: <b>${dsaData.solved}/${dsaData.total}</b> &nbsp;|&nbsp; Test Cases Passed: <b>${dsaData.totalPassed}/${dsaData.maxTestCases}</b></div><div style="margin-bottom:1rem;font-weight:600;color:#0284c7;">DSA: ${dsaLevel} - ${dsaMsg}</div><div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">`;
      dsaData.dsaResults.forEach((r, i) => {
        html += `<div style="flex:1;min-width:140px;background:${r.attempted ? (r.passed > 0 ? '#d1fae5' : '#fee2e2') : '#f3f4f6'};border-radius:0.8rem;padding:0.7rem 1rem;box-shadow:0 1px 4px #0001;display:flex;align-items:center;gap:0.5rem;">`;
        html += r.attempted ? (r.passed > 0 ? '<span style="color:#22c55e;font-size:1.3rem;">✔️</span>' : '<span style="color:#ef4444;font-size:1.3rem;">❌</span>') : '<span style="color:#a1a1aa;font-size:1.3rem;">⏭️</span>';
        html += `<span style="font-weight:600;">Problem ${i+1}</span><span style="margin-left:auto;font-size:0.95rem;">${r.attempted ? (r.passed > 0 ? `${r.passed} passed` : 'No test cases passed') : 'Skipped'}</span></div>`;
      });
      html += `</div></div>`;
      dsaSummary.innerHTML = html;
    } else {
      dsaSummary.style.display = "none";
    }
    // Hireability (overall)
    let hireability = '';
    let hireColor = '#a16207';
    let hireScore = (conf !== null && parsed.answerRelevancy !== undefined && parsed.communicationSkills !== undefined) ? (conf + parsed.answerRelevancy + parsed.communicationSkills) / 3 : null;
    if (isTechnical && parsed.technicalSkills !== undefined && parsed.technicalSkills !== null && parsed.technicalSkills !== "N/A") {
      hireScore = (hireScore + parsed.technicalSkills) / 2;
    }
    if (isTechnical && dsaScore !== null) {
      hireScore = (hireScore + dsaScore) / 2;
    }
    if (hireScore !== null) {
      if (hireScore >= 80) { hireability = 'Highly Hireable'; hireColor = '#22c55e'; }
      else if (hireScore >= 65) { hireability = 'Hireable with Minor Improvements'; hireColor = '#eab308'; }
      else if (hireScore >= 50) { hireability = 'Potential, Needs Improvement'; hireColor = '#f59e42'; }
      else { hireability = 'Not Hireable Yet'; hireColor = '#ef4444'; }
    }
    if (hireability) {
      document.getElementById("hireabilityBox").style.display = "block";
      document.getElementById("hireabilityText").textContent = hireability;
      document.getElementById("hireabilityText").style.color = hireColor;
    } else {
      document.getElementById("hireabilityBox").style.display = "none";
    }
    // Show summary feedbacks below
    let summaryFeedback = '';
    if (isTechnical && dsaLevel && dsaMsg) {
      summaryFeedback += `<div style="margin-top:1.5rem;font-weight:600;color:#0284c7;">DSA: ${dsaLevel} - ${dsaMsg}</div>`;
    }
    if (parsed.detailedFeedback) {
      // Try to extract correctness/confidence from detailedFeedback
      let correctness = '', confidence = '';
      if (/relevant|correct|accuracy|answer/i.test(parsed.detailedFeedback)) {
        correctness = parsed.detailedFeedback.match(/(relevant|correct|accuracy|answer)[^.!?]*[.!?]/i);
      }
      if (/confidence|eye contact|body|nervous|shaking|posture/i.test(parsed.detailedFeedback)) {
        confidence = parsed.detailedFeedback.match(/(confidence|eye contact|body|nervous|shaking|posture)[^.!?]*[.!?]/i);
      }
      if (correctness) summaryFeedback += `<div style="margin-top:0.7rem;font-weight:600;color:#7c3aed;">Correctness: ${correctness[0]}</div>`;
      if (confidence) summaryFeedback += `<div style="margin-top:0.7rem;font-weight:600;color:#f59e42;">Confidence: ${confidence[0]}</div>`;
    }
    if (summaryFeedback) {
      document.getElementById("detailedFeedback").innerHTML += `<div style="margin-top:2rem;">${summaryFeedback}</div>`;
    }
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
  async loadJobListings() {
    const jobResults = document.getElementById("jobResults")
    if (jobResults) {
      const jobs = await this.jobManager.loadJobs();
      jobResults.innerHTML = jobs.map((job) => this.jobManager.renderJobCard(job, false)).join("")
    }
  }

  async loadPostedJobs() {
    const postedJobs = document.getElementById("postedJobs")
    if (postedJobs) {
      const jobs = await this.jobManager.loadJobs();
      if (jobs.length === 0) {
        postedJobs.innerHTML = '<p class="text-gray-500 text-center py-8">No jobs posted yet.</p>'
      } else {
        postedJobs.innerHTML = jobs.map((job) => this.jobManager.renderJobCard(job, true)).join("")
      }
    }
  }

  // Add postNewJob as a class method
  async postNewJob() {
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
      await this.jobManager.postJob(jobData)
      alert("Job posted successfully!")

      // Clear form
      Object.keys(jobData).forEach((key) => {
        const element = document.getElementById(key === "description" ? "jobDescriptionPost" : key)
        if (element) element.value = ""
      })

      // Refresh job listings
      await this.loadPostedJobs()
    } catch (error) {
      alert("Error posting job. Please try again.")
    }
  }

  // Remove loadCandidates() method entirely

  goHome() {
    this.selectRole(this.currentRole)
  }

  // Fetch and display candidates from Supabase 'dup' table in candidates section
  async loadApplicationsForEmployer() {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'employer') return;
    const candidatesList = document.getElementById("candidatesList");
    const debugDiv = document.getElementById("candidatesDebug");
    if (!candidatesList) return;
    candidatesList.innerHTML = '<p class="text-gray-500 text-center py-8">Loading candidates...</p>';
    try {
      const { data, error } = await window.app.jobManager.fetchAllApplicationsFromSupabase();
      if (debugDiv) debugDiv.textContent = `Supabase response:\n${JSON.stringify({ data, error }, null, 2)}`;
      console.log('Supabase candidates fetch:', { data, error });
      if (error || !data) {
        candidatesList.innerHTML = '<p class="text-red-500 text-center py-8">Error loading candidates.</p>';
        if (debugDiv) debugDiv.textContent += `\nError: ${error ? error.message : 'Unknown error'}`;
        return;
      }
      if (data.length === 0) {
        candidatesList.innerHTML = '<p class="text-gray-500 text-center py-8">No candidates found yet.</p>';
        if (debugDiv) debugDiv.textContent += '\nNo candidates found.';
        return;
      }
      candidatesList.innerHTML = data.map(app => window.renderEmployerApplicationCard(app)).join("");
      if (debugDiv) debugDiv.textContent += `\nLoaded ${data.length} candidates.`;
    } catch (e) {
      candidatesList.innerHTML = '<p class="text-red-500 text-center py-8">Error loading candidates.</p>';
      if (debugDiv) debugDiv.textContent = `Exception: ${e && e.stack ? e.stack : e}`;
      console.error('Exception in loadApplicationsForEmployer:', e);
    }
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

async function searchJobs() {
  const query = document.getElementById("jobSearchQuery")?.value || ""
  const jobResults = document.getElementById("jobResults")
  if (jobResults) {
    const jobs = await window.app.jobManager.loadJobs();
    const filtered = query.trim() ? jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(query.toLowerCase()) ||
        job.company.toLowerCase().includes(query.toLowerCase()) ||
        job.location.toLowerCase().includes(query.toLowerCase()) ||
        job.description.toLowerCase().includes(query.toLowerCase())
    ) : jobs;
    jobResults.innerHTML = filtered.map((job) => window.app.jobManager.renderJobCard(job, false)).join("")
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

async function applyForJob(jobId) {
  const name = prompt("Enter your name:")
  const coverLetter = prompt("Enter a brief cover letter (optional):")

  if (name) {
    try {
      await window.app.jobManager.applyForJob(jobId, { name, coverLetter })
      alert("Application submitted successfully!")
    } catch (error) {
      alert("Error submitting application. Please try again.")
    }
  }
}

async function postNewJob() {
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
    await window.app.postNewJob()
    alert("Job posted successfully!")

    // Clear form
    Object.keys(jobData).forEach((key) => {
      const element = document.getElementById(key === "description" ? "jobDescriptionPost" : key)
      if (element) element.value = ""
    })

    // Refresh job listings
    await window.app.loadPostedJobs()
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
window.app = app;
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
  // Calculate DSA summary
  let total = dsaResults.length;
  let attempted = dsaResults.filter(r => r.attempted).length;
  let solved = dsaResults.filter(r => r.attempted && r.passed > 0).length;
  let totalPassed = dsaResults.reduce((acc, r) => acc + (r.passed || 0), 0);
  let maxTestCases = total * 5; // assuming 5 test cases per problem
  let dsaScore = Math.round((totalPassed / maxTestCases) * 100);
  let dsaLevel = dsaScore >= 80 ? 'Excellent' : dsaScore >= 50 ? 'Decent' : 'Needs Improvement';
  let dsaMsg = dsaLevel === 'Excellent' ? 'Great job on coding! You solved most problems.' : dsaLevel === 'Decent' ? 'You solved some problems, but can improve coding skills.' : 'Needs significant improvement in coding.';
  // Store DSA summary in localStorage for final review
  localStorage.setItem('dsaSummary', JSON.stringify({
    total, attempted, solved, totalPassed, maxTestCases, dsaScore, dsaLevel, dsaMsg, dsaResults
  }));
  // Show summary and continue button
  let html = `<h3 class="text-xl font-bold mb-4">DSA Round Feedback</h3>
    <div style="margin-bottom:1rem;font-size:1.1rem;">Problems Solved: <b>${solved}/${total}</b> &nbsp;|&nbsp; Test Cases Passed: <b>${totalPassed}/${maxTestCases}</b></div>
    <div style="margin-bottom:1rem;font-weight:600;color:#0284c7;">${dsaMsg}</div>
    <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;">`;
  dsaResults.forEach((r, i) => {
    html += `<div style="flex:1;min-width:140px;background:${r.attempted ? (r.passed > 0 ? '#d1fae5' : '#fee2e2') : '#f3f4f6'};border-radius:0.8rem;padding:0.7rem 1rem;box-shadow:0 1px 4px #0001;display:flex;align-items:center;gap:0.5rem;">`;
    html += r.attempted ? (r.passed > 0 ? '<span style="color:#22c55e;font-size:1.3rem;">✔️</span>' : '<span style="color:#ef4444;font-size:1.3rem;">❌</span>') : '<span style="color:#a1a1aa;font-size:1.3rem;">⏭️</span>';
    html += `<span style="font-weight:600;">Problem ${i+1}</span><span style="margin-left:auto;font-size:0.95rem;">${r.attempted ? (r.passed > 0 ? `${r.passed} passed` : 'No test cases passed') : 'Skipped'}</span></div>`;
  });
  html += `</div><button id="continueToReviewBtn" style="margin-top:2rem;background:#64b5f6;color:#23201a;font-weight:600;padding:0.8rem 2.2rem;border-radius:0.8rem;font-size:1.1rem;box-shadow:0 1px 4px #0002;">Continue to Final Review</button>`;
  document.getElementById("dsaFeedback").innerHTML = html;
  document.getElementById("codingInterface").scrollIntoView({ behavior: 'smooth' });
  document.getElementById("codingInterface").classList.add("hidden");
  // Show DSA feedback modal/section
  document.getElementById("dsaFeedback").style.display = "block";
  // Continue button handler
  setTimeout(() => {
    const btn = document.getElementById("continueToReviewBtn");
    if (btn) {
      btn.onclick = () => {
        window.location.href = "index.html#interviewResults";
        // Optionally, trigger final review logic here
      };
    }
  }, 100);
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

// Employer: Render application card with Ignore/Call buttons
window.renderEmployerApplicationCard = function(app) {
  console.log('Rendering app:', app); // Debug: log the app object
  let actionBtns = '';
  if (app.status && app.status.toLowerCase() === 'pending') {
    actionBtns = `
      <button class="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 mr-2" onclick="window.ignoreApplication('${app.id}')">Ignore</button>
      <button class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" onclick="window.callForInterview('${app.id}', '${app.email}', '${app.name}')">Call for Interview</button>
    `;
  } else if (app.status && app.status.toLowerCase() === 'ignored') {
    actionBtns = `<span class='text-red-600 font-semibold'>Ignored</span>`;
  } else if (app.status && app.status.toLowerCase() === 'called') {
    actionBtns = `<button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onclick="window.openChatModal({id: '${app.id}', email: '${app.email}', name: '${app.name}'})">Chat</button>`;
  }
  return `
    <div class="candidate-card bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-4">
      <div class="mb-2">
        <h3 class="text-lg font-semibold text-gray-800">${app.name || 'N/A'}</h3>
        <p class="text-gray-600 text-sm">Email: ${app.email || 'N/A'}</p>
        <p class="text-gray-600 text-sm">Status: <b>${app.status}</b></p>
      </div>
      <div class="mt-4 flex justify-end">${actionBtns}</div>
    </div>
  `;
};

window.ignoreApplication = async function(applicationId) {
  const { error } = await window.app.jobManager.deleteApplicationFromSupabase(applicationId);
  if (!error) {
    alert('Application ignored and deleted.');
    window.location.reload();
  } else {
    alert('Error deleting application.');
  }
};

window.callForInterview = async function(applicationId, email, name) {
  const { data, error } = await window.app.jobManager.updateApplicationStatusInSupabase(applicationId, 'called');
  if (!error) {
    alert('Candidate called for interview!');
    // Optionally, open chat modal immediately
    window.openChatModal({id: applicationId, email, name});
    window.location.reload();
  } else {
    alert('Error updating status.');
  }
};

// Candidate: Render application card with Chat button if status is 'called'
window.renderSeekerApplicationCard = function(app) {
  let chatBtn = '';
  if (app.status === 'called') {
    chatBtn = `<button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2" onclick='window.openChatModal({id: "${app.id}", email: "${app.email}", name: "${app.name}"})'>Chat with Employer</button>`;
    // Show notification if just changed to called
    if (!localStorage.getItem('notified-' + app.id)) {
      alert('You have been called for interview! You can now chat with the employer.');
      localStorage.setItem('notified-' + app.id, 'true');
    }
  }
  return `
    <div class="candidate-card bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-4">
      <div class="mb-2">
        <h3 class="text-lg font-semibold text-gray-800">${app.name || 'N/A'}</h3>
        <p class="text-gray-600 text-sm">Email: ${app.email || 'N/A'}</p>
        <p class="text-gray-600 text-sm">Status: <b>${app.status}</b></p>
      </div>
      <div class="mt-4 flex justify-end">${chatBtn}</div>
    </div>
  `;
};

// Chat modal logic remains as before, using Ably and application id for channel
function openChatModal(app) {
  const chatModal = document.getElementById('chatModal');
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  if (chatModal) chatModal.classList.remove('hidden');
  if (chatMessages) chatMessages.innerHTML = '';
  if (chatInput) chatInput.value = '';
  // Use application id as unique channel name
  const channelName = 'chat-application-' + (app.id || Math.random().toString(36).slice(2));
  // Disconnect previous channel if any
  if (window.ablyChannel) window.ablyChannel.detach();
  if (!window.ablyRealtime) window.ablyRealtime = new Ably.Realtime(ABLY_API_KEY);
  window.ablyChannel = window.ablyRealtime.channels.get(channelName);
  window.ablyChannel.subscribe('message', (msg) => {
    appendChatMessage(msg.data, msg.clientId === window.ablyRealtime.auth.clientId ? 'You' : 'Other');
  });
}
window.openChatModal = openChatModal;
