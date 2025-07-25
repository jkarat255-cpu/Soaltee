import { TalkingHead } from "talkinghead";

const nodeAvatar = document.getElementById('avatar');
const head = new TalkingHead(nodeAvatar, {
  ttsEndpoint: "https://plachtaa-headtts.hf.space/run/predict", // HeadTTS HuggingFace Space
  ttsLang: "en",
  // Use a natural-sounding female voice (see HeadTTS docs for more options)
  ttsVoice: "en-US-004", // en-US-004 is a female voice in HeadTTS
  lipsyncLang: "en"
});
window.head = head;

(async () => {
  await head.showAvatar({
    url: 'https://models.readyplayer.me/6882e97fb7044236df4d8e29.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
    body: 'F',
    avatarMood: 'neutral'
  });
  // Zoom to upper body only
  head.setView('upper', { cameraDistance: 0.7 });
})();

window.aiAvatarSpeak = function(text) {
  head.speakText(text);
  // FAKE LIPSYNC: animate multiple morphs for 2 seconds, fully open/close (max open)
  let t = 0;
  const duration = 8000; // ms
  const interval = 60; // ms
  function setMouthMorphs(height, width) {
    head.setValue && head.setValue('mouthOpen', height);
    head.setValue && head.setValue('jawOpen', height);
    head.setValue && head.setValue('viseme_aa', height);
    head.setValue && head.setValue('mouthFunnel', height);
    head.setValue && head.setValue('mouthStretchLeft', width);
    head.setValue && head.setValue('mouthStretchRight', width);
  }
  function animateMouth() {
    if (t >= duration) {
      setMouthMorphs(0.15, 0.05);
      return;
    }
    // Randomly vary height and width for more natural talking (very subtle, more frequent random jumps)
    let height;
    if (Math.random() < 0.4) {
      // 40% chance: jump to min or max
      height = Math.random() < 0.5 ? 0.18 : 0.22;
    } else {
      height = 0.18 + Math.random() * 0.04; // 0.18–0.22
    }
    const width = 0.08 + Math.random() * 0.15;  // 0.08–0.23
    setMouthMorphs(height, width);
    t += interval;
    setTimeout(animateMouth, interval);
  }
  animateMouth();
}; 