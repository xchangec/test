import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getMesh1, getMesh2,getMesh3 } from "./mesh.js";

const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

// const mesh = getMesh1();
// const mesh = getMesh2();
const mesh = getMesh3();
scene.add(mesh);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
camera.position.set(200, 200, 200);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
scene.add(directionalLight);
const light = new THREE.AmbientLight(0xffffff, 2);
scene.add(light);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);



const animate = () => {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
};
animate();
