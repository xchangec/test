import * as THREE from "three";

const geometry = new THREE.BoxGeometry(150, 10, 100);
const material = new THREE.MeshLambertMaterial({
  color: new THREE.Color("grey"),
});
const mesh = new THREE.Mesh(geometry, material);
export default mesh;
