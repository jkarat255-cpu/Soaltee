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
  const interval = 100; // ms
  function setMouthMorphs(val) {
    head.setValue && head.setValue('mouthOpen', val);
    head.setValue && head.setValue('jawOpen', val);
    head.setValue && head.setValue('viseme_aa', val);
    head.setValue && head.setValue('mouthFunnel', val);
  }
  function animateMouth() {
    if (t >= duration) {
      setMouthMorphs(0);
      return;
    }
    // Alternate mouth fully open/closed (max open = 2)
    const value = (t / interval) % 2 === 0 ? 2 : 0;
    setMouthMorphs(value);
    t += interval;
    setTimeout(animateMouth, interval);
  }
  animateMouth();
}; 