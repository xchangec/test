import * as THREE from "three";
import { getMesh1, getMesh2, getMesh3, getMesh4, getMesh5 } from "./mesh.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// 创建场景
const scene = new THREE.Scene();

const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

// const mesh = getMesh1();
// const mesh = getMesh2();
// const mesh = getMesh3();
// const mesh = getMesh4();
const mesh = getMesh5();
scene.add(mesh);

const width = window.innerWidth;
const height = window.innerHeight;
// 创建相机
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.set(200, 200, 200);

// 创建渲染器
const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// 渲染循环
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();
