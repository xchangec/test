import * as THREE from "three";
import { getMesh1, getMesh2, getMesh3 } from "./mesh.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();

const mesh1 = getMesh1();
const mesh2 = getMesh2();
const mesh3 = getMesh3();
scene.add(mesh3);

const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

const width = window.innerWidth;
const height = window.innerHeight;

const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
camera.position.set(33, 0, 990);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener("change", (e) => {
  console.log(camera.position);
});

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
