import { routeSets, rewardsList } from './data.js';
import { initAudio, playSound } from './audio.js';
import { setupRecognition, tokenMatches, normalizeSpeech } from './speech.js';
import { initRenderer, renderCanvas, getRoutePoints } from './renderer.js';
import { fireConfetti, stopConfetti } from './confetti.js';

let renderer;
let recognition = null;
let recognitionRestartTimer = 0;
let animationId = 0;
let lastTime = 0;

let logicalWidth = 960;
let logicalHeight = 540;

function resizeCanvas() {
  const stageWrap = document.getElementById("stageWrap");
  if (!stageWrap || !renderer || !renderer.canvas) return;
  
  logicalWidth = stageWrap.clientWidth || 960;
  logicalHeight = stageWrap.clientHeight || 540;
  const dpr = window.devicePixelRatio || 1;
  
  renderer.canvas.width = logicalWidth * dpr;
  renderer.canvas.height = logicalHeight * dpr;
  renderer.ctx.setTransform(1, 0, 0, 1, 0, 0);
  renderer.ctx.scale(dpr, dpr);
}

let currentRouteKey = "midosuji";
const bestTimePrefix = "line-call-quest-best-time";
const rewardKey = "line-call-quest-rewards";

let state = {
  mode: "ready", // ready, playing, paused, finished
  isEndless: false,
  sheet: [],
  index: 0,
  elapsed: 0,
  attempts: 0,
  errors: 0,
  routeKey: currentRouteKey,
  bestTime: 0,
  rewardCount: 0,
  feedback: "まいくをおしてね",
  feedbackTimer: 0,
  correctFlashIndex: -1,
  correctFlashTimer: 0,
  listening: false,
  transcriptLog: [],
  transcript: "--",
  earnedReward: "",
};

function getCurrentRoute() {
  return routeSets[currentRouteKey];
}

function createState() {
  const route = getCurrentRoute();
  return {
    mode: "ready",
    isEndless: state.isEndless,
    sheet: route.stations,
    index: 0,
    elapsed: 0,
    attempts: 0,
    errors: 0,
    routeKey: currentRouteKey,
    bestTime: Number(localStorage.getItem(`${bestTimePrefix}:${currentRouteKey}`) || 0),
    rewardCount: Number(localStorage.getItem(rewardKey) || 0),
    feedback: "まいくをおしてね",
    feedbackTimer: 0,
    correctFlashIndex: -1,
    correctFlashTimer: 0,
    listening: false,
    transcriptLog: [],
    transcript: "--",
    earnedReward: "",
    cameraX: 0,
    cameraY: 0,
    cameraInitialized: false,
  };
}

const timeLabelEl = document.querySelector("#timeLabel");
const timeEl = document.querySelector("#time");
const progressEl = document.querySelector("#progress");
const bestEl = document.querySelector("#best");
const accuracyEl = document.querySelector("#accuracy");
const rewardEl = document.querySelector("#reward");
const overlay = document.querySelector("#overlay");
const primaryAction = document.querySelector("#primaryAction");
const routeButtons = document.querySelector("#routeButtons");
const endlessToggle = document.querySelector("#endlessToggle");
const statusFeedbackEl = document.querySelector("#statusFeedback");
const statusTranscriptEl = document.querySelector("#statusTranscript");

const roundDuration = 120;
const assets = {
  background: new Image(),
};
assets.background.src = "./assets/signal-city-background.png";

function formatTime(seconds) {
  if (!seconds) return "--";
  if (state.isEndless && state.mode !== "finished") return "∞";
  return `${Math.round(seconds)}びょう`;
}

function estimateAccuracy() {
  const spoken = normalizeSpeech(state.transcriptLog.join(""));
  if (!spoken) return state.index === state.sheet.length ? 100 : 0;
  const matched = state.sheet.filter((token) => tokenMatches(token, spoken)).length;
  return Math.round((matched / state.sheet.length) * 100);
}

function syncHud() {
  const total = state.sheet.length;
  const remaining = state.isEndless ? 999 : Math.max(0, roundDuration - state.elapsed);
  const completed = state.mode === "finished" && state.index >= total;
  timeLabelEl.textContent = completed ? "かかった" : "のこり";
  timeEl.textContent = completed ? formatTime(state.elapsed) : formatTime(remaining);
  progressEl.textContent = state.mode === "playing" ? "よんでね" : `${Math.min(state.index, total)}/${total}`;
  bestEl.textContent = formatTime(state.bestTime);
  accuracyEl.textContent = `${estimateAccuracy()}%`;
  rewardEl.textContent = state.rewardCount;
  
  if (statusFeedbackEl) statusFeedbackEl.textContent = state.feedback;
  if (statusTranscriptEl) statusTranscriptEl.textContent = state.mode === "finished" ? "できた" : "ひだりから よんでね";
}

function showOverlay(title, copy, actionText) {
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = copy;
  primaryAction.textContent = actionText;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function scheduleRecognitionRestart() {
  clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = window.setTimeout(() => {
    if (state.mode !== "playing" || state.index >= state.sheet.length || state.listening) return;
    try {
      recognition.start();
    } catch(e) {}
  }, 400);
}

const debugLogEl = document.querySelector("#debugLog");

function handleSpokenText(text, isFinal) {
  if (state.mode !== "playing" || state.index >= state.sheet.length) return;
  state.transcript = text.trim() || "--";
  
  if (debugLogEl) {
    debugLogEl.textContent = `認識: "${text}"\n状態: ${isFinal ? "確定" : "途中"}\n次: ${state.sheet[state.index]?.kana}`;
  }
  
  if (state.transcript !== "--") {
    // 中間結果（isFinal=false）でも、一致していれば即座に「正解（早押し）」とする！
    if (tokenMatches(state.sheet[state.index], text)) {
      playSound('correct');
      state.correctFlashIndex = state.index;
      state.correctFlashTimer = 0.72;
      state.index += 1;
      state.attempts += 1;
      state.feedback = "できた";
      state.feedbackTimer = 0.35;
      
      // 正解した場合はログに残す
      state.transcriptLog.push(state.transcript);
      
      if (state.index >= state.sheet.length) {
        finishRound();
        return;
      }
    } else if (isFinal) {
      // 確定(isFinal)まで待って不正解だった場合のみ、エラー系処理を行う
      state.transcriptLog.push(state.transcript);
      
      if (state.sheet.some((station) => tokenMatches(station, text))) {
        state.feedback = "じゅんばんにいこう";
        state.attempts += 1;
      } else {
        state.feedback = "きいてるよ";
        state.attempts += 1;
      }
    }
  }
  syncHud();
}

function startRound() {
  stopConfetti();
  initAudio();
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
  
  state = createState();
  state.mode = "playing";
  hideOverlay();
  lastTime = performance.now();

  recognition = setupRecognition(
    handleSpokenText,
    () => { state.listening = true; state.feedback = "きいてるよ"; syncHud(); },
    () => { 
      state.listening = false; 
      if (state.mode === "playing") {
        state.feedback = "まいくをつなぎなおすよ";
        scheduleRecognitionRestart();
      }
      syncHud();
    },
    (event) => {
      state.listening = false;
      if (event.error === "not-allowed") {
        state.feedback = "まいくをゆるしてね";
      } else if (state.mode === "playing") {
        scheduleRecognitionRestart();
      }
      syncHud();
    }
  );
  
  if (recognition) {
    try { recognition.start(); } catch(e) { state.feedback = "まいくがつかえないよ"; }
  } else {
    showOverlay("まいくがつかえないよ", "くろーむでひらいてね。", "もういちど");
  }
  syncHud();
}

function togglePause() {
  initAudio();
  if (state.mode === "playing") {
    state.mode = "paused";
    if (recognition) {
      try { recognition.stop(); } catch(e) {}
    }
    state.listening = false;
    showOverlay("おやすみ", "よむのをとめたよ。つづけるときは、もういちどまいくをつかうよ。", "つづける");
    syncHud();
  } else if (state.mode === "paused") {
    state.mode = "playing";
    hideOverlay();
    lastTime = performance.now();
    if (recognition) {
      try { recognition.start(); } catch(e) {}
    }
  }
}

function finishRound() {
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
  state.mode = "finished";
  state.listening = false;
  playSound('clear');

  const accuracy = estimateAccuracy();
  const improved = state.index === state.sheet.length && accuracy >= 70 && (!state.bestTime || state.elapsed < state.bestTime);

  if (improved) {
    state.bestTime = state.elapsed;
    state.rewardCount += 1;
    state.earnedReward = rewardsList[(state.rewardCount - 1) % rewardsList.length];
    localStorage.setItem(`${bestTimePrefix}:${state.routeKey}`, String(state.bestTime));
    localStorage.setItem(rewardKey, String(state.rewardCount));
  }

  syncHud();

  if (improved || state.index === state.sheet.length) {
    fireConfetti(4000);
  }

  if (improved) {
    showOverlay("きろくこうしん", `かかったじかんは${formatTime(state.elapsed)}。ごほうび「${state.earnedReward}」をもらったよ。`, "もういちど");
  } else {
    showOverlay("できた", `かかったじかんは${formatTime(state.elapsed)}。きこえたことばは${accuracy}%あっていたよ。`, "もういちど");
  }
}

function timeUpRound() {
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
  state.mode = "finished";
  state.listening = false;
  state.feedback = "じかんだよ";
  playSound('wrong');
  syncHud();
  showOverlay("じかんだよ", `${state.index}/${state.sheet.length}こ よめたよ。もういちどちょうせんしよう。`, "もういちど");
}

function renderRouteButtons() {
  routeButtons.innerHTML = "";
  Object.entries(routeSets).forEach(([key, route]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `route-choice${key === currentRouteKey ? " active" : ""}`;
    button.innerHTML = `<span class="route-swatch" style="background:${route.color}"></span>${route.shortName}`;
    button.addEventListener("click", () => selectRoute(key));
    routeButtons.appendChild(button);
  });
}

function selectRoute(key) {
  if (!routeSets[key]) return;
  stopConfetti();
  if (recognition) {
    try { recognition.stop(); } catch(e) {}
  }
  currentRouteKey = key;
  state = createState();
  renderRouteButtons();
  syncHud();
  const route = getCurrentRoute();
  renderCanvas(renderer.ctx, logicalWidth, logicalHeight, state, route, assets);
  showOverlay("せんろ よみ", `${route.shortName}を、ひだりからじゅんばんによもう。`, "はじめる");
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
  lastTime = now;

  if (state.mode === "playing") {
    state.elapsed += dt;
    state.feedbackTimer = Math.max(0, state.feedbackTimer - dt);
    if (!state.isEndless && state.elapsed >= roundDuration) {
      state.elapsed = roundDuration;
      timeUpRound();
    }
    syncHud();
  }
  state.correctFlashTimer = Math.max(0, state.correctFlashTimer - dt);

  const route = getCurrentRoute();
  const points = getRoutePoints(route, logicalWidth, logicalHeight);
  const targetIndex = Math.min(state.index, points.length - 1);
  const targetPoint = points[targetIndex];

  // ページ番号からターゲットのカメラX座標を計算
  const targetCameraX = targetPoint.page * logicalWidth;

  if (!state.cameraInitialized) {
    state.cameraX = targetCameraX;
    state.cameraY = 0;
    state.cameraInitialized = true;
  } else {
    // ページ切り替え時は速めにスライド
    const lerpSpeed = 1 - Math.exp(-8 * dt);
    state.cameraX += (targetCameraX - state.cameraX) * lerpSpeed;
  }

  renderCanvas(renderer.ctx, logicalWidth, logicalHeight, state, route, assets);
  
  animationId = requestAnimationFrame(frame);
}

primaryAction.addEventListener("click", () => {
  initAudio();
  if (state.mode === "ready" || state.mode === "finished") startRound();
  else if (state.mode === "paused") togglePause();
});

endlessToggle.addEventListener("change", (e) => {
  state.isEndless = e.target.checked;
  syncHud();
});

document.addEventListener("DOMContentLoaded", () => {
  renderer = initRenderer("gameCanvas");
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  state = createState();
  renderRouteButtons();
  syncHud();
  
  const route = getCurrentRoute();
  renderCanvas(renderer.ctx, logicalWidth, logicalHeight, state, route, assets);
  showOverlay("せんろ よみ", `${route.shortName}を、ひだりからじゅんばんによもう。`, "はじめる");
  
  animationId = requestAnimationFrame(frame);
});
