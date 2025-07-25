// Speech recognition and synthesis utilities
export class SpeechManager {
  constructor() {
    this.recognition = null
    this.synthesis = window.speechSynthesis
    this.isRecording = false
    this.currentTranscript = ""
    this.finalTranscript = ""
    this.fullTranscript = ""
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
      this.fullTranscript = "" // Reset at the start of each recording
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
      // Accumulate all final results into fullTranscript
      if (finalTranscript) {
        this.fullTranscript += finalTranscript + ' ';
      }

      if (this.onTranscriptUpdate) {
        this.onTranscriptUpdate(this.fullTranscript + interimTranscript, finalTranscript)
      }
    }

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
    }

    this.recognition.onend = () => {
      console.log("Speech recognition ended")
      this.isRecording = false
      if (this.onRecordingComplete) {
        // Pass the accumulated full transcript
        this.onRecordingComplete(this.fullTranscript.trim())
      }
    }

    return true
  }

  startRecording() {
    if (!this.recognition) {
      console.error("Speech recognition not initialized")
      return false
    }

    if (this.isRecording) {
      // Already recording, don't start again
      return false
    }

    this.currentTranscript = ""
    this.finalTranscript = ""

    try {
      this.recognition.start()
      this.isRecording = true // Set flag immediately to avoid race conditions
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

    // Always try to use a female English voice if available
    const voices = this.synthesis.getVoices();
    // Try to find a known female English voice
    let femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('susan') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('linda') || v.name.toLowerCase().includes('f') || v.gender === 'female'));
    // Fallback: any English voice with 'F' or 'female' in the name
    if (!femaleVoice) {
      femaleVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('f') || v.name.toLowerCase().includes('female')));
    }
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
