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

// 画面サイズに基づいたページごとのS字（ジグザグ）マトリックス配置
export function getRoutePoints(route, logicalWidth, logicalHeight) {
  const count = route.stations.length;
  
  // 画面上部のHUDやタイトル部分を避けるため、上マージンは大きめ
  const marginX = Math.max(40, logicalWidth * 0.15);
  const marginTop = Math.max(120, logicalHeight * 0.2); 
  const marginBottom = Math.max(60, logicalHeight * 0.1);
  
  const areaW = logicalWidth - marginX * 2;
  const areaH = logicalHeight - marginTop - marginBottom;
  
  // 1セルに必要な最低ピクセルサイズ（文字ラベルや丸が重ならない程度）
  const minCellW = 130;
  const minCellH = 90;
  
  let cols = Math.max(1, Math.floor(areaW / minCellW));
  let rows = Math.max(2, Math.floor(areaH / minCellH));
  
  // 広すぎる画面でも見やすさを維持するため最大数を制限
  if (cols > 4) cols = 4;
  if (rows > 5) rows = 5;
  
  const pageSize = cols * rows;
  
  const cellW = cols > 1 ? areaW / (cols - 1) : 0;
  const cellH = rows > 1 ? areaH / (rows - 1) : 0;
  
  return route.stations.map((_, index) => {
    const p = Math.floor(index / pageSize);
    const idxInPage = index % pageSize;
    
    const r = Math.floor(idxInPage / cols);
    let c;
    if (r % 2 === 0) {
      // 偶数行は左から右
      c = idxInPage % cols;
    } else {
      // 奇数行は右から左
      c = cols - 1 - (idxInPage % cols);
    }
    
    // ページ番号 * logicalWidth を足すことで、横にページを並べる
    const x = (cols === 1 ? logicalWidth / 2 : marginX + c * cellW) + p * logicalWidth;
    const y = marginTop + r * cellH;
    
    return { x, y, page: p };
  });
}

function labelOffset(index, point, route, scale) {
  // グリッド配置なので、駅名ラベルは常に駅の少し上に固定
  return [0, -42 * scale]; 
}

export function splitKana(kana) {
  if (kana.length <= 8) return [kana];
  const midpoint = Math.ceil(kana.length / 2);
  return [kana.slice(0, midpoint), kana.slice(midpoint)];
}

function drawToken(ctx, token, x, y, index, state, scale) {
  const completed = state.mode === "finished" || index < state.index;
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
    // 背景は固定（スクロールさせない）
    ctx.drawImage(assets.background, dx, dy, dw, dh);
    ctx.restore();
  }

  const baseSize = Math.min(logicalWidth, logicalHeight);
  // スマホなどの狭い画面では文字や丸のスケールを少し落とす
  const scale = Math.max(0.65, Math.min(1.1, baseSize / 540));
  const routePoints = getRoutePoints(route, logicalWidth, logicalHeight);

  ctx.save();
  // ページ切り替え用のカメラスクロール（横方向）
  ctx.translate(-state.cameraX, 0);

  // ルートの線（ページをまたぐ線も描かれる）
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
    const isCompleted = state.mode === "finished" || index < state.index;
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
    const [dx, dy] = labelOffset(index, point, route, scale);
    drawToken(ctx, token, point.x + dx, point.y + dy, index, state, scale);
  });

  ctx.restore();

  // ルートのタイトル等はスクロールさせないため、translateの外側で描画
  ctx.textAlign = "left";
  ctx.fillStyle = "#15304a";
  ctx.font = `800 ${28 * scale}px system-ui`;
  ctx.fillText(route.title, 20 * scale, 40 * scale);
  ctx.fillStyle = "#63738a";
  ctx.font = `700 ${16 * scale}px system-ui`;
  ctx.fillText(route.note, 20 * scale, 65 * scale);
}
