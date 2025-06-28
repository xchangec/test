import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();

const axesHelper = new THREE.AxesHelper(200);
scene.add(axesHelper);

const width = window.innerWidth;
const height = window.innerHeight;
const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

const geometry = new THREE.PlaneGeometry(400, 400, 60, 60);
const noise2D = createNoise2D();
console.log(geometry);
const positions = geometry.attributes.position;

const updatePosition = () => {
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = noise2D(x / 100, y / 100) * 20;
    // console.log(z);
    const sinNum = Math.sin(new Date() * 0.002 + x * 0.05) * 10;
    // console.log(sinNum);
    positions.setZ(i, z + sinNum);
  }
  positions.needsUpdate = true;
};

const material = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  wireframe: true,
});
const mesh = new THREE.Mesh(geometry, material);
mesh.rotateX(Math.PI / 2);

scene.add(mesh);

camera.position.set(200, 200, 200);
camera.lookAt(0, 0, 0);
// console.log(camera);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(width, height);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.addEventListener("change", (e) => {
  // console.log(camera.position);
});

function animate() {
  updatePosition();
  //   mesh.rotation.x += 0.01;
  //   mesh.rotation.y += 0.01;
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
