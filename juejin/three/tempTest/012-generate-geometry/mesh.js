import * as THREE from "three";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

export const getMesh1 = () => {
  const arr = [
    new THREE.Vector2(0, -50),
    new THREE.Vector2(50, 0),
    new THREE.Vector2(40, 20),
    new THREE.Vector2(30, 40),
    new THREE.Vector2(20, 40),
    new THREE.Vector2(20, 50),
    new THREE.Vector2(10, 60),
    new THREE.Vector2(0, 90),
  ];
  const geometry = new THREE.LatheGeometry(arr, 10);
  const material = new THREE.MeshLambertMaterial({ color: 0x049ef4 });
  const mesh = new THREE.Mesh(geometry, material);

  const geometry1 = new THREE.BufferGeometry();
  geometry1.setFromPoints(arr);
  const material1 = new THREE.PointsMaterial({ color: 0xff0000, size: 5 });
  const points = new THREE.Points(geometry1, material1);
  const material2 = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry1, material2);
  mesh.add(points, line);
  return mesh;
};

export const getMesh2 = () => {
  const params = {
    tubularSegments: 30,
    radius: 15,
    radialSegments: 20,
    closed: false,
  };
  const p1 = new THREE.Vector3(-100, 0, 0);
  const p2 = new THREE.Vector3(50, 100, 0);
  const p3 = new THREE.Vector3(100, 0, 100);
  const p4 = new THREE.Vector3(100, 0, 0);
  const curve = new THREE.CubicBezierCurve3(p1, p2, p3, p4);
  const geometry = new THREE.TubeGeometry(
    curve,
    params.tubularSegments,
    params.radius,
    params.radialSegments,
    params.closed
  );
  const material = new THREE.MeshLambertMaterial({
    color: 0x049ef4,
    side: THREE.DoubleSide,
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  console.log(mesh);

  //   const pointsList = curve.getPoints(30);
  //   const geometry1 = new THREE.BufferGeometry();
  //   geometry1.setFromPoints(pointsList);
  //   const material1 = new THREE.PointsMaterial({ color: 0xff0000, size: 5 });
  //   const points = new THREE.Points(geometry1, material1);
  //   const material2 = new THREE.LineBasicMaterial({ color: 0xff0000 });
  //   const line = new THREE.Line(geometry1, material2);
  //   mesh.add(points, line);

  const geometry2 = new THREE.BufferGeometry();
  geometry2.setFromPoints([p1, p2, p3, p4]);
  const material3 = new THREE.PointsMaterial({ color: "green", size: 7 });
  const points1 = new THREE.Points(geometry2, material3);
  const line1 = new THREE.Line(geometry2, new THREE.LineBasicMaterial());
  mesh.add(points1, line1);

  const gui = new GUI();

  function onChange() {
    mesh.geometry = new THREE.TubeGeometry(
      curve,
      params.tubularSegments,
      params.radius,
      params.radialSegments,
      params.closed
    );
  }
  gui
    .add(params, "tubularSegments", 1, 100, 1)
    .onChange(onChange)
    .name("管道方向分段数");
  gui.add(params, "radius", 1, 100, 1).onChange(onChange).name("半径");
  gui
    .add(params, "radialSegments", 1, 30, 1)
    .onChange(onChange)
    .name("横截面分段数");
  gui.add(params, "closed").onChange(onChange).name("管道的两端是否闭合");
  return mesh;
};

export const getMesh3 = () => {
  const pointsArr = [
    new THREE.Vector2(100, 0),
    new THREE.Vector2(50, 20),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0, 50),
    new THREE.Vector2(50, 100),
  ];
  const shape = new THREE.Shape(pointsArr);

  const hole = new THREE.Path();
  hole.arc(50, 50, 10);
  shape.holes.push(hole);

  //   const geometry = new THREE.ShapeGeometry(shape);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 50,
  });

  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color("lightgreen"),
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
};
