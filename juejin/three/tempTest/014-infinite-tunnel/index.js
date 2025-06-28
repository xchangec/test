import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { getMesh1 } from "./mesh.js";

const scene = new THREE.Scene();
const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

const mesh = getMesh1();
scene.add(mesh);
console.log(mesh);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 2000);
camera.position.set(400, 400, 400);
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

let H = 0;
const clock = new THREE.Clock();
function animate() {
  // mesh.material.map.offset.y+=0.01;
  // mesh.material.map.offset.y += delta * 0.2;

  const delta = clock.getDelta(); // seconds.
  H += 0.002;
  if (H > 1) H = 0;
  mesh.material.color.setHSL(H, 0.5, 0.5);

  mesh.material.alphaMap.offset.y += delta * 0.2;
  mesh.rotation.y += delta * 0.5;

  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
