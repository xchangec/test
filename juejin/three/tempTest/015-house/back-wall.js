import * as THREE from "three";

const shape = new THREE.Shape();
shape.moveTo(0, 0);
shape.lineTo(150, 0);
shape.lineTo(150, 60);
shape.lineTo(0, 60);

const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: 4,
});
const material = new THREE.MeshLambertMaterial({
  color: new THREE.Color("lightgrey"),
});
const mesh = new THREE.Mesh(geometry, material);
export default mesh;
