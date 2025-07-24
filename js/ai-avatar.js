import { TalkingHead } from "talkinghead";

const nodeAvatar = document.getElementById('avatar');
const head = new TalkingHead(nodeAvatar, {
  ttsEndpoint: "https://plachtaa-headtts.hf.space/run/predict", // HeadTTS HuggingFace Space
  ttsLang: "en",
  ttsVoice: "en-US-001", // or any supported voice
  lipsyncLang: "en"
});

(async () => {
  await head.showAvatar({
    url: 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
    body: 'F',
    avatarMood: 'neutral'
  });
  // Zoom to upper body only
  head.setView('upper', { cameraDistance: 0.7 });
})();

window.aiAvatarSpeak = function(text) {
  head.speakText(text);
}; 