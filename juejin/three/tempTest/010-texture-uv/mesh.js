import * as THREE from "three";
export function getMesh1() {
  // 加载纹理
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("./bg.jpg");
  texture.colorSpace = THREE.SRGBColorSpace; // 设置颜色空间为 sRGB

  // 创建立方体几何体
  const geometry = new THREE.BoxGeometry(100, 100, 100);
  console.log(geometry);

  // uvs[0] = 0; uvs[1] = 1; //
  // uvs[2] = 0.5; uvs[3] = 0.5; //
  // uvs[4] = 0; uvs[5] = 0; //
  // uvs[6] = 0.5; uvs[7] = 0; //
  // console.log(uvs);

  // 创建材质
  const material = new THREE.MeshBasicMaterial({ map: texture });

  // 创建网格
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

export function getMesh2() {
  const geometry = new THREE.SphereGeometry(100, 32, 32);
  const textureLoader = new THREE.TextureLoader();
  const loader = textureLoader.load("./jupiter.webp");
  loader.colorSpace = THREE.SRGBColorSpace; // 设置颜色空间为 sRGB
  loader.wrapS = THREE.RepeatWrapping; // 设置纹理重复方式
  const material = new THREE.MeshBasicMaterial({
    map: loader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
