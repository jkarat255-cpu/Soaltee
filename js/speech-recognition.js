// Speech recognition and synthesis utilities
export class SpeechManager {
  constructor() {
    this.recognition = null
    this.synthesis = window.speechSynthesis
    this.isRecording = false
    this.currentTranscript = ""
    this.finalTranscript = ""
    this.onTranscriptUpdate = null
    this.onRecordingComplete = null
  }

  initialize() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      console.error("Speech recognition not supported")
      return false
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.recognition = new SpeechRecognition()

    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = "en-US"

    this.recognition.onstart = () => {
      console.log("Speech recognition started")
      this.isRecording = true
    }

    this.recognition.onresult = (event) => {
      let interimTranscript = ""
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      this.currentTranscript = finalTranscript + interimTranscript
      this.finalTranscript = finalTranscript

      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(this.currentTranscript, finalTranscript)
      }
    }

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
    }

    this.recognition.onend = () => {
      console.log("Speech recognition ended")
      this.isRecording = false
      if (this.onRecordingComplete) {
        this.onRecordingComplete(this.finalTranscript)
      }
    }

    return true
  }

  startRecording() {
    if (!this.recognition) {
      console.error("Speech recognition not initialized")
      return false
    }

    this.currentTranscript = ""
    this.finalTranscript = ""

    try {
      this.recognition.start()
      return true
    } catch (error) {
      console.error("Error starting speech recognition:", error)
      return false
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop()
    }
  }

  speak(text, options = {}) {
    if (!this.synthesis) {
      console.error("Speech synthesis not supported")
      return
    }

    // Cancel any ongoing speech
    this.synthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate || 0.9
    utterance.pitch = options.pitch || 1
    utterance.volume = options.volume || 0.8

    // Always try to use a female voice if available
    const voices = this.synthesis.getVoices();
    const femaleVoice = voices.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('woman') || v.name.toLowerCase().includes('girl') || (v.lang.startsWith('en') && v.name.toLowerCase().includes('us') && v.name.toLowerCase().includes('f')) || v.gender === 'female');
    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    if (options.onEnd) {
      utterance.onend = options.onEnd
    }

    this.synthesis.speak(utterance)
  }

  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel()
    }
  }

  setTranscriptCallback(callback) {
    this.onTranscriptUpdate = callback
  }

  setRecordingCompleteCallback(callback) {
    this.onRecordingComplete = callback
  }
}

// Global instance
const speechManager = new SpeechManager()
