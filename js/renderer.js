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

export function getRoutePoints(route, width, height) {
  const count = route.stations.length;
  const isPortrait = height > width;
  const cx = width / 2;
  const cy = height / 2;

  if (route.layout === "loop") {
    return route.stations.map((_, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      const rx = isPortrait ? width * 0.35 : width * 0.3;
      const ry = isPortrait ? height * 0.3 : height * 0.35;
      return {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      };
    });
  }

  // 直線路線（Portrait時は縦、Landscape時は横）
  const marginX = isPortrait ? width * 0.15 : width * 0.12;
  const marginY = isPortrait ? height * 0.1 : height * 0.2;

  return route.stations.map((_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    if (isPortrait) {
      // 上から下へ
      return {
        x: cx + Math.sin((t - 0.1) * Math.PI * 2) * (width * 0.15),
        y: marginY + t * (height - marginY * 2),
      };
    } else {
      // 左から右へ
      return {
        x: marginX + t * (width - marginX * 2),
        y: cy + Math.sin((t - 0.1) * Math.PI * 2) * (height * 0.15),
      };
    }
  });
}

function labelOffset(index, point, route, width, height, scale) {
  const isPortrait = height > width;
  
  if (route.layout === "loop") {
    const dx = point.x - width / 2;
    const dy = point.y - height / 2;
    const length = Math.hypot(dx, dy) || 1;
    return [(dx / length) * 85 * scale, (dy / length) * 45 * scale];
  }

  if (isPortrait) {
    const side = index % 2 === 0 ? -1 : 1;
    return [side * 90 * scale, 0];
  } else {
    return [0, index % 2 === 0 ? -50 * scale : 50 * scale];
  }
}

export function splitKana(kana) {
  if (kana.length <= 8) return [kana];
  const midpoint = Math.ceil(kana.length / 2);
  return [kana.slice(0, midpoint), kana.slice(midpoint)];
}

function drawToken(ctx, token, x, y, index, state, scale) {
  const completed = state.mode === "finished" && index < state.index;
  const isCorrectFlash = index === state.correctFlashIndex && state.correctFlashTimer > 0;
  const flash = isCorrectFlash ? state.correctFlashTimer / 0.72 : 0;
  const pulse = Math.sin((1 - flash) * Math.PI);
  
  const kanaLines = splitKana(token.kana);
  const baseLabelWidth = kanaLines.length > 1 ? 112 : 86;
  const baseLabelHeight = kanaLines.length > 1 ? 46 : 36;
  
  const labelWidth = (baseLabelWidth + pulse * 8) * scale;
  const labelHeight = (baseLabelHeight + pulse * 4) * scale;

  if (flash > 0) {
    ctx.shadowColor = "rgba(22, 199, 132, 0.42)";
    ctx.shadowBlur = 14 * scale * flash;
    ctx.fillStyle = `rgba(222, 255, 234, ${0.92 + flash * 0.08})`;
  } else {
    ctx.shadowBlur = 0;
    ctx.fillStyle = completed ? "rgba(226, 248, 236, 0.96)" : "rgba(255, 255, 255, 0.94)";
  }

  roundedRect(ctx, x - labelWidth / 2, y - labelHeight / 2, labelWidth, labelHeight, 8 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = flash > 0 ? "#16c784" : "rgba(21, 48, 74, 0.18)";
  ctx.lineWidth = (flash > 0 ? 2 : 1) * scale;
  ctx.stroke();

  if (completed || flash > 0) {
    ctx.fillStyle = "rgba(67, 209, 122, 0.82)";
    ctx.beginPath();
    ctx.arc(x + labelWidth / 2 - 9 * scale, y - labelHeight / 2 + 9 * scale, (5 + pulse * 2) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(x + labelWidth / 2 - 12 * scale, y - labelHeight / 2 + 9 * scale);
    ctx.lineTo(x + labelWidth / 2 - 10 * scale, y - labelHeight / 2 + 11 * scale);
    ctx.lineTo(x + labelWidth / 2 - 6 * scale, y - labelHeight / 2 + 6 * scale);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${8 * scale}px system-ui`;
  ctx.fillStyle = "#6f7d8f";
  ctx.fillText(token.code, x, y - labelHeight / 2 + 9 * scale);
  
  ctx.fillStyle = "#111111";
  const fontSize = (kanaLines.length > 1 ? 11 : 15) * scale;
  ctx.font = `800 ${fontSize}px 'Hiragino Sans', system-ui, sans-serif`;
  if (kanaLines.length > 1) {
    ctx.fillText(kanaLines[0], x, y - 1 * scale);
    ctx.fillText(kanaLines[1], x, y + 13 * scale);
  } else {
    ctx.fillText(kanaLines[0], x, y + 5 * scale);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function renderCanvas(ctx, logicalWidth, logicalHeight, state, route, assets) {
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  
  // スマホなど縦長画面に合わせたスケール計算
  const scale = Math.min(logicalWidth, logicalHeight) / 540;
  const routePoints = getRoutePoints(route, logicalWidth, logicalHeight);

  if (assets && assets.background && assets.background.complete) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    // 背景画像は全画面にカバーする
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

  // 中央の半透明パネル（全画面ならなくても良いが、一応残す。少し広めに）
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  roundedRect(ctx, logicalWidth * 0.05, logicalHeight * 0.05, logicalWidth * 0.9, logicalHeight * 0.9, 22 * scale);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 24 * scale;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  routePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.strokeStyle = route.color;
  ctx.lineWidth = 15 * scale;
  ctx.beginPath();
  routePoints.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  routePoints.forEach((point, index) => {
    const isCompleted = index < state.index;
    const isCorrectFlash = index === state.correctFlashIndex && state.correctFlashTimer > 0;
    const flashProgress = isCorrectFlash ? state.correctFlashTimer / 0.72 : 0;
    const pulse = Math.sin((1 - flashProgress) * Math.PI);
    
    if (flashProgress > 0) {
      ctx.save();
      ctx.globalAlpha = flashProgress * 0.8;
      ctx.strokeStyle = "#16c784";
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.arc(point.x, point.y, (11 + (1 - flashProgress) * 18) * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.fillStyle = flashProgress > 0 ? "#43d17a" : isCompleted ? "#dff7ea" : "#ffffff";
    ctx.strokeStyle = route.color;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(point.x, point.y, (6 + pulse * 5) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  state.sheet.forEach((token, index) => {
    const point = routePoints[index];
    const [dx, dy] = labelOffset(index, point, route, logicalWidth, logicalHeight, scale);
    drawToken(ctx, token, point.x + dx, point.y + dy, index, state, scale);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = "#15304a";
  ctx.font = `800 ${28 * scale}px system-ui`;
  ctx.fillText(route.title, 20 * scale, 40 * scale);
  ctx.fillStyle = "#63738a";
  ctx.font = `700 ${16 * scale}px system-ui`;
  ctx.fillText(route.note, 20 * scale, 65 * scale);
}
