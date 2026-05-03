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

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(s1, s2) {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - levenshteinDistance(longer, shorter)) / parseFloat(longerLength);
}

export function tokenMatches(token, text) {
  const normalized = normalizeSpeech(text);
  if (token.code === "T16" && matchesNoeUchindai(normalized)) return true;
  
  return token.aliases.some((alias) => {
    const normalizedAlias = normalizeSpeech(alias);
    
    // 1. 完全一致または部分一致
    if (normalized.includes(normalizedAlias)) return true;
    
    // 2. ファジーマッチング（曖昧判定）
    // 短い単語と長い単語で閾値を変える（短い単語ほど1文字の違いが致命的なため）
    const threshold = normalizedAlias.length <= 3 ? 0.65 : 0.75;
    
    // 認識されたテキストが長すぎる場合（他の言葉も混ざっている場合）は全体比較だとスコアが落ちるので、
    // 長さが似通っている時のみファジーマッチングを行う
    if (normalized.length <= normalizedAlias.length + 2) {
      if (similarity(normalized, normalizedAlias) >= threshold) {
        return true;
      }
    }
    
    return false;
  });
}
