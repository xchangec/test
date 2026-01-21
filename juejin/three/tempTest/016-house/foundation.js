import * as THREE from "three";

const geometry = new THREE.BoxGeometry(150, 10, 100);

const loader = new THREE.TextureLoader();
const texture = loader.load("./chartlet/shui-ni.webp");
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = THREE.RepeatWrapping;
texture.repeat.x = 1;
const material = new THREE.MeshLambertMaterial({
  // color: new THREE.Color("grey"),
  map: texture,
  aoMap:texture
});
const mesh = new THREE.Mesh(geometry, material);
export default mesh;
