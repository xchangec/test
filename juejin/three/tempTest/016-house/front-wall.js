import * as THREE from "three";

const shape = new THREE.Shape();
shape.moveTo(0, 0);
shape.lineTo(150, 0);
shape.lineTo(150, 60);
shape.lineTo(0, 60);

const path = new THREE.Path();
path.moveTo(10, 0);
path.lineTo(35, 0);
path.lineTo(35, 40);
path.lineTo(10, 40);
shape.holes.push(path);

const path1 = new THREE.Path([
  new THREE.Vector2(95, 15),
  new THREE.Vector2(135, 15),
  new THREE.Vector2(135, 45),
  new THREE.Vector2(95, 45),
]);
shape.holes.push(path1);

const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 4,
});

const loader = new THREE.TextureLoader();
const texture = loader.load("./chartlet/zhuan.webp");
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = THREE.RepeatWrapping;
texture.repeat.x = 0.013;
texture.repeat.y = 0.01;
const material = new THREE.MeshLambertMaterial({
  color: new THREE.Color("lightgrey"),
  map: texture,
  aoMap: texture,
});
const mesh = new THREE.Mesh(geometry, material);
export default mesh;
