import { G } from '../core/state.ts';
import { ctx, view } from '../core/dom.ts';
import { TILE_SIZE, LEGACY_TILE, ART_SCALE } from '../core/constants.ts';
import { TerrainType as TERRAIN } from '../core/types.ts';
import { TERRAIN_COLORS as COLORS } from '../core/constants.ts';
import { BuildingType as BLD } from '../core/types.ts';
import { drawTerrain, drawClimateTint } from './terrain.ts';
import { updateMinimapViewbox } from './minimap.ts';
import { AudioSystem } from '../audio/sfx.ts';
import { spawnParticles, spawnFloatingText } from '../systems/particles.ts';
export function drawWorld() {
    if (!G.grid || G.grid.length === 0) return; 
    ctx.fillStyle = '#0a0e1a'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.save(); ctx.translate(G.camX, G.camY); ctx.scale(G.zoom, G.zoom);

    let time = Date.now();
    let startCol = Math.max(0, Math.floor((-G.camX / G.zoom) / TILE_SIZE)); let endCol = Math.min(G.cols, Math.ceil(((-G.camX + view.w) / G.zoom) / TILE_SIZE));
    let startRow = Math.max(0, Math.floor((-G.camY / G.zoom) / TILE_SIZE)); let endRow = Math.min(G.rows, Math.ceil(((-G.camY + view.h) / G.zoom) / TILE_SIZE));

    for (let x = startCol; x < endCol; x++) { for (let y = startRow; y < endRow; y++) {
        let tile = G.grid[x][y]; let px = x * TILE_SIZE; let py = y * TILE_SIZE;

        // Ground tile and its prop, straight from the pixel-art atlas
        drawTerrain(ctx, tile, x, y, time);
        drawClimateTint(ctx, tile, x, y, G.currentClimate);

        // Roads — wider, textured, age-based
        if(tile.hasRoad && tile.type !== TERRAIN.WATER) { 
            let age = tile.ownerId ? (G.villages.find(v=>v.id===tile.ownerId)?.age || 1) : 1;
            let isTradeRoute = !!tile.tradeRoute;
            // Trade routes glow golden; normal roads use age-based colors
            let roadBase  = isTradeRoute ? '#C8A84B' : (age >= 3 ? '#9E7C5A' : (age === 2 ? '#A1887F' : '#C4A882'));
            let roadEdge  = isTradeRoute ? '#8B6914' : (age >= 3 ? '#7B5E3A' : (age === 2 ? '#8D6E63' : '#B0916A'));
            let roadCenter= isTradeRoute ? '#FFD700' : (age >= 3 ? '#B8956A' : (age === 2 ? '#BCAAA4' : '#D4B88A'));
            let rw = isTradeRoute ? 9 : (age >= 3 ? 8 : (age === 2 ? 7 : 6));
            let ro = Math.floor((TILE_SIZE - rw) / 2);

            // Base road color
            ctx.fillStyle = roadBase;
            ctx.fillRect(px + ro, py + ro, rw, rw);

            // Connect to neighbors
            let cL = x>0 && (G.grid[x-1][y].hasRoad || G.grid[x-1][y].hasHouse);
            let cR = x<G.cols-1 && (G.grid[x+1][y].hasRoad || G.grid[x+1][y].hasHouse);
            let cU = y>0 && (G.grid[x][y-1].hasRoad || G.grid[x][y-1].hasHouse);
            let cD = y<G.rows-1 && (G.grid[x][y+1].hasRoad || G.grid[x][y+1].hasHouse);

            if (cL) { ctx.fillStyle = roadBase; ctx.fillRect(px, py+ro, ro, rw); ctx.fillStyle = roadEdge; ctx.fillRect(px, py+ro, ro, 1); ctx.fillRect(px, py+ro+rw-1, ro, 1); }
            if (cR) { ctx.fillStyle = roadBase; ctx.fillRect(px+ro+rw, py+ro, ro, rw); ctx.fillStyle = roadEdge; ctx.fillRect(px+ro+rw, py+ro, ro, 1); ctx.fillRect(px+ro+rw, py+ro+rw-1, ro, 1); }
            if (cU) { ctx.fillStyle = roadBase; ctx.fillRect(px+ro, py, rw, ro); ctx.fillStyle = roadEdge; ctx.fillRect(px+ro, py, 1, ro); ctx.fillRect(px+ro+rw-1, py, 1, ro); }
            if (cD) { ctx.fillStyle = roadBase; ctx.fillRect(px+ro, py+ro+rw, rw, ro); ctx.fillStyle = roadEdge; ctx.fillRect(px+ro, py+ro+rw, 1, ro); ctx.fillRect(px+ro+rw-1, py+ro+rw, 1, ro); }

            // Center highlight stripe
            ctx.fillStyle = roadCenter + '80';
            if (cL || cR) ctx.fillRect(px + (cL?0:ro), py+ro+1, TILE_SIZE-(cL?0:ro)-(cR?0:ro), 2);
            if (cU || cD) ctx.fillRect(px+ro+1, py+(cU?0:ro), 2, TILE_SIZE-(cU?0:ro)-(cD?0:ro));

            // Trade route: animated golden shimmer pulse
            if(isTradeRoute) {
                let pulse = Math.sin(time/400 + x*0.3 + y*0.3) * 0.5 + 0.5;
                ctx.fillStyle = `rgba(255,220,80,${0.08 + pulse*0.12})`;
                ctx.fillRect(px+ro-1, py+ro-1, rw+2, rw+2);
            }

            // Age 2+: cobblestone texture dots
            if (age >= 2 && G.zoom > 1.0) {
                ctx.fillStyle = roadEdge + 'AA';
                for(let ci=0; ci<3; ci++) {
                    let dotX = px + ro + 1 + ((x*3+y*5+ci*7)%Math.max(1,rw-2));
                    let dotY = py + ro + 1 + ((x*7+y*3+ci*11)%Math.max(1,rw-2));
                    ctx.fillRect(dotX, dotY, 1, 1);
                }
            }

            // Age 3: side paving stones outline
            if (age >= 3 && G.zoom > 1.2) {
                ctx.strokeStyle = roadEdge + '60'; ctx.lineWidth = 0.5;
                ctx.strokeRect(px+ro+0.5, py+ro+0.5, rw-1, rw-1);
            }
        }
    }}

    // The buildings are drawn in the legacy 20px space and scaled down.
    ctx.save(); ctx.scale(ART_SCALE, ART_SCALE);
    for (let x = startCol; x < endCol; x++) { for (let y = startRow; y < endRow; y++) {
        let tile = G.grid[x][y]; let px = x * LEGACY_TILE; let py = y * LEGACY_TILE;
        if(tile.hasHouse) {
            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(px+10, py+18, 9, 3, 0, 0, Math.PI*2); ctx.fill();
            let v = G.villages.find(v => v.id === tile.ownerId); let color = v ? v.color : '#90A4AE'; let age = v ? v.age : 1;

            // Age-based palette
            let bWall = age === 1 ? '#8D6E63' : (age === 2 ? '#78909C' : '#ECEFF1');
            let bRoof = age === 1 ? '#BF360C' : (age === 2 ? '#1A237E' : '#1565C0');
            let bDet  = age === 1 ? '#5D4037' : (age === 2 ? '#607D8B' : '#FDD835');

            if(tile.isTownHall && tile.buildingType !== BLD.BONFIRE) {
                if (age === 1) {
                    // Stone age Town Hall - large wooden hall
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px+1, py+5, 18, 15); // foundation
                    ctx.fillStyle = bWall; ctx.fillRect(px+2, py+7, 16, 12);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+2, py+7, 2, 12); ctx.fillRect(px+7, py+7, 2, 12); ctx.fillRect(px+12, py+7, 2, 12); ctx.fillRect(px+16, py+7, 2, 12); // planks
                    ctx.fillStyle = bRoof; ctx.beginPath(); ctx.moveTo(px+10, py+1); ctx.lineTo(px-1, py+7); ctx.lineTo(px+21, py+7); ctx.fill();
                    ctx.fillStyle = '#D84315'; ctx.beginPath(); ctx.moveTo(px+10, py+3); ctx.lineTo(px+1, py+7); ctx.lineTo(px+19, py+7); ctx.fill(); // roof highlight
                    ctx.fillStyle = '#FDD835'; ctx.fillRect(px+8, py+13, 4, 6); // door
                    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px+10, py+4, 3, 0, Math.PI*2); ctx.fill(); // emblem
                } else if (age === 2) {
                    // Iron age - fortified stone keep
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+0, py+4, 5, 16); ctx.fillRect(px+15, py+4, 5, 16); // towers
                    ctx.fillStyle = bWall; ctx.fillRect(px+3, py+8, 14, 12);
                    ctx.fillStyle = bDet; ctx.fillRect(px+0, py+2, 5, 2); ctx.fillRect(px+2, py+0, 1, 4); ctx.fillRect(px+4, py+0, 1, 4); // battlements left
                    ctx.fillRect(px+15, py+2, 5, 2); ctx.fillRect(px+15, py+0, 1, 4); ctx.fillRect(px+19, py+0, 1, 4); // battlements right
                    ctx.fillStyle = bRoof; ctx.beginPath(); ctx.moveTo(px+3, py+8); ctx.lineTo(px+10, py+2); ctx.lineTo(px+17, py+8); ctx.fill();
                    ctx.fillStyle = '#B71C1C'; ctx.fillRect(px+8, py+3, 4, 6); // tower on top
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+8, py+14, 4, 6); // door
                    ctx.fillStyle = color; ctx.fillRect(px+6, py+9, 8, 3); // banner
                } else {
                    // Golden age - domed cathedral
                    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+2, py+7, 16, 13);
                    ctx.fillStyle = '#CFD8DC'; ctx.fillRect(px+2, py+7, 2, 13); ctx.fillRect(px+7, py+7, 2, 13); ctx.fillRect(px+11, py+7, 2, 13); ctx.fillRect(px+16, py+7, 2, 13);
                    ctx.fillStyle = '#1565C0'; ctx.beginPath(); ctx.arc(px+10, py+7, 8, Math.PI, 0); ctx.fill();
                    ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(px+10, py+7, 6, Math.PI, 0); ctx.fill();
                    ctx.fillStyle = '#FDD835'; ctx.beginPath(); ctx.arc(px+10, py+1, 3, 0, Math.PI*2); ctx.fill(); // dome top
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+8, py+14, 4, 6);
                    ctx.fillStyle = color; ctx.fillRect(px+7, py+9, 6, 2);
                }
                if (G.selectedVillageId === tile.ownerId) { 
                    ctx.strokeStyle = '#FDD835'; ctx.lineWidth = 2.5 / G.zoom; 
                    ctx.shadowColor = '#FDD835'; ctx.shadowBlur = 6 / G.zoom;
                    ctx.strokeRect(px-2, py-2, TILE_SIZE+4, TILE_SIZE+4); 
                    ctx.shadowBlur = 0;
                }
            } else if(tile.buildingType === BLD.BONFIRE) {
                // Improved bonfire - nacimiento de la cultura
                ctx.fillStyle = '#4E342E'; ctx.beginPath(); ctx.arc(px+10, py+16, 5, 0, Math.PI*2); ctx.fill(); // stone ring
                ctx.fillStyle = '#3E2723'; ctx.fillRect(px+7, py+13, 2, 4); ctx.fillRect(px+11, py+13, 2, 4); // logs
                ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+6, py+12, 8, 2);
                let ft = time / 80; let f1 = Math.sin(ft + x) > 0; let f2 = Math.cos(ft*1.3 + y) > 0;
                ctx.fillStyle = f1 ? '#FF6F00' : '#E65100'; 
                ctx.beginPath(); ctx.moveTo(px+7, py+13); ctx.quadraticCurveTo(px+8, py+8, px+10, py+5); ctx.quadraticCurveTo(px+12, py+8, px+13, py+13); ctx.fill();
                ctx.fillStyle = f2 ? '#FFCC02' : '#FF8F00'; 
                ctx.beginPath(); ctx.moveTo(px+8, py+13); ctx.quadraticCurveTo(px+9, py+9, px+10, py+7); ctx.quadraticCurveTo(px+11, py+9, px+12, py+13); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,200,0.8)'; ctx.beginPath(); ctx.arc(px+10, py+10, 1.5, 0, Math.PI*2); ctx.fill();
            } else if(tile.buildingType === BLD.WINDMILL) {
                // Windmill - nacimiento de granjas
                ctx.fillStyle = bDet; ctx.fillRect(px+2, py+18, 16, 2); // base
                ctx.fillStyle = bWall; ctx.beginPath(); ctx.moveTo(px+6, py+18); ctx.lineTo(px+14, py+18); ctx.lineTo(px+12, py+5); ctx.lineTo(px+8, py+5); ctx.fill();
                ctx.fillStyle = bRoof; ctx.beginPath(); ctx.moveTo(px+5, py+5); ctx.lineTo(px+10, py+1); ctx.lineTo(px+15, py+5); ctx.fill();
                ctx.save(); ctx.translate(px+10, py+8); ctx.rotate(time/400); 
                ctx.fillStyle = age >= 2 ? '#ECEFF1' : '#D7CCC8'; 
                ctx.fillRect(-9, -1, 18, 2); ctx.fillRect(-1, -9, 2, 18); 
                ctx.fillStyle = age >= 2 ? 'rgba(200,220,255,0.4)' : 'rgba(180,150,100,0.4)';
                ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(-2,-4); ctx.lineTo(0,0); ctx.fill();
                ctx.beginPath(); ctx.moveTo(9,0); ctx.lineTo(2,4); ctx.lineTo(0,0); ctx.fill();
                ctx.restore();
                ctx.fillStyle = '#795548'; ctx.fillRect(px+8, py+14, 4, 5); // door
            } else if(tile.buildingType === BLD.WATCHTOWER) {
                ctx.fillStyle = bDet; ctx.fillRect(px+3, py+10, 3, 10); ctx.fillRect(px+14, py+10, 3, 10); // supports
                ctx.fillStyle = '#263238'; ctx.fillRect(px+1, py+1, 18, 9); // platform
                ctx.fillStyle = bWall; ctx.fillRect(px+3, py+3, 14, 7);
                // Battlements
                ctx.fillStyle = bRoof; ctx.fillRect(px+1, py+1, 18, 2); 
                for(let bb=1; bb<18; bb+=4) { ctx.fillRect(px+bb, py-1, 2, 3); }
                // Arrow slot
                ctx.fillStyle = '#263238'; ctx.fillRect(px+9, py+4, 2, 4);
            } else if(tile.buildingType === BLD.WELL) {
                ctx.fillStyle = bDet; ctx.fillRect(px+3, py+5, 3, 14); ctx.fillRect(px+14, py+5, 3, 14); // posts
                ctx.fillStyle = bRoof; ctx.fillRect(px+1, py+4, 18, 2); // beam
                ctx.fillStyle = bWall; ctx.beginPath(); ctx.ellipse(px+10, py+14, 7, 4, 0, 0, Math.PI*2); ctx.fill(); // well
                ctx.fillStyle = '#1565C0'; ctx.beginPath(); ctx.ellipse(px+10, py+14, 5, 3, 0, 0, Math.PI*2); ctx.fill(); // water
                ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.ellipse(px+10, py+13, 3, 1.5, 0, 0, Math.PI*2); ctx.fill(); // water highlight
                ctx.strokeStyle = bDet; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px+10, py+4, 3, Math.PI, 0); ctx.stroke(); // rope roller
            } else if(tile.buildingType === BLD.TEMPLE) {
                ctx.fillStyle = '#FDD835'; ctx.fillRect(px+0, py+17, 20, 3); // steps
                ctx.fillStyle = bWall; ctx.fillRect(px+2, py+8, 16, 9);
                // Columns
                for(let col=3; col<=16; col+=4) { ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+col, py+8, 2, 9); }
                ctx.fillStyle = '#F9A825'; ctx.beginPath(); ctx.moveTo(px+0, py+8); ctx.lineTo(px+10, py+1); ctx.lineTo(px+20, py+8); ctx.fill(); // pediment
                ctx.fillStyle = '#FDD835'; ctx.fillRect(px+0, py+7, 20, 1); // entablature
                if (age === 3) { ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.arc(px+10, py+4, 3, 0, Math.PI*2); ctx.fill(); } // divine eye
            } else if(tile.buildingType === BLD.HOUSE) {
                let hl = tile.houseLevel; let hw = 10 + (hl*2), hh = 8 + (hl*2); let hx = px + 10 - hw/2, hy = py + 20 - hh;
                // Foundation / plinth
                ctx.fillStyle = age >= 2 ? '#607D8B' : '#5D4037'; ctx.fillRect(hx-1, hy+hh-1, hw+2, 3);
                // Wall
                ctx.fillStyle = bWall; ctx.fillRect(hx, hy, hw, hh);
                // Wall texture lines (age 2 = bricks, age 1 = wood planks)
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                if(age === 1) { for(let bx=hx+2; bx<hx+hw-1; bx+=3) ctx.fillRect(bx, hy+1, 1, hh-2); }
                else if(age >= 2) { for(let by=hy+3; by<hy+hh-1; by+=3) { ctx.fillRect(hx+1, by, hw-2, 1); } }
                // Roof
                let roofH = 4 + hl;
                ctx.fillStyle = bRoof; ctx.beginPath(); ctx.moveTo(px+10, hy-roofH); ctx.lineTo(hx-2, hy); ctx.lineTo(hx+hw+2, hy); ctx.fill();
                // Roof highlight (lighter top edge)
                ctx.fillStyle = age === 1 ? '#D84315' : (age === 2 ? '#283593' : '#1565C0');
                ctx.beginPath(); ctx.moveTo(px+10, hy-roofH); ctx.lineTo(hx, hy); ctx.lineTo(px+10, hy-roofH+2); ctx.fill();
                // Door with frame
                ctx.fillStyle = bDet; ctx.fillRect(px+7, hy+hh-5, 6, 5);
                ctx.fillStyle = '#1A1A2E'; ctx.fillRect(px+8, hy+hh-5, 4, 4);
                // Door handle dot
                ctx.fillStyle = age >= 2 ? '#FFD700' : '#8B6914';
                ctx.beginPath(); ctx.arc(px+11, hy+hh-3, 0.7, 0, Math.PI*2); ctx.fill();
                // Windows (all ages show windows at level 2+, age 2+ glow)
                if(hl >= 2 || age >= 2) {
                    let winGlow = age === 3 ? '#FFF59D' : (age === 2 ? '#FFF9C4' : '#FFE082');
                    ctx.fillStyle = winGlow; ctx.fillRect(hx+2, hy+2, 3, 3); ctx.fillRect(hx+hw-5, hy+2, 3, 3);
                    // Window cross
                    ctx.fillStyle = bDet + 'AA'; ctx.fillRect(hx+3, hy+2, 1, 3); ctx.fillRect(hx+hw-4, hy+2, 1, 3);
                    if(age === 3) {
                        // Golden-age window glow halo
                        ctx.fillStyle = 'rgba(255,240,100,0.25)'; ctx.beginPath(); ctx.arc(hx+3, hy+3, 4, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.arc(hx+hw-4, hy+3, 4, 0, Math.PI*2); ctx.fill();
                    }
                }
                // Chimneys (age 2+, level 2+)
                if(age >= 2 && hl >= 2) {
                    ctx.fillStyle = '#546E7A'; ctx.fillRect(hx+1, hy-roofH+1, 2, roofH+1); ctx.fillRect(hx+hw-3, hy-roofH+1, 2, roofH+1);
                    // Smoke puff (animated)
                    let sp = (time/500 + x*0.3) % 1;
                    ctx.fillStyle = `rgba(180,180,180,${0.4 - sp*0.4})`;
                    ctx.beginPath(); ctx.arc(hx+2, hy-roofH - sp*4, 1.5+sp*2, 0, Math.PI*2); ctx.fill();
                }
                // Level 3: decorative trim on roof edge
                if(hl === 3 && age >= 2) {
                    ctx.fillStyle = bDet; ctx.fillRect(hx-2, hy, hw+4, 2);
                }
            } else if(tile.buildingType === BLD.FARM) {
                ctx.fillStyle = '#6D4C1E'; ctx.fillRect(px+1, py+1, 18, 18); // dark soil
                // Furrows (plow lines)
                ctx.fillStyle = '#5D3A10'; for(let fy=3; fy<19; fy+=4) ctx.fillRect(px+2, py+fy, 16, 1);
                // Crop rows with growth animation
                let cropColor = age === 3 ? '#66BB6A' : (age === 2 ? '#C6D82A' : '#FF7043');
                let cropH = Math.min(3, 1 + Math.floor(((G.timeTick + x*7 + y*11) % 120) / 40));
                for(let row=3; row<18; row+=4) { 
                    ctx.fillStyle = cropColor; ctx.fillRect(px+2, py+row, 16, 2);
                    ctx.fillStyle = '#2E7D32';
                    for(let pl=3; pl<17; pl+=3) { ctx.fillRect(px+pl, py+row-cropH, 1, cropH); }
                }
                // Fence posts and rails
                ctx.fillStyle = '#8D6E63'; 
                ctx.fillRect(px+0, py+0, 2, 20); ctx.fillRect(px+18, py+0, 2, 20);
                ctx.fillRect(px+0, py+0, 20, 2); ctx.fillRect(px+0, py+18, 20, 2);
                // Age 2+: scarecrow
                if (age >= 2) {
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(px+14, py+4, 1, 6); // pole
                    ctx.fillStyle = '#FF9800'; ctx.fillRect(px+12, py+4, 5, 1); // cross
                    ctx.fillStyle = '#FFA726'; ctx.beginPath(); ctx.arc(px+14, py+3, 2, 0, Math.PI*2); ctx.fill(); // head
                }
                // Age 3: irrigation channel
                if (age === 3) {
                    ctx.fillStyle = '#1565C0'; ctx.fillRect(px+9, py+2, 2, 16);
                }
            } else if(tile.buildingType === BLD.MINE) { 
                if(age === 1) {
                    // Edad 1: Mina primitiva - agujero en el suelo con escalera de madera
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px+3, py+10, 14, 10); // dirt pit
                    ctx.fillStyle = '#3E2723'; ctx.beginPath(); ctx.ellipse(px+10, py+10, 7, 3, 0, 0, Math.PI*2); ctx.fill(); // pit entrance
                    ctx.fillStyle = '#212121'; ctx.beginPath(); ctx.ellipse(px+10, py+10, 5, 2, 0, 0, Math.PI*2); ctx.fill(); // dark inside
                    // Timber posts
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+5, py+7, 2, 7); ctx.fillRect(px+13, py+7, 2, 7);
                    ctx.fillRect(px+4, py+7, 12, 2); // lintel
                    // Ladder
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(px+9, py+10, 2, 8);
                    ctx.fillStyle = '#4E342E'; for(let rg=12; rg<19; rg+=3) ctx.fillRect(px+8, py+rg, 4, 1);
                    // Rock pile outside
                    ctx.fillStyle = '#78909C'; ctx.beginPath(); ctx.arc(px+3, py+16, 3, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = '#546E7A'; ctx.beginPath(); ctx.arc(px+4, py+18, 2, 0, Math.PI*2); ctx.fill();
                } else if(age === 2) {
                    // Edad 2: Mina de hierro con estructura de madera y vagoneta
                    ctx.fillStyle = '#546E7A'; ctx.beginPath(); ctx.moveTo(px+2, py+19); ctx.lineTo(px+9, py+5); ctx.lineTo(px+11, py+5); ctx.lineTo(px+18, py+19); ctx.fill(); // mountain
                    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.moveTo(px+6, py+19); ctx.lineTo(px+10, py+9); ctx.lineTo(px+14, py+19); ctx.fill(); // shadow
                    // Mine entrance reinforced
                    ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(px+10, py+16, 4, Math.PI, 0); ctx.fill();
                    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1.5; ctx.strokeRect(px+6, py+12, 8, 4); // frame
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(px+5, py+12, 2, 7); ctx.fillRect(px+13, py+12, 2, 7);
                    ctx.fillRect(px+4, py+12, 12, 2); // lintel
                    // Minecart rails
                    ctx.strokeStyle = '#B0BEC5'; ctx.lineWidth = 1; 
                    ctx.beginPath(); ctx.moveTo(px+3, py+19); ctx.lineTo(px+17, py+19); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(px+3, py+18); ctx.lineTo(px+17, py+18); ctx.stroke();
                    for(let sl=4; sl<17; sl+=4) { ctx.beginPath(); ctx.moveTo(px+sl, py+17); ctx.lineTo(px+sl, py+20); ctx.stroke(); }
                    // Lantern
                    ctx.fillStyle = '#FF8F00'; ctx.beginPath(); ctx.arc(px+10, py+14, 1.5, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = 'rgba(255,140,0,0.3)'; ctx.beginPath(); ctx.arc(px+10, py+14, 3, 0, Math.PI*2); ctx.fill();
                } else {
                    // Edad 3: Mina industrial - elevador de vapor y estructura metálica
                    ctx.fillStyle = '#455A64'; ctx.beginPath(); ctx.moveTo(px+1, py+19); ctx.lineTo(px+8, py+3); ctx.lineTo(px+12, py+3); ctx.lineTo(px+19, py+19); ctx.fill(); // mountain
                    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.moveTo(px+5, py+19); ctx.lineTo(px+10, py+7); ctx.lineTo(px+15, py+19); ctx.fill(); // deep shadow
                    // Steel frame
                    ctx.strokeStyle = '#607D8B'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(px+6, py+3); ctx.lineTo(px+6, py+14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(px+14, py+3); ctx.lineTo(px+14, py+14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(px+4, py+8); ctx.lineTo(px+16, py+8); ctx.stroke();
                    // Pulley wheel (animated)
                    ctx.save(); ctx.translate(px+10, py+3); ctx.rotate(time/200);
                    ctx.strokeStyle = '#B0BEC5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(3,0); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0,-3); ctx.lineTo(0,3); ctx.stroke();
                    ctx.restore();
                    // Gold/ore cart below
                    ctx.fillStyle = '#B0BEC5'; ctx.fillRect(px+7, py+15, 6, 4);
                    ctx.fillStyle = '#FDD835'; ctx.fillRect(px+8, py+14, 4, 2); // ore in cart
                    // Steam puff
                    let sp2 = (time/300 + x*0.2) % 1;
                    ctx.fillStyle = `rgba(200,200,210,${0.5 - sp2*0.5})`;
                    ctx.beginPath(); ctx.arc(px+4, py+6 - sp2*5, 2+sp2*2, 0, Math.PI*2); ctx.fill();
                }
            } else if(tile.buildingType === BLD.BARRACKS) {
                if(age === 1) {
                    // Edad 1: Campo de entrenamiento primitivo - empalizada de madera
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px+1, py+1, 18, 18); // ground
                    // Empalizada (puntiaguda)
                    ctx.fillStyle = '#5D4037';
                    for(let ep=1; ep<19; ep+=3) { ctx.beginPath(); ctx.moveTo(px+ep, py+1); ctx.lineTo(px+ep+1, py+1); ctx.lineTo(px+ep+1, py+7); ctx.lineTo(px+ep+1.5, py+5); ctx.lineTo(px+ep+2.5, py+7); ctx.lineTo(px+ep+2.5, py+1); ctx.fill(); }
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px+1, py+7, 18, 12); // barracks wall
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+1, py+7, 18, 2); // log top
                    // Gate
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px+7, py+13, 6, 6);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+6, py+12, 8, 2); // gate beam
                    // Weapon rack
                    ctx.fillStyle = '#90A4AE'; ctx.fillRect(px+3, py+9, 1, 4); ctx.fillRect(px+5, py+9, 1, 4); ctx.fillRect(px+4, py+9, 1, 1); // spears
                    // Flag
                    ctx.fillStyle = '#D84315'; ctx.fillRect(px+15, py+0, 1, 7);
                    ctx.fillStyle = color; ctx.fillRect(px+16, py+0, 4, 4);
                } else if(age === 2) {
                    // Edad 2: Cuartel de piedra - armería con torres
                    ctx.fillStyle = '#546E7A'; ctx.fillRect(px+0, py+6, 20, 14); // main building
                    ctx.fillStyle = '#455A64'; ctx.fillRect(px+0, py+5, 20, 2); // top bar
                    // Corner towers
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+0, py+2, 5, 16); ctx.fillRect(px+15, py+2, 5, 16);
                    // Tower battlements
                    ctx.fillStyle = '#455A64';
                    ctx.fillRect(px+0, py+0, 2, 4); ctx.fillRect(px+3, py+0, 2, 4);
                    ctx.fillRect(px+15, py+0, 2, 4); ctx.fillRect(px+18, py+0, 2, 4);
                    // Arched gate
                    ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(px+10, py+14, 4, Math.PI, 0); ctx.fill(); ctx.fillRect(px+6, py+14, 8, 6);
                    ctx.strokeStyle = '#37474F'; ctx.lineWidth = 1; ctx.strokeRect(px+5, py+10, 10, 10); // portcullis frame
                    // Iron door bars
                    ctx.strokeStyle = '#546E7A'; ctx.lineWidth = 1;
                    for(let bar=7; bar<13; bar+=2) { ctx.beginPath(); ctx.moveTo(px+bar, py+10); ctx.lineTo(px+bar, py+20); ctx.stroke(); }
                    // Banner
                    ctx.fillStyle = '#B71C1C'; ctx.fillRect(px+9, py+0, 2, 6);
                    ctx.fillStyle = color; ctx.fillRect(px+11, py+0, 5, 4);
                    // Shields on towers
                    ctx.fillStyle = '#90A4AE'; ctx.beginPath(); ctx.arc(px+2, py+12, 2.5, 0, Math.PI*2); ctx.fill();
                    ctx.fillStyle = color+'AA'; ctx.beginPath(); ctx.arc(px+2, py+12, 1.5, 0, Math.PI*2); ctx.fill();
                } else {
                    // Edad 3: Fortaleza militar con torres de vigilancia y cañones
                    ctx.fillStyle = '#607D8B'; ctx.fillRect(px+2, py+5, 16, 15); // main building
                    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+2, py+4, 16, 2); // cornice
                    // Flanking towers (taller)
                    ctx.fillStyle = '#455A64'; ctx.fillRect(px+0, py+0, 6, 18); ctx.fillRect(px+14, py+0, 6, 18);
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+0, py+0, 6, 3); ctx.fillRect(px+14, py+0, 6, 3); // parapet
                    // Cannon muzzles on towers
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px-1, py+8, 4, 2); ctx.fillRect(px+17, py+8, 4, 2);
                    // Gate with drawbridge frame
                    ctx.fillStyle = '#1A1A1A'; ctx.fillRect(px+7, py+12, 6, 8);
                    ctx.strokeStyle = '#FDD835'; ctx.lineWidth = 1; ctx.strokeRect(px+6, py+10, 8, 10);
                    // Central flag pole
                    ctx.fillStyle = '#263238'; ctx.fillRect(px+9, py+0, 2, 6);
                    ctx.fillStyle = color; ctx.fillRect(px+11, py+0, 6, 4);
                    // Decorative crown on building
                    ctx.fillStyle = '#FDD835'; ctx.fillRect(px+3, py+4, 14, 1);
                }
            } else if(tile.buildingType === BLD.WALL) { 
                if(age === 1) {
                    // Edad 1: Empalizada de madera
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px, py+12, 20, 8); // earth base
                    ctx.fillStyle = '#5D4037';
                    let stakeW = 3;
                    for(let sk=0; sk<20; sk+=stakeW+1) {
                        let h = 8 + (sk%2)*3;
                        ctx.beginPath(); ctx.moveTo(px+sk, py+20); ctx.lineTo(px+sk, py+12-h); ctx.lineTo(px+sk+1, py+10-h); ctx.lineTo(px+sk+stakeW, py+12-h); ctx.lineTo(px+sk+stakeW, py+20); ctx.fill();
                    }
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px, py+12, 20, 2); // rope binding
                } else if(age === 2) {
                    // Edad 2: Muro de piedra con almenas
                    ctx.fillStyle = '#546E7A'; ctx.fillRect(px+0, py+8, 20, 12); // stone base
                    // Stone block pattern
                    ctx.fillStyle = '#607D8B'; ctx.fillRect(px+0, py+8, 10, 5); ctx.fillRect(px+10, py+13, 10, 7);
                    ctx.fillStyle = '#455A64'; ctx.fillRect(px+0, py+8, 20, 1); ctx.fillRect(px+0, py+12, 20, 1); ctx.fillRect(px+0, py+16, 20, 1);
                    ctx.fillRect(px+4, py+9, 1, 6); ctx.fillRect(px+10, py+9, 1, 7); ctx.fillRect(px+16, py+9, 1, 6);
                    // Almenas uniformes
                    ctx.fillStyle = '#546E7A';
                    for(let bm=0; bm<=14; bm+=6) { ctx.fillRect(px+bm, py+2, 4, 7); }
                    ctx.fillStyle = '#455A64';
                    for(let bm=0; bm<=14; bm+=6) { ctx.fillRect(px+bm, py+7, 4, 1); }
                } else {
                    // Edad 3: Muralla de granito con troneras y parapeto
                    ctx.fillStyle = '#607D8B'; ctx.fillRect(px+0, py+7, 20, 13); // thick stone
                    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+0, py+6, 20, 2); // top highlight
                    // Granite block texture
                    ctx.fillStyle = '#546E7A';
                    ctx.fillRect(px+0, py+7, 20, 1); ctx.fillRect(px+0, py+11, 20, 1); ctx.fillRect(px+0, py+15, 20, 1);
                    ctx.fillRect(px+5, py+8, 1, 9); ctx.fillRect(px+10, py+8, 1, 9); ctx.fillRect(px+15, py+8, 1, 9);
                    // Arrow slots (troneras)
                    ctx.fillStyle = '#1A1A1A';
                    ctx.fillRect(px+3, py+9, 2, 4); ctx.fillRect(px+8, py+9, 2, 4); ctx.fillRect(px+13, py+9, 2, 4); ctx.fillRect(px+17, py+9, 2, 4);
                    // Thick crenellations
                    ctx.fillStyle = '#607D8B';
                    for(let bm=0; bm<=12; bm+=7) { ctx.fillRect(px+bm, py+0, 5, 8); }
                    ctx.fillStyle = '#455A64';
                    for(let bm=0; bm<=12; bm+=7) { ctx.fillRect(px+bm, py+6, 5, 2); }
                }
            } else if(tile.buildingType === BLD.DOCK) { 
                if(age === 1) {
                    // Edad 1: Muelle de troncos - pesca básica
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px+1, py+10, 18, 10); // water edge
                    ctx.fillStyle = '#1565C0'; ctx.fillRect(px+1, py+13, 18, 7); // water
                    ctx.fillStyle = '#42A5F5'; ctx.beginPath(); ctx.ellipse(px+10, py+13, 9, 2, 0, 0, Math.PI*2); ctx.fill(); // waterline
                    // Simple dock from trunks
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(px+5, py+10, 3, 10); ctx.fillRect(px+12, py+10, 3, 10);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+3, py+5, 14, 6); // platform
                    // Small raft
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(px+6, py+14, 8, 3);
                } else if(age === 2) {
                    // Edad 2: Puerto de madera con almacén y velero
                    ctx.fillStyle = '#1565C0'; ctx.fillRect(px+0, py+12, 20, 8); // water
                    ctx.fillStyle = '#42A5F5'; for(let wv=0; wv<20; wv+=4) { ctx.beginPath(); ctx.arc(px+wv+2, py+14+(Math.sin(time/200+wv)*1), 3, 0, Math.PI); ctx.stroke(); }
                    // Dock platform
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px+3, py+5, 14, 8);
                    ctx.fillStyle = '#5D4037'; for(let plk=4; plk<17; plk+=3) ctx.fillRect(px+plk, py+5, 2, 8);
                    // Dock posts
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px+4, py+10, 2, 10); ctx.fillRect(px+14, py+10, 2, 10);
                    // Warehouse back
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+4, py+1, 12, 5);
                    ctx.fillStyle = '#8D6E63'; ctx.beginPath(); ctx.moveTo(px+3, py+1); ctx.lineTo(px+10, py-2); ctx.lineTo(px+17, py+1); ctx.fill();
                    // Sailboat
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+2, py+13, 8, 4); // hull
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(px+5, py+10, 1, 4); // mast
                    ctx.fillStyle = '#ECEFF1'; ctx.beginPath(); ctx.moveTo(px+6, py+10); ctx.lineTo(px+10, py+12); ctx.lineTo(px+6, py+14); ctx.fill(); // sail
                } else {
                    // Edad 3: Puerto imperial con grúas y varios barcos
                    ctx.fillStyle = '#0D47A1'; ctx.fillRect(px+0, py+11, 20, 9); // deep water
                    ctx.fillStyle = '#1565C0'; ctx.fillRect(px+0, py+11, 20, 2); // surface
                    // Stone quay
                    ctx.fillStyle = '#607D8B'; ctx.fillRect(px+0, py+4, 20, 8);
                    ctx.fillStyle = '#546E7A'; ctx.fillRect(px+0, py+4, 20, 1); ctx.fillRect(px+0, py+7, 20, 1);
                    // Crane arm (animated)
                    ctx.save(); ctx.translate(px+3, py+2); ctx.rotate(Math.sin(time/600)*0.2);
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(-1, 0, 2, 8);
                    ctx.strokeStyle = '#8D6E63'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 4); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(6, 8); ctx.stroke();
                    ctx.restore();
                    // Harbor building
                    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+8, py+0, 12, 5);
                    ctx.fillStyle = '#1565C0'; ctx.beginPath(); ctx.moveTo(px+8, py+0); ctx.lineTo(px+14, py-2); ctx.lineTo(px+20, py+0); ctx.fill();
                    // Two ships
                    ctx.fillStyle = '#5D4037'; ctx.beginPath(); ctx.moveTo(px+0, py+15); ctx.lineTo(px+9, py+14); ctx.lineTo(px+9, py+19); ctx.lineTo(px+0, py+19); ctx.fill(); // hull1
                    ctx.fillStyle = '#4E342E'; ctx.fillRect(px+3, py+11, 1, 5);
                    ctx.fillStyle = '#ECEFF1'; ctx.beginPath(); ctx.moveTo(px+4, py+11); ctx.lineTo(px+8, py+13); ctx.lineTo(px+4, py+15); ctx.fill(); // sail1
                }
            } else if(tile.buildingType === BLD.MARKET) { 
                if(age === 1) {
                    // Edad 1: Mercado primitivo - puesto de trueque
                    ctx.fillStyle = '#3E2723'; ctx.fillRect(px+1, py+12, 18, 8); // ground
                    // Simple wooden stall
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+3, py+5, 14, 8); // canopy frame
                    ctx.fillStyle = '#FF7043'; // rough cloth canopy
                    ctx.beginPath(); ctx.moveTo(px+2, py+9); ctx.lineTo(px+10, py+3); ctx.lineTo(px+18, py+9); ctx.fill();
                    // Scalloped edge
                    for(let sc=2; sc<18; sc+=4) { ctx.beginPath(); ctx.arc(px+sc+2, py+9, 2, 0, Math.PI); ctx.fill(); }
                    // Goods on counter
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(px+2, py+10, 16, 3); // counter
                    ctx.fillStyle = '#4CAF50'; ctx.fillRect(px+4, py+8, 3, 3); ctx.fillStyle = '#FF5722'; ctx.fillRect(px+8, py+8, 2, 3); ctx.fillStyle = '#FFC107'; ctx.fillRect(px+11, py+8, 3, 3);
                    // Support posts
                    ctx.fillStyle = '#5D4037'; ctx.fillRect(px+2, py+5, 2, 15); ctx.fillRect(px+16, py+5, 2, 15);
                } else if(age === 2) {
                    // Edad 2: Tienda de mercado con tejado a dos aguas
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(px+2, py+9, 16, 11); // building
                    ctx.fillStyle = '#795548'; ctx.fillRect(px+2, py+9, 16, 2); // awning base
                    // Pitched roof
                    ctx.fillStyle = '#B71C1C';
                    ctx.beginPath(); ctx.moveTo(px+10, py+2); ctx.lineTo(px+0, py+9); ctx.lineTo(px+20, py+9); ctx.fill();
                    ctx.fillStyle = '#C62828';
                    ctx.beginPath(); ctx.moveTo(px+10, py+2); ctx.lineTo(px+2, py+9); ctx.fill(); // left slope highlight
                    // Sign board
                    ctx.fillStyle = '#F9A825'; ctx.fillRect(px+5, py+3, 10, 5);
                    ctx.fillStyle = '#E65100'; ctx.fillRect(px+6, py+4, 8, 3);
                    // Market stalls visible through door
                    ctx.fillStyle = '#37474F'; ctx.fillRect(px+8, py+15, 4, 5); // door
                    // Window
                    ctx.fillStyle = '#FFF59D'; ctx.fillRect(px+3, py+11, 4, 4); ctx.fillRect(px+13, py+11, 4, 4);
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(px+4, py+13, 2, 1); ctx.fillRect(px+14, py+13, 2, 1); // window cross
                } else {
                    // Edad 3: Emporio comercial con columnas y cúpula
                    ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+1, py+7, 18, 13); // grand building
                    ctx.fillStyle = '#CFD8DC'; ctx.fillRect(px+1, py+7, 18, 2); // base
                    // Classical columns
                    ctx.fillStyle = '#F5F5F5';
                    for(let col=3; col<=16; col+=4) { 
                        ctx.fillRect(px+col, py+7, 2, 10); 
                        ctx.fillStyle = '#ECEFF1'; ctx.fillRect(px+col, py+7, 2, 1); ctx.fillRect(px+col, py+15, 2, 2); // capital and base
                        ctx.fillStyle = '#F5F5F5';
                    }
                    // Arched roof / pediment
                    ctx.fillStyle = '#7B1FA2';
                    ctx.beginPath(); ctx.moveTo(px+0, py+7); ctx.lineTo(px+10, py+0); ctx.lineTo(px+20, py+7); ctx.fill();
                    // Decorative frieze
                    ctx.fillStyle = '#FDD835'; ctx.fillRect(px+0, py+6, 20, 1);
                    // Central door
                    ctx.fillStyle = '#37474F'; ctx.beginPath(); ctx.arc(px+10, py+14, 3, Math.PI, 0); ctx.fill(); ctx.fillRect(px+7, py+14, 6, 6);
                    // Goods crates outside
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(px+0, py+16, 4, 4); ctx.fillRect(px+16, py+16, 4, 4);
                    ctx.fillStyle = '#FDD835'; ctx.fillRect(px+1, py+15, 2, 2); ctx.fillRect(px+17, py+15, 2, 2); // gold coins pile
                }
            }
        }
        // Territory overlay
        if(tile.ownerId) { 
            let v = G.villages.find(v => v.id === tile.ownerId); 
            if(v) { 
                ctx.fillStyle = v.color + '12'; ctx.fillRect(px, py, LEGACY_TILE, LEGACY_TILE); 
                // Corner dots for territory markers
                ctx.fillStyle = v.color + '70'; 
                ctx.fillRect(px, py, 2, 2); ctx.fillRect(px+LEGACY_TILE-2, py, 2, 2); 
                ctx.fillRect(px, py+LEGACY_TILE-2, 2, 2); ctx.fillRect(px+LEGACY_TILE-2, py+LEGACY_TILE-2, 2, 2); 
            } 
        }
    }}
    ctx.restore();

    // Renderizar Peces — PIXEL ART
    for (let i = 0; i < G.fishes.length; i++) {
        let f = G.fishes[i]; if(f.x < startCol-2 || f.x > endCol+2 || f.y < startRow-2 || f.y > endRow+2) continue; 
        let fpx = Math.round(f.x*TILE_SIZE + TILE_SIZE/2), fpy = Math.round(f.y*TILE_SIZE + TILE_SIZE/2);
        let facingRight = f.vx >= 0;
        ctx.save(); ctx.translate(fpx, fpy); ctx.scale(ART_SCALE, ART_SCALE); if(!facingRight) ctx.scale(-1,1);
        // Cuerpo principal naranja
        ctx.fillStyle = '#E65100'; ctx.fillRect(-4, -2, 7, 4);
        // Vientre más claro
        ctx.fillStyle = '#FF8F00'; ctx.fillRect(-3, -1, 5, 2);
        // Cola (triángulo pixel)
        ctx.fillStyle = '#BF360C'; ctx.fillRect(-6, -3, 2, 2); ctx.fillRect(-7, -1, 2, 2); ctx.fillRect(-6, 1, 2, 2);
        // Ojo
        ctx.fillStyle = '#212121'; ctx.fillRect(2, -2, 2, 2);
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(2, -2, 1, 1);
        ctx.restore();
    }

    // Renderizar Animales — PIXEL ART
    for (let i = 0; i < G.animals.length; i++) {
        let a = G.animals[i]; if(a.x < startCol-2 || a.x > endCol+2 || a.y < startRow-2 || a.y > endRow+2) continue; 
        let apx = Math.round(a.x*TILE_SIZE + TILE_SIZE/2), apy = Math.round(a.y*TILE_SIZE + TILE_SIZE/2);
        let isMoving = Math.abs(a.vx) > 0.01 || Math.abs(a.vy) > 0.01;
        let legAnim = isMoving ? (Math.floor(time/120) % 2) : 0;
        ctx.save(); ctx.translate(apx, apy); ctx.scale(ART_SCALE, ART_SCALE); ctx.scale(a.dir, 1);
        if (a.type === 'sheep') {
            // Sombra
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-8, 6, 16, 2);
            // Patas
            ctx.fillStyle = '#9E9E9E';
            ctx.fillRect(-6, 2+legAnim, 2, 4); ctx.fillRect(-2, 2-(legAnim), 2, 4);
            ctx.fillRect(2, 2+legAnim, 2, 4); ctx.fillRect(6, 2-(legAnim), 2, 4);
            // Cuerpo lana (pixel bloque)
            ctx.fillStyle = '#F5F5F5'; ctx.fillRect(-7, -4, 14, 8);
            // Textura lana — píxeles alternos
            ctx.fillStyle = '#E0E0E0';
            for(let wx=-6; wx<7; wx+=2) { ctx.fillRect(wx, -4, 1, 2); ctx.fillRect(wx+1, 0, 1, 2); }
            // Cabeza
            ctx.fillStyle = '#BDBDBD'; ctx.fillRect(7, -3, 5, 5);
            // Ojo
            ctx.fillStyle = '#212121'; ctx.fillRect(10, -2, 1, 1);
            // Orejas
            ctx.fillStyle = '#EF9A9A'; ctx.fillRect(8, -5, 2, 2);
        } else {
            // Vaca — pixel art
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(-9, 7, 18, 2);
            // Patas
            ctx.fillStyle = '#6D4C41';
            ctx.fillRect(-7, 3+legAnim, 2, 5); ctx.fillRect(-3, 3-(legAnim), 2, 5);
            ctx.fillRect(3, 3+legAnim, 2, 5); ctx.fillRect(7, 3-(legAnim), 2, 5);
            // Cuerpo base
            ctx.fillStyle = '#8D6E63'; ctx.fillRect(-8, -5, 16, 9);
            // Manchas blancas (pixel)
            ctx.fillStyle = '#ECEFF1'; ctx.fillRect(-4, -4, 5, 4); ctx.fillRect(3, 0, 4, 3);
            // Cabeza
            ctx.fillStyle = '#795548'; ctx.fillRect(8, -4, 6, 5);
            // Hocico claro
            ctx.fillStyle = '#BCAAA4'; ctx.fillRect(11, -2, 3, 3);
            // Ojo
            ctx.fillStyle = '#212121'; ctx.fillRect(9, -3, 2, 2);
            // Cuernos
            ctx.fillStyle = '#F9A825'; ctx.fillRect(9, -6, 1, 2); ctx.fillRect(12, -6, 1, 2);
        }
        ctx.restore();
    }

    // Renderizar Humanos (greatly improved)
    for (let i = 0; i < G.humans.length; i++) {
        let h = G.humans[i]; if(h.x < startCol-2 || h.x > endCol+2 || h.y < startRow-2 || h.y > endRow+2) continue; 
        let px = h.x * TILE_SIZE; let py = h.y * TILE_SIZE;
        let isMoving = Math.abs(h.vx) > 0.01 || Math.abs(h.vy) > 0.01;
        // Per-NPC phase offset so they don't all bob in sync
        let phase = (i * 1.37 + h.x * 0.5 + h.y * 0.3);
        let walkCycle = isMoving ? Math.sin(time / 80 + phase) : 0;
        let bobbing = isMoving ? walkCycle * 2.2 : 0;
        let legSwing = walkCycle;
        // Idle breathing bob (very subtle)
        if (!isMoving) bobbing = Math.sin(time / 800 + phase) * 0.5;
        let skinColor = h.disease ? '#A5D6A7' : (h.isColonist ? '#FFCCBC' : '#FFCC80'); 
        let scale = h.age < 15 ? 0.7 : 1;
        let v = G.villages.find(vv => vv.id === h.villageId);

        ctx.save(); ctx.translate(px + TILE_SIZE/2, py + TILE_SIZE/2);
        ctx.scale(h.dir * scale * ART_SCALE, scale * ART_SCALE);
        ctx.translate(-10, -10);

        // Sombra pixel art
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(4, 17, 12, 3);

        if (h.state === 'FISH' && G.grid[Math.floor(h.x)] && G.grid[Math.floor(h.x)][Math.floor(h.y)]?.type === TERRAIN.WATER) {
            // Bote — PIXEL ART
            let bb = Math.round(Math.sin(time/300));
            ctx.fillStyle = '#5D4037'; ctx.fillRect(1, 9+bb, 18, 2); // proa
            ctx.fillStyle = '#6D4C41'; ctx.fillRect(2, 11+bb, 16, 4); // casco
            ctx.fillStyle = '#4E342E'; ctx.fillRect(1, 13+bb, 18, 2); // base
            // Cuerpo
            ctx.fillStyle = h.shirtColor; ctx.fillRect(8, 5+bb, 4, 5);
            // Mástil pixel
            ctx.fillStyle = '#4E342E'; ctx.fillRect(9, 0+bb, 2, 9);
            // Vela
            ctx.fillStyle = '#ECEFF1'; ctx.fillRect(11, 1+bb, 5, 6);
            ctx.fillStyle = '#CFD8DC'; ctx.fillRect(15, 1+bb, 1, 6);
            // Cabeza
            ctx.fillStyle = skinColor; ctx.fillRect(7, 1+bb, 6, 5);
            ctx.fillStyle = '#263238'; ctx.fillRect(10, 2+bb, 2, 2); // ojo
        } else {
            // Legs
            let legA = legSwing * 4, legB = -legSwing * 4;
            ctx.fillStyle = h.role === 'Guerrero' ? '#546E7A' : '#5D4037'; 
            ctx.fillRect(6, 13+bobbing + legA, 3, 5); // left leg
            ctx.fillRect(11, 13+bobbing + legB, 3, 5); // right leg

            // Shoes
            ctx.fillStyle = '#37474F';
            ctx.fillRect(5, 17+bobbing+legA, 4, 2);
            ctx.fillRect(10, 17+bobbing+legB, 4, 2);

            // Body / shirt
            ctx.fillStyle = h.isColonist ? '#E3F2FD' : h.shirtColor; 
            ctx.fillRect(5, 8+bobbing, 10, 6);
            // Body shading
            ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(5, 8+bobbing, 2, 6);

            // Arms — swing proportional to movement speed
            let speed = Math.sqrt(h.vx*h.vx + h.vy*h.vy);
            let armAngle = isMoving ? legSwing * Math.min(35, 15 + speed * 80) : 0;
            if (h.state === 'FIGHT') armAngle = Math.sin(time/30 + phase) * 40; // frantic fighting
            ctx.fillStyle = skinColor; 
            ctx.save(); ctx.translate(5, 10+bobbing); ctx.rotate(-armAngle * Math.PI/180); ctx.fillRect(-2, 0, 3, 5); ctx.restore();
            ctx.save(); ctx.translate(15, 10+bobbing); ctx.rotate(armAngle * Math.PI/180); ctx.fillRect(0, 0, 3, 5); ctx.restore();

            // Cabeza — PIXEL ART (bloque 6x6)
            let hby = Math.round(bobbing);
            ctx.fillStyle = skinColor; ctx.fillRect(7, 1+hby, 6, 6);
            // Pelo (parte superior)
            ctx.fillStyle = '#3E2723'; ctx.fillRect(7, 1+hby, 6, 2);
            // Ojos pixel
            ctx.fillStyle = '#263238'; ctx.fillRect(8, 4+hby, 2, 2); ctx.fillRect(12, 4+hby, 2, 2);
            // Highlight ojo
            ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(8, 4+hby, 1, 1); ctx.fillRect(12, 4+hby, 1, 1);

        // Disease glow pixel border
            if(h.disease) { ctx.strokeStyle = 'rgba(100,220,80,0.7)'; ctx.lineWidth = 1.5; ctx.strokeRect(5, 0+Math.round(bobbing), 12, 18); }
            // Medic healing glow
            if(h.state === 'HEAL') {
                ctx.strokeStyle = `rgba(46,204,113,${0.5 + Math.sin(time/100)*0.3})`;
                ctx.lineWidth = 1.5; ctx.strokeRect(1, -2+Math.round(bobbing), 18, 22);
            }

            // Hair/hat based on role
            if(h.role === 'Guerrero') {
                let age = v ? v.age : 1;
                ctx.fillStyle = age === 1 ? '#795548' : (age === 2 ? '#546E7A' : '#B0BEC5'); 
                ctx.fillRect(6, 1+bobbing, 8, 3); // helmet
                ctx.fillRect(5, 3+bobbing, 10, 2);
            } else if(h.role === 'Comerciante') {
                ctx.fillStyle = '#8D6E63'; ctx.fillRect(6, 1+bobbing, 8, 2); // hat brim
                ctx.fillStyle = '#6D4C41'; ctx.fillRect(7, -1+bobbing, 6, 3); // hat top
            } else if(h.role === 'Granjero') {
                ctx.fillStyle = '#F9A825'; ctx.beginPath(); ctx.ellipse(10, 2+bobbing, 6, 1.5, 0, 0, Math.PI*2); ctx.fill(); // straw hat
                ctx.fillStyle = '#F57F17'; ctx.fillRect(7, 0+bobbing, 6, 2);
            } else if(h.role === 'Médico') {
                ctx.fillStyle = '#E3F2FD'; ctx.fillRect(6, 0+bobbing, 8, 3); // white cap
                ctx.fillStyle = '#E53935'; ctx.fillRect(9, 0+bobbing, 2, 1); ctx.fillRect(9.5, -0.5+bobbing, 1, 2); // red cross
            } else if(h.isGeneral) {
                let age2 = v ? v.age : 1;
                ctx.fillStyle = age2 === 3 ? '#FDD835' : (age2 === 2 ? '#546E7A' : '#795548');
                ctx.fillRect(5, 1+bobbing, 10, 3); // general hat brim
                ctx.fillRect(7, -2+bobbing, 6, 4); // hat body
                ctx.fillStyle = '#FDD835'; ctx.fillRect(8, -1+bobbing, 4, 1); // gold stripe
            } else {
                ctx.fillStyle = '#3E2723'; ctx.fillRect(7, 1+bobbing, 6, 2); // basic hair
            }

            // TOOL / WEAPON rendering
            if(h.state === 'FIGHT' || (h.role === 'Guerrero' && isMoving)) {
                let age = v ? v.age : 1; 
                let swordBlade = age === 1 ? '#90A4AE' : (age === 2 ? '#ECEFF1' : '#FDD835'); 
                let swordHilt = age === 1 ? '#795548' : (age === 2 ? '#1565C0' : '#E65100');
                if (age >= 2) {
                    // === RIFLE / MACHINE GUN (Age 2+) ===
                    let gunColor = age === 2 ? '#546E7A' : '#37474F';
                    let stockColor = age === 2 ? '#5D4037' : '#4E342E';
                    let isShooting = h.state === 'FIGHT' && Math.sin(time / 30 + phase) > 0.6;
                    // Gun barrel
                    ctx.fillStyle = gunColor;
                    ctx.fillRect(14, 8+bobbing, 9, 2.5); // barrel
                    ctx.fillStyle = stockColor;
                    ctx.fillRect(13, 10+bobbing, 5, 3.5); // stock body
                    ctx.fillRect(14, 13+bobbing, 3, 2); // grip
                    // Barrel tip detail
                    ctx.fillStyle = '#263238';
                    ctx.fillRect(22, 7.5+bobbing, 1.5, 3.5);
                    // Age 3: scope on top
                    if (age === 3) {
                        ctx.fillStyle = '#1A237E';
                        ctx.fillRect(16, 6+bobbing, 5, 2);
                        ctx.fillStyle = '#42A5F5';
                        ctx.beginPath(); ctx.arc(18.5, 7+bobbing, 1, 0, Math.PI*2); ctx.fill();
                    }
                    // Muzzle flash when shooting
                    if (isShooting) {
                        ctx.globalAlpha = 0.85;
                        ctx.fillStyle = '#FFFF00';
                        ctx.beginPath(); ctx.arc(23.5, 9.5+bobbing, 3.5, 0, Math.PI*2); ctx.fill();
                        ctx.fillStyle = '#FF8800';
                        ctx.beginPath(); ctx.arc(23.5, 9.5+bobbing, 2, 0, Math.PI*2); ctx.fill();
                        // Flash spikes
                        for (let s = 0; s < 5; s++) {
                            let a = (s / 5) * Math.PI * 2 + time * 0.03;
                            ctx.fillStyle = '#FFD700';
                            ctx.save(); ctx.translate(23.5, 9.5+bobbing); ctx.rotate(a);
                            ctx.fillRect(0, -0.7, 5 + Math.random()*2, 1.4);
                            ctx.restore();
                        }
                        ctx.globalAlpha = 1;
                    }
                    // Shell casing ejection (when in FIGHT)
                    if (h.state === 'FIGHT' && Math.random() < 0.08) {
                        let ejX = h.x + 0.5, ejY = h.y + 0.5;
                        G.particles.push({
                            x: ejX, y: ejY, vx: (Math.random()-0.5)*0.08, vy: -0.1 - Math.random()*0.05,
                            life: 12, maxLife: 12, color: '#FFD700', size: 1.5,
                            update() { this.x+=this.vx; this.y+=this.vy; this.vy+=0.008; this.life--; },
                            draw(c){ c.globalAlpha=this.life/this.maxLife; c.fillStyle=this.color; c.fillRect(this.x*TILE_SIZE+10,this.y*TILE_SIZE+10,2,3); c.globalAlpha=1; }
                        });
                    }
                } else {
                    // === SWORD (Age 1) ===
                    ctx.fillStyle = swordHilt; ctx.fillRect(15, 8+bobbing, 3, 2); 
                    ctx.fillStyle = swordBlade; ctx.fillRect(17, 7+bobbing, 5, 1.5); 
                    ctx.fillStyle = swordHilt; ctx.fillRect(17, 9+bobbing, 2, 3); // crossguard shadow
                    // Shield
                    ctx.fillStyle = swordHilt; ctx.beginPath(); ctx.arc(3, 10+bobbing, 3, 0, Math.PI*2); ctx.fill(); 
                    ctx.fillStyle = swordBlade; ctx.beginPath(); ctx.arc(3, 10+bobbing, 1.5, 0, Math.PI*2); ctx.fill();
                }
            } else if(h.role === 'Comerciante') {
                // Pack/bag
                ctx.fillStyle = '#8D6E63'; ctx.fillRect(1, 7+bobbing, 4, 6); 
                ctx.fillStyle = '#A1887F'; ctx.fillRect(2, 8+bobbing, 2, 4);
            } else if(['GATHER', 'GATHER_IRON', 'GATHER_GOLD', 'BUILD', 'GATHER_FOOD', 'HUNT'].includes(h.state)) {
                let toolBob = (h.actionTimer > 0) ? Math.sin(time / 25) * 5 + bobbing : bobbing;
                let swingPhase = Math.sin(time / 25 + phase);
                let isWorking = h.actionTimer > 0;

                if (h.state === 'GATHER_FOOD') { 
                    // Basket con tapa
                    ctx.fillStyle = '#A1887F'; ctx.fillRect(15, 8+toolBob, 5, 5); 
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(16, 7+toolBob, 3, 2);
                    ctx.fillStyle = '#BCAAA4'; ctx.fillRect(15, 8+toolBob, 5, 1); // basket rim
                    if(isWorking) { // bayas cayendo
                        ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(17+swingPhase*2, 6+toolBob - Math.abs(swingPhase)*3, 1.5, 0, Math.PI*2); ctx.fill();
                    }
                } else if(h.state === 'GATHER') {
                    // Hacha con swing animado
                    let axeRot = isWorking ? swingPhase * 0.6 : 0;
                    ctx.save(); ctx.translate(16, 8+bobbing); ctx.rotate(axeRot);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(-1, 0, 2, 8); // handle
                    ctx.fillStyle = '#546E7A'; ctx.fillRect(-3, -1, 5, 3); // head
                    ctx.fillStyle = '#78909C'; ctx.fillRect(-2, -1, 3, 1); // edge highlight
                    ctx.restore();
                    if(isWorking) { // virutas de madera
                        ctx.fillStyle = '#8D6E63';
                        ctx.fillRect(17 + swingPhase*3, 5+bobbing, 2, 1);
                        ctx.fillRect(19 + swingPhase*2, 7+bobbing, 1, 2);
                    }
                } else if(h.state === 'BUILD') {
                    // Martillo con swing vertical
                    let hamRot = isWorking ? Math.abs(swingPhase) * 0.8 - 0.4 : 0;
                    ctx.save(); ctx.translate(15, 9+bobbing); ctx.rotate(hamRot);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(-1, 0, 2, 7);
                    ctx.fillStyle = '#607D8B'; ctx.fillRect(-3, -2, 6, 3);
                    ctx.fillStyle = '#78909C'; ctx.fillRect(-2, -2, 3, 1);
                    ctx.restore();
                    if(isWorking) { // polvo de construcción
                        ctx.fillStyle = `rgba(180,160,100,${0.4+swingPhase*0.3})`;
                        ctx.beginPath(); ctx.arc(18, 10+bobbing, 3+Math.abs(swingPhase)*2, 0, Math.PI*2); ctx.fill();
                    }
                } else if(h.state === 'GATHER_IRON' || h.state === 'GATHER_GOLD') {
                    // Pico con swing diagonal
                    let pickRot = isWorking ? swingPhase * 0.7 : 0;
                    ctx.save(); ctx.translate(15, 8+bobbing); ctx.rotate(pickRot);
                    ctx.fillStyle = '#6D4C41'; ctx.fillRect(-1, 0, 2, 7);
                    ctx.fillStyle = h.state === 'GATHER_GOLD' ? '#FDD835' : '#90A4AE';
                    ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(5, 0); ctx.lineTo(3, 3); ctx.fill();
                    ctx.restore();
                    if(isWorking) { // chispas
                        let sparkColor = h.state === 'GATHER_GOLD' ? '#FDD835' : '#CFD8DC';
                        for(let sp=0; sp<3; sp++) {
                            ctx.fillStyle = sparkColor;
                            ctx.beginPath(); ctx.arc(18+(sp-1)*3, 8+bobbing + Math.sin(time/15+sp)*4, 1, 0, Math.PI*2); ctx.fill();
                        }
                    }
                } else if(h.state === 'HUNT') {
                    // Arco y flecha
                    ctx.save(); ctx.translate(15, 9+bobbing);
                    ctx.strokeStyle = '#5D4037'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.arc(0, 0, 5, -0.8, 0.8); ctx.stroke(); // bow curve
                    ctx.strokeStyle = '#BDBDBD'; ctx.lineWidth = 0.8;
                    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke(); // bowstring
                    // Arrow
                    ctx.fillStyle = '#8D6E63'; ctx.fillRect(-8, -0.5, 8, 1);
                    ctx.fillStyle = '#90A4AE'; ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(2, 0); ctx.lineTo(0, 1); ctx.fill();
                    ctx.restore();
                }
            }

            // Colonist flag
            if(h.isColonist) {
                ctx.fillStyle = '#5D4037'; ctx.fillRect(15, 0+bobbing, 1, 8);
                ctx.fillStyle = '#FFEB3B'; ctx.fillRect(16, 0+bobbing, 4, 3);
            }
        }
        // HP bar (only when damaged)
        if(h.hp < h.maxHp) { 
            ctx.fillStyle = '#B71C1C'; ctx.fillRect(2, -6, 16, 2); 
            ctx.fillStyle = '#4CAF50'; ctx.fillRect(2, -6, 16 * (h.hp/h.maxHp), 2); 
            ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.5; ctx.strokeRect(2, -6, 16, 2);
        }
        // General aura - golden glow ring
        if(h.isGeneral) {
            ctx.strokeStyle = `rgba(255,215,0,${0.4 + Math.sin(time/200)*0.2})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(10, 8+bobbing, 10, 0, Math.PI*2); ctx.stroke();
            ctx.strokeStyle = `rgba(255,215,0,${0.1 + Math.sin(time/200)*0.1})`;
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(10, 8+bobbing, 11, 0, Math.PI*2); ctx.stroke();
        }
        // Hero aura — pulsating golden crown + star
        if(h.isHero) {
            let pulse = 0.6 + Math.sin(time/120)*0.4;
            ctx.strokeStyle = `rgba(255,220,0,${pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(10, 5+bobbing, 12, 0, Math.PI*2); ctx.stroke();
            ctx.fillStyle = `rgba(255,220,0,${pulse*0.15})`;
            ctx.beginPath(); ctx.arc(10, 5+bobbing, 12, 0, Math.PI*2); ctx.fill();
            // Star crown
            ctx.fillStyle = `rgba(255,220,0,${pulse})`;
            ctx.font = '8px serif'; ctx.textAlign = 'center';
            ctx.fillText('★', 10, -4+bobbing);
            if(h.heroDeeds > 0) {
                ctx.font = 'bold 5px sans-serif'; ctx.fillStyle = '#fff5cc';
                ctx.fillText('×'+h.heroDeeds, 10, -10+bobbing);
            }
        }
        // State icon above head (visible at zoom ≥ 1.2)
        if (G.zoom >= 1.2) {
            let stateIcon = null;
            if (h.state === 'BUILD') stateIcon = '🔨';
            else if (h.state === 'GATHER') stateIcon = '🪓';
            else if (h.state === 'GATHER_IRON') stateIcon = '⛏️';
            else if (h.state === 'GATHER_GOLD') stateIcon = '💛';
            else if (h.state === 'GATHER_FOOD') stateIcon = '🍓';
            else if (h.state === 'HUNT') stateIcon = '🏹';
            else if (h.state === 'FISH') stateIcon = '🎣';
            else if (h.state === 'TRADE') stateIcon = h.isScavenging ? '🛤️' : '💰';
            else if (h.state === 'HEAL') stateIcon = '💊';
            else if (h.state === 'FIGHT') { let vv = G.villages.find(vv=>vv.id===h.villageId); stateIcon = (vv && vv.age >= 2) ? '🔫' : '⚔️'; }
            else if (h.state === 'FLEE') stateIcon = '💨';
            else if (h.isColonist) stateIcon = '🚩';
            else if (h.isGeneral) stateIcon = '⭐';
            // Explorador fuera del territorio
            if (h.isScavenging && (h.state === 'GATHER' || h.state === 'GATHER_IRON' || h.state === 'GATHER_GOLD')) stateIcon = '🗺️';
            if (stateIcon) {
                ctx.font = `${Math.round(7/scale)}px serif`;
                ctx.textAlign = 'center';
                ctx.fillText(stateIcon, 10, -7 + (h.hp < h.maxHp ? -5 : 0));
            }
        }
        ctx.restore();
    }

    for (let i = 0; i < G.particles.length; i++) G.particles[i].draw(ctx);

    // Render bullets
    for (let i = 0; i < G.bullets.length; i++) {
        let b = G.bullets[i];
        // Trail
        if (b.trail.length > 1) {
            ctx.strokeStyle = b.color + '55';
            ctx.lineWidth = 1.5 / G.zoom;
            ctx.beginPath();
            ctx.moveTo(b.trail[0].x * TILE_SIZE + TILE_SIZE/2, b.trail[0].y * TILE_SIZE + TILE_SIZE/2);
            for (let t = 1; t < b.trail.length; t++) ctx.lineTo(b.trail[t].x * TILE_SIZE + TILE_SIZE/2, b.trail[t].y * TILE_SIZE + TILE_SIZE/2);
            ctx.stroke();
        }
        // Bullet head
        let alpha = Math.min(1, b.life / 4);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#FFFFAA';
        ctx.beginPath();
        ctx.arc(b.x * TILE_SIZE + TILE_SIZE/2, b.y * TILE_SIZE + TILE_SIZE/2, 2.5 / G.zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    // Render explosions
    for (let i = 0; i < G.explosions.length; i++) {
        let e = G.explosions[i];
        let alpha = e.life / e.maxLife;
        let r = e.radius * TILE_SIZE;
        let cx = e.x * TILE_SIZE + TILE_SIZE/2, cy = e.y * TILE_SIZE + TILE_SIZE/2;
        // Outer shockwave ring
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = '#FF8800';
        ctx.lineWidth = 3 / G.zoom;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2); ctx.stroke();
        // Core flash
        let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r + 5);
        grad.addColorStop(0, `rgba(255,255,200,${alpha * 0.9})`);
        grad.addColorStop(0.4, `rgba(255,140,0,${alpha * 0.7})`);
        grad.addColorStop(1, `rgba(80,20,0,0)`);
        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }
    for (let i = 0; i < G.floatingTexts.length; i++) G.floatingTexts[i].draw(ctx);

    // Dibujar cursor del pincel
    if (G.hoverTx >= 0 && G.hoverTx < G.cols && G.hoverTy >= 0 && G.hoverTy < G.rows && G.currentTool.type !== 'select' && G.currentTool.id !== 'SPAWN_VILLAGE') {
        let r = G.brushRadius;

        let strokeC = 'rgba(255, 255, 255, 0.4)';
        let fillC = 'rgba(255, 255, 255, 0.1)';

        if (G.currentTool.id === 'SMITE') { strokeC = 'rgba(231, 76, 60, 0.8)'; fillC = 'rgba(231, 76, 60, 0.2)'; }
        else if (G.currentTool.id === 'BLESS') { strokeC = 'rgba(46, 204, 113, 0.8)'; fillC = 'rgba(46, 204, 113, 0.2)'; }
        else if (G.currentTool.id === 'CURSE') { strokeC = 'rgba(155, 89, 182, 0.8)'; fillC = 'rgba(155, 89, 182, 0.2)'; }

        ctx.strokeStyle = strokeC; ctx.lineWidth = 2 / G.zoom;
        ctx.strokeRect((G.hoverTx - r) * TILE_SIZE, (G.hoverTy - r) * TILE_SIZE, ((r * 2) + 1) * TILE_SIZE, ((r * 2) + 1) * TILE_SIZE);
        ctx.fillStyle = fillC;
        ctx.fillRect((G.hoverTx - r) * TILE_SIZE, (G.hoverTy - r) * TILE_SIZE, ((r * 2) + 1) * TILE_SIZE, ((r * 2) + 1) * TILE_SIZE);
    }

    ctx.restore();

    // ── OVERLAY VISUAL DE CLIMA (en coordenadas de pantalla) ──────────
    if(G.gameState === 'PLAYING') {
        let W = view.w, H = view.h;
        // Lluvia tropical
        if(G.currentClimate === 'tropical' || G.currentClimate === 'stormy') {
            let rainAlpha = G.currentClimate === 'stormy' ? 0.5 : 0.25;
            ctx.strokeStyle = `rgba(150,200,255,${rainAlpha})`;
            ctx.lineWidth = 1;
            for(let i=0; i<(G.currentClimate==='stormy'?80:40); i++) {
                let rx = ((G.timeTick*3 + i*97)%W + i*31)%W;
                let ry = ((G.timeTick*5 + i*53)%H);
                ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx-3, ry+10); ctx.stroke();
            }
        }
        // Nieve / tundra
        if(G.currentClimate === 'cold') {
            ctx.fillStyle = 'rgba(220,240,255,0.7)';
            for(let i=0; i<60; i++) {
                let sx = ((G.timeTick + i*73)%W + i*37)%W;
                let sy = ((G.timeTick*0.8 + i*61)%H);
                let r = 1 + (i%3)*0.5;
                ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
            }
            // Tinte azul frío sobre el mundo
            ctx.fillStyle = 'rgba(180,220,255,0.07)';
            ctx.fillRect(0, 0, W, H);
        }
        // Ceniza volcánica
        if(G.currentClimate === 'volcanic_climate') {
            ctx.fillStyle = 'rgba(80,40,20,0.06)';
            ctx.fillRect(0,0,W,H);
            for(let i=0; i<30; i++) {
                let ax = ((G.timeTick*0.5 + i*89)%W);
                let ay = ((G.timeTick*0.3 + i*43)%H);
                ctx.fillStyle = `rgba(180,80,20,${0.2+Math.sin(G.timeTick/100+i)*0.1})`;
                ctx.beginPath(); ctx.arc(ax, ay, 1.5, 0, Math.PI*2); ctx.fill();
            }
        }
        // Niebla de plaga
        if(G.currentClimate === 'plague') {
            ctx.fillStyle = `rgba(60,120,40,${0.04 + Math.sin(G.timeTick/300)*0.02})`;
            ctx.fillRect(0,0,W,H);
        }
        // Brillo dorado de bendición
        if(G.currentClimate === 'blessed') {
            let glowAlpha = 0.02 + Math.sin(G.timeTick/200)*0.01;
            ctx.fillStyle = `rgba(255,240,150,${glowAlpha})`;
            ctx.fillRect(0,0,W,H);
        }
        // Tinte naranja árido
        if(G.currentClimate === 'arid') {
            ctx.fillStyle = 'rgba(200,140,50,0.05)';
            ctx.fillRect(0,0,W,H);
        }
        // Nombre del clima en esquina
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        let climateIcons = {temperate:'🌤️',tropical:'🌴',arid:'☀️',cold:'❄️',stormy:'⛈️',volcanic_climate:'🔥',plague:'☣️',blessed:'✨'};
        ctx.fillText((climateIcons[G.currentClimate]||'') + ' ' + G.currentClimate.toUpperCase(), 12, H - 50);
    }

    let gradient = ctx.createRadialGradient(view.w/2, view.h/2, view.h/3, view.w/2, view.h/2, view.w);
    gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, view.w, view.h);
    updateMinimapViewbox();
}
