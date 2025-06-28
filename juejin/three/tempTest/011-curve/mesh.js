import * as THREE from "three";

export const getMesh1 = () => {
  const curve = new THREE.EllipseCurve(0, 0, 100, 60, 0, Math.PI);
  const pointsList = curve.getPoints(20);
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(pointsList);
  console.log(geometry);

  const pointsMaterial = new THREE.PointsMaterial({
    color: 0xff0000,
    size: 10,
  });
  const points = new THREE.Points(geometry, pointsMaterial);

  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, lineMaterial);
  line.add(points);
  return line;
};

export const getMesh2 = () => {
  const arr = [
    new THREE.Vector2(-100, 0),
    new THREE.Vector2(-50, -50),
    new THREE.Vector2(0, 0),
    new THREE.Vector2(50, 50),
    new THREE.Vector2(100, 0),
  ];
  console.log(arr);

  const curve = new THREE.SplineCurve(arr);
  const pointsList = curve.getPoints(20);
  console.log(pointsList);

  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(pointsList);
  const pointsMaterial = new THREE.PointsMaterial({
    color: "pink",
    size: 5,
  });
  const points = new THREE.Points(geometry, pointsMaterial);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);
  line.add(points);

  const geometry1 = new THREE.BufferGeometry();
  geometry1.setFromPoints(arr);
  const pointsMaterial1 = new THREE.PointsMaterial({
    color: "green",
    size: 10,
  });
  const points1 = new THREE.Points(geometry1, pointsMaterial1);
  const line1 = new THREE.Line(geometry1, new THREE.LineBasicMaterial());

  line.add(points1, line1);

  return line;
};

export const getMesh3 = () => {
  const p1 = new THREE.Vector2(0, 0);
  const p2 = new THREE.Vector2(30, 90);
  const p3 = new THREE.Vector2(100, 0);

  const curve = new THREE.QuadraticBezierCurve(p1, p2, p3);
  const pointsList = curve.getPoints(30);
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(pointsList);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);

  const geometry1 = new THREE.BufferGeometry();
  geometry1.setFromPoints([p1, p2, p3]);
  const material1 = new THREE.PointsMaterial({
    color: "green",
    size: 5,
  });
  const points = new THREE.Points(geometry1, material1);
  const line1 = new THREE.Line(geometry1, new THREE.LineBasicMaterial());
  line.add(points, line1);
  return line;
};

export const getMesh4 = () => {
  const p1 = new THREE.Vector3(-100, 0, 0);
  const p2 = new THREE.Vector3(0, 100, 0);
  const p3 = new THREE.Vector3(100, 0, 100);
  const p4 = new THREE.Vector3(100, 0, 0);

  const curve = new THREE.CubicBezierCurve3(p1, p2, p3, p4);
  const pointsList = curve.getPoints(30);
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(pointsList);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(geometry, material);

  const geometry1 = new THREE.BufferGeometry();
  geometry1.setFromPoints([p1, p2, p3, p4]);
  const material1 = new THREE.PointsMaterial({
    color: "green",
    size: 5,
  });
  const points = new THREE.Points(geometry1, material1);
  const line1 = new THREE.Line(geometry1, new THREE.LineBasicMaterial());
  line.add(points, line1);
  return line;
};

export const getMesh5 = () => {
  const p1 = new THREE.Vector2(0, 0);
  const p2 = new THREE.Vector2(100, 100);
  const line1 = new THREE.LineCurve(p1, p2);

  const arc = new THREE.EllipseCurve(0, 100, 100, 100, 0, Math.PI);

  const p3 = new THREE.Vector2(-100, 100);
  const p4 = new THREE.Vector2(0, 0);
  const line2 = new THREE.LineCurve(p3, p4);

  const curvePath = new THREE.CurvePath();
  curvePath.add(line1);
  curvePath.add(arc);
  curvePath.add(line2);

  const pointsArr = curvePath.getPoints(20);
  const geometry = new THREE.BufferGeometry();
  geometry.setFromPoints(pointsArr);

  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color("pink"),
  });

  const line = new THREE.Line(geometry, material);
  return line;
};
