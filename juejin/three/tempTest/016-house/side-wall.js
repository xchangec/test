import * as THREE from "three";

const shape = new THREE.Shape([
  new THREE.Vector2(0, 0),
  new THREE.Vector2(100, 0),
  new THREE.Vector2(100, 60),
  new THREE.Vector2(50, 110),
  new THREE.Vector2(0, 60),
]);
shape.holes.push(
  new THREE.Path([
    new THREE.Vector2(30, 20),
    new THREE.Vector2(70, 20),
    new THREE.Vector2(70, 50),
    new THREE.Vector2(30, 50),
  ])
);
const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 4,
});

const loader = new THREE.TextureLoader();
const texture = loader.load("./chartlet/zhuan.webp");
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = THREE.RepeatWrapping;
texture.repeat.x = 0.01;
texture.repeat.y = 0.01;
const material = new THREE.MeshLambertMaterial({
  // color: new THREE.Color("lightgrey"),
  map: texture,
  aoMap: texture,
});
const mesh = new THREE.Mesh(geometry, material);

console.log("侧墙uv坐标", mesh.geometry.attributes.uv.array);
export default mesh;
