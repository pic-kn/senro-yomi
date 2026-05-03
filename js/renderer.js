export function initRenderer(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// 絶対座標でのルート生成
export function getRoutePoints(route) {
  const count = route.stations.length;
  const stationGap = 260; // 駅と駅の間隔（ピクセル）

  if (route.layout === "loop") {
    // 円周 = count * stationGap
    const radius = (count * stationGap) / (2 * Math.PI);
    return route.stations.map((_, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      return {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });
  }

  if (route.layout === "vertical") {
    return route.stations.map((_, index) => {
      return {
        x: Math.sin(index * 0.8) * 80, // 少し波打つ
        y: index * stationGap,
      };
    });
  }

  // horizontal (default)
  return route.stations.map((_, index) => {
    return {
      x: index * stationGap,
      y: Math.sin(index * 0.8) * 80,
    };
  });
}

function labelOffset(index, point, route) {
  if (route.layout === "loop") {
    const length = Math.hypot(point.x, point.y) || 1;
    return [(point.x / length) * 85, (point.y / length) * 45];
  }

  if (route.layout === "vertical") {
    const side = index % 2 === 0 ? -1 : 1;
    return [side * 90, 0];
  }

  return [0, index % 2 === 0 ? -50 : 50];
}

export function splitKana(kana) {
  if (kana.length <= 8) return [kana];
  const midpoint = Math.ceil(kana.length / 2);
  return [kana.slice(0, midpoint), kana.slice(midpoint)];
}

function drawToken(ctx, token, x, y, index, state) {
  const completed = state.mode === "finished" || index < state.index;
  const isCorrectFlash = index === state.correctFlashIndex && state.correctFlashTimer > 0;
  const flash = isCorrectFlash ? state.correctFlashTimer / 0.72 : 0;
  const pulse = Math.sin((1 - flash) * Math.PI);
  
  const kanaLines = splitKana(token.kana);
  const labelWidth = (kanaLines.length > 1 ? 112 : 86) + pulse * 8;
  const labelHeight = (kanaLines.length > 1 ? 46 : 36) + pulse * 4;

  if (flash > 0) {
    ctx.shadowColor = "rgba(22, 199, 132, 0.42)";
    ctx.shadowBlur = 14 * flash;
    ctx.fillStyle = `rgba(222, 255, 234, ${0.92 + flash * 0.08})`;
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = completed ? "rgba(226, 248, 236, 0.96)" : "rgba(255, 255, 255, 0.94)";
  }

  roundedRect(ctx, x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = flash > 0 ? "#16c784" : "rgba(21, 48, 74, 0.18)";
  ctx.lineWidth = flash > 0 ? 2 : 1;
  ctx.stroke();

  if (completed || flash > 0) {
    ctx.fillStyle = "rgba(67, 209, 122, 0.82)";
    ctx.beginPath();
    ctx.arc(x + labelWidth / 2 - 9, y - labelHeight / 2 + 9, 5 + pulse * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + labelWidth / 2 - 12, y - labelHeight / 2 + 9);
    ctx.lineTo(x + labelWidth / 2 - 10, y - labelHeight / 2 + 11);
    ctx.lineTo(x + labelWidth / 2 - 6, y - labelHeight / 2 + 6);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 8px system-ui";
  ctx.fillStyle = "#6f7d8f";
  ctx.fillText(token.code, x, y - labelHeight / 2 + 9);
  
  ctx.fillStyle = "#111111";
  const fontSize = kanaLines.length > 1 ? 11 : 15;
  ctx.font = `800 ${fontSize}px 'Hiragino Sans', system-ui, sans-serif`;
  if (kanaLines.length > 1) {
    ctx.fillText(kanaLines[0], x, y - 1);
    ctx.fillText(kanaLines[1], x, y + 13);
  } else {
    ctx.fillText(kanaLines[0], x, y + 5);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function renderCanvas(ctx, logicalWidth, logicalHeight, state, route, assets) {
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  
  // 背景は固定（スクロールしない）
  if (assets && assets.background && assets.background.complete) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    const imgRatio = assets.background.width / assets.background.height;
    const canvasRatio = logicalWidth / logicalHeight;
    let dw, dh, dx, dy;
    if (canvasRatio > imgRatio) {
      dw = logicalWidth;
      dh = logicalWidth / imgRatio;
      dx = 0;
      dy = (logicalHeight - dh) / 2;
    } else {
      dw = logicalHeight * imgRatio;
      dh = logicalHeight;
      dx = (logicalWidth - dw) / 2;
      dy = 0;
    }
    ctx.drawImage(assets.background, dx, dy, dw, dh);
    ctx.restore();
  }

  // 画面の基準スケール（PCでもスマホでも見やすいサイズ感にする）
  // 縦横の短い方を基準にするが、大きくなりすぎないように制限
  const baseSize = Math.min(logicalWidth, logicalHeight);
  const scale = Math.max(0.6, Math.min(1.2, baseSize / 600));

  const routePoints = getRoutePoints(route);

  ctx.save();
  // 画面中央を原点とし、カメラ位置に合わせてスクロール
  ctx.translate(logicalWidth / 2, logicalHeight / 2);
  ctx.scale(scale, scale);
  
  // スマホなどで端の方が見えすぎないように、進行方向へ少しオフセットをかけることも可能だが、
  // 今回は純粋にターゲット座標を中心に置く
  ctx.translate(-state.cameraX, -state.cameraY);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 24;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  routePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.strokeStyle = route.color;
  ctx.lineWidth = 15;
  ctx.beginPath();
  routePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  routePoints.forEach((point, index) => {
    const isCompleted = state.mode === "finished" || index < state.index;
    const isCorrectFlash = index === state.correctFlashIndex && state.correctFlashTimer > 0;
    const flashProgress = isCorrectFlash ? state.correctFlashTimer / 0.72 : 0;
    const pulse = Math.sin((1 - flashProgress) * Math.PI);
    
    if (flashProgress > 0) {
      ctx.save();
      ctx.globalAlpha = flashProgress * 0.8;
      ctx.strokeStyle = "#16c784";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 11 + (1 - flashProgress) * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.fillStyle = flashProgress > 0 ? "#43d17a" : isCompleted ? "#dff7ea" : "#ffffff";
    ctx.strokeStyle = route.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6 + pulse * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  state.sheet.forEach((token, index) => {
    const point = routePoints[index];
    const [dx, dy] = labelOffset(index, point, route);
    drawToken(ctx, token, point.x + dx, point.y + dy, index, state);
  });

  ctx.restore();

  // ルートのタイトルは画面左上に固定（スクロールしないUIレイヤー）
  ctx.textAlign = "left";
  ctx.fillStyle = "#15304a";
  ctx.font = `800 ${28 * scale}px system-ui`;
  ctx.fillText(route.title, 20 * scale, 40 * scale);
  ctx.fillStyle = "#63738a";
  ctx.font = `700 ${16 * scale}px system-ui`;
  ctx.fillText(route.note, 20 * scale, 65 * scale);
}
