import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();

// const axesHelper = new THREE.AxesHelper(200);
// scene.add(axesHelper);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000);
camera.position.set(200, 200, 200);
camera.lookAt(0, 0, 0);

const camera1 = new THREE.PerspectiveCamera(20, 16 / 9, 100, 300);
let cameraHelper = new THREE.CameraHelper(camera1);
scene.add(cameraHelper);

const gui = new GUI();
function onChange() {
  console.log("111");
  scene.remove(cameraHelper);
  cameraHelper = new THREE.CameraHelper(camera1);
  scene.add(cameraHelper);
}
gui.add(camera1, "fov", [10, 30, 60, 90,120,180]).onChange(onChange);
gui
  .add(camera1, "aspect", {
    "16/9": 16 / 9,
    "4/3": 4 / 3,
    "1/1": 1 / 1,
  })
  .onChange(onChange);
gui.add(camera1, "near", 0, 300).onChange(onChange);
gui.add(camera1, "far", 300, 800).onChange(onChange);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
