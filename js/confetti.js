let particles = [];
let animationId = null;
let canvas = null;
let ctx = null;

const colors = ['#fde047', '#38bdf8', '#34d399', '#fb7185', '#a78bfa', '#fb923c'];

class Particle {
  constructor(canvasWidth, canvasHeight) {
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight - canvasHeight;
    this.w = Math.random() * 12 + 6;
    this.h = Math.random() * 12 + 6;
    this.vx = Math.random() * 6 - 3;
    this.vy = Math.random() * 6 + 3;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.angle = Math.random() * 360;
    this.va = Math.random() * 12 - 6;
  }

  update(canvasWidth, canvasHeight) {
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.va;
    
    // ひらひら揺れる動き
    this.vx += Math.sin(this.angle * 0.05) * 0.3;
    
    // 画面下部に到達したら上から再配置（フェーズ1）
    if (this.y > canvasHeight) {
      this.y = -20;
      this.x = Math.random() * canvasWidth;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.angle * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

export function fireConfetti(durationMs = 4000) {
  if (!canvas) {
    canvas = document.getElementById('confettiCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    
    let logicalWidth = 0;
    let logicalHeight = 0;
    const resize = () => {
      logicalWidth = canvas.offsetWidth;
      logicalHeight = canvas.offsetHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', resize);
    resize();
  }

  const lw = canvas.offsetWidth;
  const lh = canvas.offsetHeight;
  particles = [];
  for (let i = 0; i < 180; i++) {
    particles.push(new Particle(lw, lh));
  }

  const startTime = performance.now();

  function loop(now) {
    const lw = canvas.offsetWidth;
    const lh = canvas.offsetHeight;
    ctx.clearRect(0, 0, lw, lh);
    
    const timePassed = now - startTime;
    
    if (timePassed > durationMs) {
      particles = particles.filter(p => p.y < lh);
    }

    particles.forEach(p => {
      p.update(lw, lh);
      p.draw(ctx);
    });

    if (particles.length > 0) {
      animationId = requestAnimationFrame(loop);
    } else {
      ctx.clearRect(0, 0, lw, lh);
      animationId = null;
    }
  }

  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

export function stopConfetti() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  particles = [];
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }
}
