// Paste this code into your browser console after the avatar loads
console.log("=== Morph Targets ===");
if (typeof head.getMorphTargetNames === 'function') {
  const morphs = head.getMorphTargetNames();
  console.log(morphs);
  if (morphs.includes('mouthOpen')) {
    console.log('Trying to open mouth...');
    head.setValue('mouthOpen', 1);
    setTimeout(() => {
      console.log('Closing mouth...');
      head.setValue('mouthOpen', 0);
    }, 1500);
  } else {
    console.log('mouthOpen morph target not found.');
  }
} else {
  console.log('getMorphTargetNames not found on head.');
} 