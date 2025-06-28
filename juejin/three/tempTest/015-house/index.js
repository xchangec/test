import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getMesh1 } from "./mesh.js";
import foundation from "./foundation.js";
import sideWall from "./side-wall.js";
import backWall from "./back-wall.js";
import frontWall from "./front-wall.js";
import roof from "./roof.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

// const mesh = getMesh1();
// scene.add(mesh);
// console.log(mesh);

const house = new THREE.Group();

// 侧墙
sideWall.rotateY(Math.PI / 2);
// sideWall.translateX(-50);
// sideWall.translateZ(-75);
sideWall.position.set(-75, 5, 50);
const sideWall2 = sideWall.clone();
sideWall2.position.set(71, 5, 50);
// 后墙
backWall.position.set(-75, 5, -50);
// 前墙
frontWall.position.set(-75, 5, 46);
// 顶
const params = {
  x: 0,
  y: 90,
  z: 25,
  rotateX: -Math.PI / 4,
};
roof.rotateX(params.rotateX);
roof.position.set(params.x, params.y, params.z);
const roof2 = roof.clone();
roof2.rotateX(Math.PI / 2);
roof2.position.set(params.x, params.y, -params.z);

house.add(foundation);
house.add(sideWall);
house.add(sideWall2);
house.add(backWall);
house.add(frontWall);
house.add(roof);
house.add(roof2);
scene.add(house);

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
// controls.addEventListener("change", () => {
//   console.log(camera.position);

// });
function handleChange() {
  roof.rotateX(params.rotateX);
  roof.position.set(params.x, params.y, params.z);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
