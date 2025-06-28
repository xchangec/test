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
const material = new THREE.MeshLambertMaterial({
  color: new THREE.Color("lightgrey"),
});
const mesh = new THREE.Mesh(geometry, material);
export default mesh;
