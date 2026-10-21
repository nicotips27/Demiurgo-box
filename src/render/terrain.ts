/**
 * Terrain rendering.
 *
 * Every terrain type is a 16x16 pixel-art tile taken from the world atlas
 * (`assets/world-atlas.png`). Variants are picked with a deterministic hash
 * so the ground looks varied but never flickers.
 *
 * The terrain is drawn in three layers per tile:
 *   1. the ground tile
 *   2. the prop that belongs to the terrain (tree, rock, gem, fire)
 *   3. climate tints (snow, ash) on top
 */
import { TILE_SIZE } from '../core/constants.ts';
import { TerrainType, TerrainType as TERRAIN } from '../core/types.ts';
import { drawAtlasTile, variant } from './atlas.ts';
import { G } from '../core/state.ts';
import type { Tile } from '../entities/Tile.ts';

/** A soft contact shadow under a prop. */
function shadow(ctx: CanvasRenderingContext2D, px: number, py: number, rx: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(px + TILE_SIZE / 2, py + TILE_SIZE - 2, rx, rx * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Fire is drawn procedurally so it can flicker. */
function drawFire(ctx: CanvasRenderingContext2D, px: number, py: number, time: number): void {
  ctx.fillStyle = '#3E2723';
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  const f1 = Math.sin(time / 80) > 0;
  const f2 = Math.cos(time / 60) > 0;
  const h = TILE_SIZE;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = f1 ? '#FF6F00' : '#E65100';
  ctx.beginPath();
  ctx.moveTo(px + 2, py + h);
  ctx.bezierCurveTo(px + 2, py + h * 0.6, px + h * 0.5, py + h * 0.1, px + h * 0.5, py + 1);
  ctx.bezierCurveTo(px + h * 0.75, py + h * 0.1, px + h - 2, py + h * 0.6, px + h - 2, py + h);
  ctx.fill();
  ctx.fillStyle = f2 ? '#FFEB3B' : '#FF8F00';
  ctx.beginPath();
  ctx.moveTo(px + 5, py + h);
  ctx.bezierCurveTo(px + 5, py + h * 0.8, px + h * 0.55, py + h * 0.35, px + h * 0.55, py + h * 0.25);
  ctx.bezierCurveTo(px + h * 0.7, py + h * 0.35, px + h - 5, py + h * 0.8, px + h - 5, py + h);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,200,0.5)';
  ctx.beginPath();
  ctx.moveTo(px + 8, py + h);
  ctx.bezierCurveTo(px + 8, py + h * 0.8, px + h * 0.55, py + h * 0.55, px + h * 0.55, py + h * 0.4);
  ctx.bezierCurveTo(px + h * 0.55, py + h * 0.55, px + h - 8, py + h * 0.8, px + h - 8, py + h);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Round off the corners of the land where it meets the water diagonally.
 *
 * Without this the coastline is a hard staircase of 16px squares. Super
 * WorldBox draws its islands with rounded corners, and the difference is
 * most of what makes a world look hand-made rather than generated.
 *
 * The rule is the simple one: when both orthogonal neighbours of a corner
 * are water, the corner of the land is cut back with a quarter disc, and the
 * water of the neighbour is drawn into the gap. The cut is clipped to this
 * tile, so the diagonal neighbour is never touched.
 */
function drawBlobCorners(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  x: number,
  y: number,
  waterFrame: string,
): void {
  if (tile.type === TERRAIN.WATER || tile.type === TERRAIN.FIRE) return;

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const radius = TILE_SIZE * 0.5;

  const typeAt = (dx: number, dy: number): TerrainType => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= G.cols || ny < 0 || ny >= G.rows) return TerrainType.WATER;
    return G.grid[nx][ny].type;
  };
  const isWater = (t: TerrainType) => t === TerrainType.WATER;

  // [orthogonal A, orthogonal B, diagonal, corner point, arc start, arc end]
  const corners: Array<[number, number, number, number, number, number, number, number, number, number]> = [
    // NE
    [1, 0, 0, 1, 1, 1, px + TILE_SIZE, py, -Math.PI / 2, 0],
    // NW
    [-1, 0, 0, 1, -1, 1, px, py, Math.PI, Math.PI * 1.5],
    // SE
    [1, 0, 0, -1, 1, -1, px + TILE_SIZE, py + TILE_SIZE, 0, Math.PI / 2],
    // SW
    [-1, 0, 0, -1, -1, -1, px, py + TILE_SIZE, Math.PI / 2, Math.PI],
  ];

  for (const [ax, ay, bx, by, dx, dy, cx, cy, a0, a1] of corners) {
    if (!isWater(typeAt(ax, ay)) || !isWater(typeAt(bx, by))) continue;

    ctx.save();
    // Clip to this tile first, so the diagonal neighbour is untouched.
    ctx.beginPath();
    ctx.rect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.clip();
    // Then to the quarter disc at the corner.
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.closePath();
    ctx.clip();
    // Fill with the water of the neighbour, so the sea runs on unbroken.
    drawAtlasTile(ctx, waterFrame, (x + ax) * TILE_SIZE, (y + ay) * TILE_SIZE);
    ctx.restore();
  }
}

/**
 * Draw the ground and the prop of a single tile.
 * `time` is the animation clock in milliseconds.
 */
export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  x: number,
  y: number,
  time: number,
): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const waterFrame = `water.${Math.floor(time / 480) % 4}`;

  switch (tile.type) {
    case TERRAIN.WATER: {
      const frame = Math.floor(time / 480) % 4;
      if (!drawAtlasTile(ctx, `water.${frame}`, px, py)) {
        ctx.fillStyle = '#1565C0';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }      // A faint moving highlight so the sea never looks static.
      const t1 = Math.sin((x * 0.8 + y * 0.4) + time / 700) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(180,220,255,${0.04 + t1 * 0.05})`;
      ctx.fillRect(px, py + 3 + t1 * 5, TILE_SIZE, 1);
      break;
    }
    case TERRAIN.SAND: {
      if (!drawAtlasTile(ctx, variant('sand', x, y)!, px, py)) {
        ctx.fillStyle = '#D4A843';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      break;
    }
    case TERRAIN.GRASS: {
      if (!drawAtlasTile(ctx, variant('grass', x, y)!, px, py)) {
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      break;
    }
    case TERRAIN.FOREST: {
      // The forest floor is grass; the trees are the prop.
      if (!drawAtlasTile(ctx, variant('grass', x, y, 1)!, px, py)) {
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      // A tree, anchored so it stands on this tile.
      const kind = (x * 3 + y * 7) % 11 === 0 ? 'tree.red'
        : (x * 5 + y * 3) % 17 === 0 ? 'tree.orange'
        : 'tree.green';
      shadow(ctx, px, py, 5);
      drawAtlasTile(ctx, kind, px - TILE_SIZE / 2, py - TILE_SIZE, TILE_SIZE * 2);
      break;
    }
    case TERRAIN.IRON: {
      if (!drawAtlasTile(ctx, variant('stone', x, y)!, px, py)) {
        ctx.fillStyle = '#546E7A';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      shadow(ctx, px, py, 4.5);
      drawAtlasTile(ctx, variant('rock', x, y)!, px + 1, py + 1);
      break;
    }
    case TERRAIN.GOLD: {
      if (!drawAtlasTile(ctx, variant('stone', x, y, 2)!, px, py)) {
        ctx.fillStyle = '#5D4E00';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
      shadow(ctx, px, py, 4);
      drawAtlasTile(ctx, variant('gem', x, y) ?? 'gem.gold', px + 2, py + 2);
      // Gold shimmer.
      const gs = Math.sin(time / 300 + x * 0.7 + y * 0.5);
      ctx.fillStyle = `rgba(255,255,150,${0.08 + gs * 0.12})`;
      ctx.beginPath();
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case TERRAIN.FIRE: {
      drawFire(ctx, px, py, time);
      break;
    }
    default: {
      ctx.fillStyle = '#388E3C';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  // Berry bushes.
  if (tile.hasBerries && !tile.hasHouse) {
    shadow(ctx, px, py, 3.5);
    drawAtlasTile(ctx, variant('mushroom', x, y) ?? 'mushroom.3', px + 2, py + 3);
  }

  // Round the corners where the land meets the water.
  drawBlobCorners(ctx, tile, x, y, waterFrame);
}

/**
 * Climate tint drawn over the finished ground layer.
 * Cold climates wash the ground out to snow, volcanic ones add ash.
 */
export function drawClimateTint(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  x: number,
  y: number,
  climate: string,
): void {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  if (climate === 'cold' && tile.type !== TERRAIN.WATER) {
    ctx.fillStyle = 'rgba(226,238,248,0.55)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  } else if (climate === 'volcanic_climate' && tile.type === TERRAIN.GRASS) {
    ctx.fillStyle = 'rgba(60,30,15,0.35)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  } else if (climate === 'plague' && tile.type === TERRAIN.GRASS) {
    ctx.fillStyle = 'rgba(70,120,50,0.3)';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
  }
}
