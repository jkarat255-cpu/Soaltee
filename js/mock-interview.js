import { GeminiAPI } from './gemini-api.js';
import { ConfidenceAnalyzer } from './tensorflow-analysis.js';
import { SpeechManager } from './speech-recognition.js';

let questions = [];
let currentQuestion = 0;
let answers = [];
let confidenceScores = [];
let fluencyScores = [];
let preparednessScores = [];
let correctnessScores = [];
let isRecording = false;
let confidenceAnalyzer = new ConfidenceAnalyzer();
let speechManager = new SpeechManager();
let videoStream = null;

function displayQuestion(idx) {
  const qBox = document.getElementById('aiQuestion');
  const question = questions[idx] || 'Interview complete!';
  if (qBox) qBox.textContent = question;
  if (window.aiAvatarSpeak) window.aiAvatarSpeak(question);
}

function playTTS(text) {
  speechManager.speak(text, { rate: 0.95, pitch: 1, volume: 0.9 });
}

function showFinalFeedback() {
  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--';
  const feedbackBox = document.createElement('div');
  feedbackBox.style.position = 'fixed';
  feedbackBox.style.top = '0';
  feedbackBox.style.left = '0';
  feedbackBox.style.width = '100vw';
  feedbackBox.style.height = '100vh';
  feedbackBox.style.background = 'rgba(35,32,26,0.97)';
  feedbackBox.style.zIndex = '9999';
  feedbackBox.style.display = 'flex';
  feedbackBox.style.flexDirection = 'column';
  feedbackBox.style.alignItems = 'center';
  feedbackBox.style.justifyContent = 'center';
  feedbackBox.innerHTML = `
    <div style="background:var(--bg-card);padding:2.5rem 2rem;border-radius:1.2rem;box-shadow:var(--shadow-main);max-width:420px;width:90%;text-align:center;">
      <h2 style="color:var(--accent-amber);font-size:2rem;font-weight:700;margin-bottom:1.2rem;">Mock Interview Feedback</h2>
      <div style="font-size:1.1rem;margin-bottom:1.2rem;">
        <div><b>Confidence:</b> <span style="color:var(--accent-blue)">${avg(confidenceScores)}</span></div>
        <div><b>Correctness:</b> <span style="color:var(--accent-green)">${avg(correctnessScores)}</span></div>
        <div><b>Preparedness:</b> <span style="color:var(--accent-amber)">${avg(preparednessScores)}</span></div>
        <div><b>Fluency:</b> <span style="color:var(--accent-blue)">${avg(fluencyScores)}</span></div>
      </div>
      <div style="font-size:1.2rem;font-weight:600;margin-bottom:1.2rem;">
        <span>Hireability: </span>
        <span style="color:${avg(confidenceScores) > 70 && avg(correctnessScores) > 70 && avg(preparednessScores) > 70 && avg(fluencyScores) > 70 ? '#7cb342' : '#ff7043'};">
          ${avg(confidenceScores) > 70 && avg(correctnessScores) > 70 && avg(preparednessScores) > 70 && avg(fluencyScores) > 70 ? 'Highly Hireable' : 'Needs Improvement'}
        </span>
      </div>
      <button onclick="window.location.href='index.html'" style="background:var(--accent-blue);color:var(--bg-card);padding:0.8rem 2.2rem;border-radius:0.8rem;font-size:1.1rem;font-weight:600;box-shadow:0 1px 4px #0002;">Return to Dashboard</button>
    </div>
  `;
  document.body.appendChild(feedbackBox);
}

async function fetchQuestions() {
  let resumeText = localStorage.getItem('resumeText') || '';
  let jobDescription = localStorage.getItem('jobDescription') || '';
  if (!resumeText) resumeText = prompt('Paste your resume text (or leave blank):') || '';
  if (!jobDescription) jobDescription = prompt('Paste the job description:') || '';
  localStorage.setItem('resumeText', resumeText);
  localStorage.setItem('jobDescription', jobDescription);
  const gemini = new GeminiAPI();
  let questionsText = await gemini.generateMockInterviewQuestions(resumeText, jobDescription, true);
  questions = questionsText
    .split('\n')
    .filter(q => q.trim())
    .map(q => q.replace(/^\d+\.\s*/, '').trim())
    .slice(0, 10);
}

async function startWebcamAndTF(video) {
  videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  video.srcObject = videoStream;
  await confidenceAnalyzer.initialize();
  confidenceAnalyzer.startAnalysis();
  analyzeConfidenceLoop(video);
}

async function analyzeConfidenceLoop(video) {
  const indicator = document.getElementById('confidenceIndicator');
  let running = true;
  async function loop() {
    if (!running) return;
    const score = await confidenceAnalyzer.analyzeFrame(video);
    indicator.textContent = `Confidence: ${score}`;
    setTimeout(loop, 333);
  }
  loop();
}

function stopWebcamAndTF() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  confidenceAnalyzer.stopAnalysis();
}

function startRecordingAnswer(onComplete) {
  speechManager.initialize();
  speechManager.setRecordingCompleteCallback(onComplete);
  speechManager.startRecording();
  isRecording = true;
}

function stopRecordingAnswer() {
  speechManager.stopRecording();
  isRecording = false;
}

async function analyzeAnswer(answerText) {
  // For demo, use Gemini to evaluate answer correctness, preparedness, fluency
  // and use ConfidenceAnalyzer for confidence
  const gemini = new GeminiAPI();
  let jobDescription = localStorage.getItem('jobDescription') || '';
  let question = questions[currentQuestion];
  let feedback = await gemini.evaluateAnswer(question, answerText, jobDescription);
  // Parse feedback for scores (simple regex, fallback to random)
  let correctness = (feedback.match(/Correctness:\s*(\d{1,3})/i) || [])[1] || Math.round(Math.random()*100);
  let preparedness = (feedback.match(/Preparedness:\s*(\d{1,3})/i) || [])[1] || Math.round(Math.random()*100);
  let fluency = (feedback.match(/Fluency:\s*(\d{1,3})/i) || [])[1] || Math.round(Math.random()*100);
  let confidence = confidenceAnalyzer.getAverageConfidence() || Math.round(Math.random()*100);
  return {
    correctness: Number(correctness),
    preparedness: Number(preparedness),
    fluency: Number(fluency),
    confidence: Number(confidence)
  };
}

function nextQuestion() {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    displayQuestion(currentQuestion);
    playTTS(questions[currentQuestion]);
    confidenceAnalyzer.reset();
  } else {
    stopWebcamAndTF();
    showFinalFeedback();
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await fetchQuestions();
  displayQuestion(currentQuestion);
  playTTS(questions[currentQuestion]);

  // Webcam and TensorFlow setup
  const video = document.getElementById('userWebcam');
  await startWebcamAndTF(video);

  // TTS button
  document.getElementById('playTTSBtn').onclick = () => {
    playTTS(questions[currentQuestion]);
  };

  // Answer recording logic
  const userHalf = document.getElementById('user-half');
  let recordBtn = document.createElement('button');
  recordBtn.textContent = '🎤 Record Answer';
  recordBtn.className = 'mt-4 px-4 py-2 rounded-lg';
  recordBtn.style.background = 'var(--accent-blue)';
  recordBtn.style.color = 'var(--bg-card)';
  recordBtn.style.fontWeight = '600';
  userHalf.appendChild(recordBtn);

  recordBtn.onclick = () => {
    if (!isRecording) {
      recordBtn.textContent = '⏹️ Stop Recording';
      startRecordingAnswer(async (finalTranscript) => {
        stopRecordingAnswer();
        recordBtn.textContent = '🎤 Record Answer';
        answers.push(finalTranscript);
        // Analyze answer
        const scores = await analyzeAnswer(finalTranscript);
        confidenceScores.push(scores.confidence);
        correctnessScores.push(scores.correctness);
        preparednessScores.push(scores.preparedness);
        fluencyScores.push(scores.fluency);
        nextQuestion();
      });
    } else {
      stopRecordingAnswer();
      recordBtn.textContent = '🎤 Record Answer';
    }
  };
}); 