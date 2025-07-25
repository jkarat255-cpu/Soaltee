import { TalkingHead } from "talkinghead";

const nodeAvatar = document.getElementById('avatar');
const head = new TalkingHead(nodeAvatar, {
  ttsEndpoint: "https://plachtaa-headtts.hf.space/run/predict", // HeadTTS HuggingFace Space
  ttsLang: "en",
  // Use a natural-sounding female voice (see HeadTTS docs for more options)
  ttsVoice: "en-US-004", // en-US-004 is a female voice in HeadTTS
  lipsyncLang: "en"
});

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
}; 