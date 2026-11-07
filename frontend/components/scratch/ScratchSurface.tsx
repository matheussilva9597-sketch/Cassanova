'use client';

import { PointerEvent, ReactNode, useEffect, useRef } from 'react';

const SCRATCH_RADIUS = 28;
const REVEAL_THRESHOLD = 0.6;
const ALPHA_SAMPLE_STEP = 4;

interface ScratchSurfaceProps {
  children: ReactNode;
  resetKey: number;
  onRevealed: () => void;
}

interface Point {
  x: number;
  y: number;
}

function paintCover(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.globalCompositeOperation = 'source-over';
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#d4d4d8');
  gradient.addColorStop(0.5, '#a1a1aa');
  gradient.addColorStop(1, '#e4e4e7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#27272a';
  ctx.font = `bold ${Math.round(height * 0.14)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RASPE AQUI', width / 2, height / 2);
}

function scratchStroke(ctx: CanvasRenderingContext2D, from: Point, to: Point) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineWidth = SCRATCH_RADIUS * 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function isMostlyScratched(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): boolean {
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let cleared = 0;
  let sampled = 0;
  for (let i = 3; i < data.length; i += 4 * ALPHA_SAMPLE_STEP) {
    sampled += 1;
    if (data[i] === 0) cleared += 1;
  }
  return sampled > 0 && cleared / sampled >= REVEAL_THRESHOLD;
}

function getPoint(event: PointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export default function ScratchSurface({ children, resetKey, onRevealed }: ScratchSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isScratchingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const revealedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCover(ctx, width, height);
    revealedRef.current = false;
  }, [resetKey]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (revealedRef.current) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    isScratchingRef.current = true;
    const point = getPoint(event);
    lastPointRef.current = point;
    scratchStroke(ctx, point, point);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const last = lastPointRef.current;
    if (!isScratchingRef.current || !last) return;
    const ctx = event.currentTarget.getContext('2d');
    if (!ctx) return;
    const point = getPoint(event);
    scratchStroke(ctx, last, point);
    lastPointRef.current = point;
  };

  const handlePointerEnd = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isScratchingRef.current) return;
    isScratchingRef.current = false;
    lastPointRef.current = null;

    const canvas = event.currentTarget;
    const ctx = canvas.getContext('2d');
    if (!ctx || revealedRef.current || !isMostlyScratched(canvas, ctx)) return;

    revealedRef.current = true;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    onRevealed();
  };

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0">{children}</div>
      <canvas
        ref={canvasRef}
        aria-label="Área para raspar"
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      />
    </div>
  );
}
