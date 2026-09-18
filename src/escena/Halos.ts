// Halos luminosos (sprites aditivos) para marcar regiones activas a través de la corteza translúcida.
import * as THREE from 'three';

let textura: THREE.CanvasTexture | null = null;

export function texturaHalo(): THREE.CanvasTexture {
  if (textura) return textura;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  textura = new THREE.CanvasTexture(c);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

export function crearHalo(color: THREE.ColorRepresentation): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texturaHalo(), color, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.visible = false;
  sprite.renderOrder = 20;
  return sprite;
}
