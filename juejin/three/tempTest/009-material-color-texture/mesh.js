import * as THREE from "three";
export function getMesh1() {
  const boxGeometry = new THREE.BoxGeometry(100, 100, 100);
  const material = new THREE.MeshBasicMaterial({
    color: 0x004444,
    opacity: 0.5,
    transparent: true,
  });
  const mesh = new THREE.Mesh(boxGeometry, material);

  const geometry = new THREE.EdgesGeometry(boxGeometry);

  const lineMaterial = new THREE.LineDashedMaterial({
    color: new THREE.Color("orange"),
    dashSize: 10,
    gapSize: 10,
  });
  const line = new THREE.Line(geometry, lineMaterial);
  line.computeLineDistances();
  mesh.add(line);
  return mesh;
}

export function getMesh2() {
  const boxGeometry = new THREE.SphereGeometry(100, 32, 32);
  const textureLoader = new THREE.TextureLoader();
  const material = new THREE.MeshBasicMaterial({
    // color: new THREE.Color("orange"),
    map: textureLoader.load("./earth.jpg"),
  });
  const mesh = new THREE.Mesh(boxGeometry, material);
  const geometry = new THREE.EdgesGeometry(boxGeometry);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color("skyblue"),
  });
  const line = new THREE.Line(geometry, lineMaterial);
  // mesh.add(line);
  return mesh;
}

export function getMesh3() {
  const geometry = new THREE.PlaneGeometry(1000, 1000);
  console.log(geometry);
  
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load("./wall.jpg");
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    aoMap: texture,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}
