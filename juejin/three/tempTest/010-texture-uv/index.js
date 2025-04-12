import * as THREE from "three";
// import { getMesh1, getMesh2, getMesh3 } from "./mesh.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// 创建场景
const scene = new THREE.Scene();

// 创建相机
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 200;

// 创建渲染器
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 加载纹理
const textureLoader = new THREE.TextureLoader();
const texture = textureLoader.load('./bg.jpg');
texture.colorSpace = THREE.SRGBColorSpace; // 设置颜色空间为 sRGB

// 创建立方体几何体
const geometry = new THREE.BoxGeometry(100, 100, 100);
console.log(geometry);


// 设置 UV 坐标
// 立方体每个面由两个三角形组成，每个三角形有 3 个顶点
// 因此每个面有 6 个顶点的 UV 坐标需要设置
// 这里为了简单，我们将整个纹理应用到每个面上
const uvs = geometry.attributes.uv.array;
// for (let i = 0; i < uvs.length; i += 2) {
//     uvs[i] = i % 4 < 2 ? 0 : 1; // U 坐标
//     uvs[i + 1] = i % 4 < 2 ? 0 : 1; // V 坐标
// }

// uvs[0] = 0; uvs[1] = 0; // 左下角
// uvs[2] = 0.5; uvs[3] = 0; // 右下角
// uvs[4] = 0; uvs[5] = 1; // 左上角
// uvs[6] = 0.5; uvs[7] = 0.5; // 右上角
uvs[0] = 0; uvs[1] = 1; // 左下角
uvs[2] = 0.5; uvs[3] = 0.5; // 右下角
uvs[4] = 0; uvs[5] = 0; // 左上角
uvs[6] = 0.5; uvs[7] = 0; // 右上角
// console.log(uvs);


// 创建材质
const material = new THREE.MeshBasicMaterial({ map: texture });

// 创建网格
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

const controls = new OrbitControls(camera, renderer.domElement);

// 渲染循环
function animate() {
    requestAnimationFrame(animate);

    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;

    renderer.render(scene, camera);
}

animate();
