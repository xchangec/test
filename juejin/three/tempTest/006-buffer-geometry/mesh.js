import * as THREE from "three";
// 在Threejs中，空间中一个三角形是有正反两面的，
// 在Three.js中规则你的眼睛(相机)对着三角形的一个面，
// 如果三个顶点的顺序是逆时针方向，该面视为正面，
// 如果三个顶点的顺序是顺时针方向，该面视为反面。
// 我们可以在创建材质的时候配置side属性来设置物体的正反面是否可见。

export function getMesh1() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 0, 0, 100, 100, 0, 0, 100, 0,
  ]);
  const attribute = new THREE.BufferAttribute(vertices, 3);
  geometry.attributes.position = attribute;

  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color("orange"),
    wireframe: true,
    // side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

export function getMesh2() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0,
  ]);
  const attribute = new THREE.BufferAttribute(vertices, 3);
  geometry.attributes.position = attribute;

  const indexes = new Uint16Array([0, 1, 2, 0, 2, 3]);
  geometry.index = new THREE.BufferAttribute(indexes, 1);

  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color("orange"),
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

export function getMesh3() {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color("orange"),
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
