import * as THREE from "three";

// const shape = new THREE.Shape();
// shape.moveTo(0, 0);
// shape.lineTo(150, 0);
// shape.lineTo(150, 60);
// shape.lineTo(0, 60);

// const geometry = new THREE.ExtrudeGeometry(shape, {
//   depth: 4,
// });

const geometry = new THREE.BoxGeometry(150, 60, 4);

const loader = new THREE.TextureLoader();
const texture = loader.load("./chartlet/zhuan.webp");
texture.colorSpace = THREE.SRGBColorSpace;
texture.wrapS = THREE.RepeatWrapping;
texture.repeat.x = 2;
const material = new THREE.MeshLambertMaterial({
  // color: new THREE.Color("lightgrey"),
  map: texture,
  aoMap: texture,
  polygonOffset: true,
});
const mesh = new THREE.Mesh(geometry, material);
console.log("后墙uv坐标", mesh.geometry.attributes.uv.array);

export default mesh;
