const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export function setupRecognition(onResult, onStart, onEnd, onError) {
  if (!SpeechRecognition) return null;
  const recognizer = new SpeechRecognition();
  recognizer.lang = "ja-JP";
  recognizer.continuous = true;
  recognizer.interimResults = true;

  recognizer.onstart = onStart;
  recognizer.onend = onEnd;
  recognizer.onerror = onError;
  
  recognizer.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        onResult(result[0].transcript, true);
      } else {
        onResult(result[0].transcript, false);
      }
    }
  };

  return recognizer;
}

export function normalizeSpeech(text) {
  return text
    .toLowerCase()
    .replace(/[ァ-ン]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(/[ \u3000、。,.!！?？]/g, "")
    .replace(/駅/g, "")
    .replace(/jr/g, "")
    .replace(/ｊｙ/g, "jy")
    .replace(/[４四]/g, "4")
    .replace(/[６六]/g, "6")
    .replace(/[９九]/g, "9")
    .replace(/4丁目/g, "よんちょうめ")
    .replace(/6丁目/g, "ろくちょうめ")
    .replace(/9丁目/g, "きゅうちょうめ")
    .replace(/ヶ/g, "が");
}

function matchesNoeUchindai(normalized) {
  if (!normalized.includes("のえ") && !normalized.includes("野江")) return false;
  return (
    normalized.includes("うちん") ||
    normalized.includes("うちだい") ||
    normalized.includes("内代") ||
    normalized.includes("内台") ||
    normalized.includes("内大") ||
    normalized.includes("打代") ||
    normalized.includes("打台")
  );
}

export function tokenMatches(token, text) {
  const normalized = normalizeSpeech(text);
  if (token.code === "T16" && matchesNoeUchindai(normalized)) return true;
  return token.aliases.some((alias) => {
    const normalizedAlias = normalizeSpeech(alias);
    if (normalizedAlias.length <= 1) {
      return normalized === normalizedAlias;
    }
    return normalized.includes(normalizedAlias);
  });
}
