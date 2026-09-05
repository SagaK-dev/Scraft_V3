import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockIds, createDefaultBlockRegistry } from '../src/blocks/BlockRegistry.ts';
import { intersectsUnitBlock } from '../src/player/aabb.ts';
import { BlockBreaker } from '../src/world/BlockBreaker.ts';
import { Chunk } from '../src/world/Chunk.ts';
import { ChunkManager } from '../src/world/ChunkManager.ts';
import { buildChunkMeshData } from '../src/world/ChunkMesher.ts';
import { raycastVoxels, type VoxelHit } from '../src/world/VoxelRaycast.ts';
import { CHUNK_HEIGHT, CHUNK_MAX_Y, CHUNK_MIN_Y, localYToWorld, worldYToLocal } from '../src/world/coordinates.ts';

const blocks = createDefaultBlockRegistry();

test('default block registry contains voxel utility and Phase 8 world blocks', () => {
  assert.equal(blocks.size, 18);
  assert.equal(blocks.get(BlockIds.AIR).solid, false);
  assert.equal(blocks.get(BlockIds.STONE).opaque, true);
  assert.equal(blocks.get(BlockIds.LEAVES).opaque, false);
  assert.equal(blocks.get(BlockIds.FURNACE).preferredTool, 'pickaxe');
  assert.equal(blocks.get(BlockIds.CHEST).preferredTool, 'axe');
  assert.equal(blocks.get(BlockIds.WATER).liquid, true);
  assert.equal(blocks.get(BlockIds.WATER).solid, false);
  assert.equal(blocks.get(BlockIds.GLOW_CRYSTAL).lightLevel, 12);
});

test('block registry rejects duplicate ids', () => assert.throws(() => blocks.register({ id: BlockIds.STONE, name: 'Duplicate', solid: true, opaque: true, hardness: 1, color: 0, placeable: true })));
test('chunk uses Uint16 storage with 16x256x16 capacity', () => { const chunk = new Chunk(0, 0); assert.ok(chunk.voxels instanceof Uint16Array); assert.equal(chunk.voxels.length, 16 * CHUNK_HEIGHT * 16); });
test('world/local Y conversion covers full range', () => { assert.equal(worldYToLocal(CHUNK_MIN_Y), 0); assert.equal(worldYToLocal(CHUNK_MAX_Y), CHUNK_HEIGHT - 1); assert.equal(localYToWorld(0), CHUNK_MIN_Y); assert.throws(() => worldYToLocal(CHUNK_MIN_Y - 1), RangeError); });
test('ChunkManager reads and writes negative world coordinates correctly', () => { const manager = new ChunkManager(); const chunk = new Chunk(-1, -1); manager.add(chunk); manager.takeDirtyChunkKeys(); assert.equal(manager.setBlock(-1, 0, -1, BlockIds.STONE).changed, true); assert.equal(chunk.get(15, worldYToLocal(0), 15), BlockIds.STONE); });
test('ChunkManager refuses writes to unloaded chunk', () => { const manager = new ChunkManager(); assert.equal(manager.setBlock(0,0,0,BlockIds.STONE).changed, false); assert.equal(manager.getBlock(0,0,0), BlockIds.AIR); });
test('boundary edit dirties edited and adjacent chunk', () => { const manager=new ChunkManager(); const left=new Chunk(0,0); const right=new Chunk(1,0); manager.add(left); manager.add(right); manager.takeDirtyChunkKeys(); left.set(15,worldYToLocal(0),0,BlockIds.STONE); manager.markAllDirty(); manager.takeDirtyChunkKeys(); const result=manager.setBlock(15,0,0,BlockIds.AIR); assert.deepEqual(new Set(result.affectedChunkKeys),new Set(['0,0','1,0'])); });
test('markRadiusDirty marks only loaded chunks in requested radius', () => { const manager=new ChunkManager(); for (let z=-1;z<=1;z+=1) for(let x=-1;x<=1;x+=1) manager.add(new Chunk(x,z)); manager.takeDirtyChunkKeys(); manager.markRadiusDirty(0,0,1); assert.equal(manager.takeDirtyChunkKeys().length,9); assert.throws(()=>manager.markRadiusDirty(0,0,5),RangeError); });
test('single opaque voxel emits six faces', () => { const manager=new ChunkManager(); const chunk=new Chunk(0,0); chunk.set(0,worldYToLocal(0),0,BlockIds.STONE); manager.add(chunk); assert.equal(buildChunkMeshData(chunk,manager,blocks).faceCount,6); });
test('two adjacent opaque voxels cull shared faces', () => { const manager=new ChunkManager(); const chunk=new Chunk(0,0); chunk.set(0,worldYToLocal(0),0,BlockIds.STONE); chunk.set(1,worldYToLocal(0),0,BlockIds.STONE); manager.add(chunk); assert.equal(buildChunkMeshData(chunk,manager,blocks).faceCount,10); });
test('meshing culls face against opaque neighboring chunk', () => { const manager=new ChunkManager(); const a=new Chunk(0,0); const b=new Chunk(1,0); a.set(15,worldYToLocal(0),0,BlockIds.STONE); b.set(0,worldYToLocal(0),0,BlockIds.STONE); manager.add(a); manager.add(b); assert.equal(buildChunkMeshData(a,manager,blocks).faceCount,5); assert.equal(buildChunkMeshData(b,manager,blocks).faceCount,5); });
test('transparent neighbor does not hide opaque face', () => { const manager=new ChunkManager(); const chunk=new Chunk(0,0); chunk.set(0,worldYToLocal(0),0,BlockIds.STONE); chunk.set(1,worldYToLocal(0),0,BlockIds.LEAVES); manager.add(chunk); assert.equal(buildChunkMeshData(chunk,manager,blocks).faceCount,11); });
test('voxel raycast hits expected face and distance', () => { const getBlock=(x:number,y:number,z:number)=>x===3&&y===0&&z===0?BlockIds.STONE:BlockIds.AIR; const hit=raycastVoxels({x:.5,y:.5,z:.5},{x:1,y:0,z:0},6,getBlock); assert.deepEqual(hit,{x:3,y:0,z:0,blockId:BlockIds.STONE,distance:2.5,normal:[-1,0,0]}); });
test('voxel raycast works negative direction', () => { const hit=raycastVoxels({x:-.5,y:.5,z:.5},{x:-1,y:0,z:0},6,(x,y,z)=>x===-3&&y===0&&z===0?BlockIds.STONE:BlockIds.AIR); assert.equal(hit?.x,-3); assert.equal(hit?.distance,1.5); assert.deepEqual(hit?.normal,[1,0,0]); });
test('voxel raycast misses beyond max distance', () => assert.equal(raycastVoxels({x:.5,y:.5,z:.5},{x:1,y:0,z:0},2,x=>x===4?BlockIds.STONE:BlockIds.AIR),null));
test('placement collision rejects overlapping player AABB', () => { const player={minX:-.3,minY:0,minZ:-.3,maxX:.3,maxY:1.8,maxZ:.3}; assert.equal(intersectsUnitBlock(player,0,0,0),true); assert.equal(intersectsUnitBlock(player,1,0,0),false); });
test('block breaker completes only after hardness duration', () => { const breaker=new BlockBreaker(); const hit:VoxelHit={x:1,y:2,z:3,blockId:BlockIds.STONE,distance:1,normal:[-1,0,0]}; assert.deepEqual(breaker.update(.5,true,hit,1.5),{completed:false,progress:1/3}); assert.equal(breaker.update(1,true,hit,1.5).completed,true); });
test('block breaker resets when targeted voxel changes', () => { const breaker=new BlockBreaker(); const first:VoxelHit={x:1,y:2,z:3,blockId:BlockIds.STONE,distance:1,normal:[-1,0,0]}; const second={...first,x:2}; breaker.update(1,true,first,2); assert.equal(breaker.update(.2,true,second,2).progress,.1); assert.equal(breaker.update(.2,false,second,2).progress,0); });
