const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

export function initAudio() {
  if (!audioCtx && AudioContext) {
    audioCtx = new AudioContext();
  }
}

export function playSound(type) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  const now = audioCtx.currentTime;
  
  if (type === 'correct') {
    // ピンポン
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.setValueAtTime(1046.50, now + 0.15); // C6
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gainNode.gain.setValueAtTime(0.15, now + 0.15);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'wrong') {
    // ブブー
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gainNode.gain.setValueAtTime(0.2, now + 0.2);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.25);
    
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (type === 'clear') {
    // ファンファーレ
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.4); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.6); // C6
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.1);
    gainNode.gain.setValueAtTime(0.3, now + 0.8);
    gainNode.gain.linearRampToValueAtTime(0, now + 1.2);
    
    osc.start(now);
    osc.stop(now + 1.2);
  }
}
