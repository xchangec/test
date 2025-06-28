import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

const geometry = new THREE.BoxGeometry(150, 70, 2);
const material = new THREE.MeshLambertMaterial({
  color: new THREE.Color("red"),
});
const mesh = new THREE.Mesh(geometry, material);

const params = {
  x: 0,
  y: 91,
  z: 26,
  rotateX: -Math.PI / 4,
};

const gui = new GUI();
gui.add(params, "y", 0, 100).onChange(handleChange).name("y轴");
gui.add(params, "z", 0, 100).onChange(handleChange).name("z轴");
gui.add(params, "rotateX").min(0).max(180).step(0.1).onChange(handleChange);
function handleChange() {
  mesh.rotation.x = params.rotateX;
  mesh.position.set(params.x, params.y, params.z);
}

export default mesh;
