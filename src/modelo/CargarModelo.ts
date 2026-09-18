// Carga el GLB embebido (base64) y entrega geometrías en coordenadas de Three.js:
// centradas en el origen, con el eje Y hacia arriba y la cara anterior hacia -Z.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GEOMETRIA, type Anclaje } from '../datos.ts';

export interface ModeloCerebro {
  geometrias: Map<string, THREE.BufferGeometry>;
  centroides: Map<string, THREE.Vector3>;
  cajas: Map<string, THREE.Box3>;
  radio: number;
  triangulos: number;
}

const bb = GEOMETRIA.bbox_global;
const CENTRO_RAS = new THREE.Vector3((bb.min[0] + bb.max[0]) / 2, (bb.min[1] + bb.max[1]) / 2, (bb.min[2] + bb.max[2]) / 2);
// RAS (x derecha, y anterior, z superior) → Three (x derecha, y arriba, z hacia el espectador = posterior)
const ROTACION = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
const TRASLACION = new THREE.Matrix4().makeTranslation(-CENTRO_RAS.x, -CENTRO_RAS.y, -CENTRO_RAS.z);
const RAS_A_TRES = new THREE.Matrix4().multiplyMatrices(ROTACION, TRASLACION);

export function rasATres(v: ArrayLike<number>): THREE.Vector3 {
  return new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(RAS_A_TRES);
}

/** Posición de un anclaje relativo a la caja (RAS) de una malla, en coordenadas Three. */
export function posicionAnclaje(a: Anclaje): THREE.Vector3 {
  const g = GEOMETRIA.mallas[a.malla];
  if (!g) throw new Error(`Anclaje a malla desconocida: ${a.malla}`);
  const p = [0, 1, 2].map((k) => g.bbox.min[k] + a.frac[k] * (g.bbox.max[k] - g.bbox.min[k]));
  return rasATres(p);
}

export function decodificarBase64(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/** Copia la geometría con posiciones Float32 (descuantiza KHR_mesh_quantization) y aplica una matriz. */
function aFloat32(origen: THREE.BufferGeometry, matriz: THREE.Matrix4): THREE.BufferGeometry {
  const pos = origen.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  if (origen.index) g.setIndex(origen.index.clone());
  g.applyMatrix4(matriz);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function cargarModelo(base64: string): Promise<ModeloCerebro> {
  return new Promise((resolver, rechazar) => {
    const loader = new GLTFLoader();
    loader.parse(decodificarBase64(base64), '', (gltf) => {
      try {
        gltf.scene.updateMatrixWorld(true);
        const geometrias = new Map<string, THREE.BufferGeometry>();
        const centroides = new Map<string, THREE.Vector3>();
        const cajas = new Map<string, THREE.Box3>();
        const m = new THREE.Matrix4();
        let triangulos = 0;
        const total = new THREE.Box3();
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          m.copy(mesh.matrixWorld).premultiply(RAS_A_TRES);
          const g = aFloat32(mesh.geometry, m);
          g.name = mesh.name;
          geometrias.set(mesh.name, g);
          cajas.set(mesh.name, g.boundingBox!.clone());
          total.union(g.boundingBox!);
          triangulos += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
          const meta = GEOMETRIA.mallas[mesh.name];
          centroides.set(mesh.name, meta ? rasATres(meta.centroide) : g.boundingSphere!.center.clone());
          mesh.geometry.dispose();
        });
        const esfera = new THREE.Sphere();
        total.getBoundingSphere(esfera);
        resolver({ geometrias, centroides, cajas, radio: esfera.radius, triangulos });
      } catch (e) { rechazar(e); }
    }, rechazar);
  });
}
