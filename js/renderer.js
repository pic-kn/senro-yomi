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

export function getRoutePoints(route) {
  const count = route.stations.length;
  if (route.layout === "loop") {
    return route.stations.map((_, index) => {
      const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
      return {
        x: 560 + Math.cos(angle) * 285,
        y: 310 + Math.sin(angle) * 145,
      };
    });
  }

  if (route.layout === "horizontal") {
    return route.stations.map((_, index) => {
      const t = count === 1 ? 0 : index / (count - 1);
      return {
        x: 150 + t * 690,
        y: 310 + Math.sin((t - 0.1) * Math.PI * 2) * 46,
      };
    });
  }

  return route.stations.map((_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return {
      x: 650 - t * 210,
      y: 116 + t * 355,
    };
  });
}

function labelOffset(index, point, route) {
  if (route.layout === "horizontal") {
    return index % 2 === 0 ? [0, -52] : [0, 52];
  }

  if (route.layout === "vertical") {
    const side = index % 2 === 0 ? -1 : 1;
    return [side * 132, index % 2 === 0 ? -3 : 8];
  }

  const dx = point.x - 560;
  const dy = point.y - 310;
  const length = Math.hypot(dx, dy) || 1;
  return [(dx / length) * 110, (dy / length) * 54];
}

export function splitKana(kana) {
  if (kana.length <= 8) return [kana];
  const midpoint = Math.ceil(kana.length / 2);
  return [kana.slice(0, midpoint), kana.slice(midpoint)];
}

function drawToken(ctx, token, x, y, index, state) {
  const completed = state.mode === "finished" && index < state.index;
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
  ctx.font = `800 ${kanaLines.length > 1 ? 11 : 15}px 'Hiragino Sans', system-ui, sans-serif`;
  if (kanaLines.length > 1) {
    ctx.fillText(kanaLines[0], x, y - 1);
    ctx.fillText(kanaLines[1], x, y + 13);
  } else {
    ctx.fillText(kanaLines[0], x, y + 5);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function renderCanvas(ctx, canvas, state, route, assets) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const routePoints = getRoutePoints(route);

  if (assets && assets.background && assets.background.complete) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.drawImage(assets.background, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  roundedRect(ctx, 30, 35, 900, 470, 22);
  ctx.fill();

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
    const isCompleted = index < state.index;
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

  ctx.textAlign = "left";
  ctx.fillStyle = "#15304a";
  ctx.font = "800 28px system-ui";
  ctx.fillText(route.title, 58, 80);
  ctx.fillStyle = "#63738a";
  ctx.font = "700 16px system-ui";
  ctx.fillText(route.note, 58, 110);
}
