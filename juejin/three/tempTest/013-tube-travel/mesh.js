import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

export const getMesh1 = () => {
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-100, 20, 90),
    new THREE.Vector3(-40, 80, 100),
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(60, -60, 0),
    new THREE.Vector3(100, -40, 80),
    new THREE.Vector3(150, 60, 60),
  ]);
  console.log(path);

  const geometry = new THREE.TubeGeometry(path, 80, 10, 20);

  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("./stone.webp");
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.x = 20;
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    map: texture,
    aoMap: texture,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const tubePoints = path.getPoints(1000);
  //   const tubePoints = path.getSpacedPoints (1000)
  console.log(tubePoints);

  return { mesh, tubePoints };
};
