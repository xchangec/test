import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

export const getMesh1 = () => {
  const geometry = new THREE.CylinderGeometry(30, 30, 1000, 32, 1, true);

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("./storm.webp");
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    alphaMap: texture,
    // map: texture,
  });
  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
};
