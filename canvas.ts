import * as glMatrix from "https://esm.sh/gl-matrix@2.1.0";
import bresenham from "./bresenham.ts";
import earcut from "https://esm.sh/earcut";
import Canvas from "./drawllie.ts";

var mat2d = glMatrix.mat2d;
var vec2 = glMatrix.vec2;

interface Path {
  point: number[];
  stroke: boolean;
}

export default class Context extends Canvas {
  _matrix = mat2d.create();
  _stack: unknown[] = [];
  _currentPath: Path[] = [];
  constructor(width?: number, height?: number) {
    super(width, height);
  }
  save() {
    this._stack.push(mat2d.clone(mat2d.create(), this._matrix));
  }
  restore() {
    var top = this._stack.pop();
    if (!top) return;
    this._matrix = top;
  }
  translate(x: number, y: number) {
    mat2d.translate(this._matrix, this._matrix, vec2.fromValues(x, y));
  }
  rotate(a: number) {
    mat2d.rotate(this._matrix, this._matrix, a / 180 * Math.PI);
  }
  scale(x: number, y: number) {
    mat2d.scale(this._matrix, this._matrix, vec2.fromValues(x, y));
  }
  beginPath() {
    this._currentPath = [];
  }
  closePath() {
    this._currentPath.push({
      point: this._currentPath[0].point,
      stroke: false,
    });
  }
  stroke() {
    var set = this.set.bind(this);
    for (var i = 0; i < this._currentPath.length - 1; i++) {
      var cur = this._currentPath[i];
      var nex = this._currentPath[i + 1];
      if (nex.stroke) {
        bresenham(cur.point[0], cur.point[1], nex.point[0], nex.point[1], set);
      }
    }
  }
  getContext(t: string) {
    return this;
  }
  clearRect(x: number, y: number, w: number, h: number) {
    quad(
      this._matrix,
      x,
      y,
      w,
      h,
      this.unset.bind(this),
      [0, 0, this.width, this.height],
    );
  }
  fillRect(x: number, y: number, w: number, h: number) {
    quad(
      this._matrix,
      x,
      y,
      w,
      h,
      this.set.bind(this),
      [0, 0, this.width, this.height],
    );
  }
  fill() {
    if (
      this._currentPath[this._currentPath.length - 1].point !==
        this._currentPath[0].point
    ) {
      this.closePath();
    }
    var vertices: number[] = [];
    this._currentPath.forEach(function (pt) {
      vertices.push(pt.point[0], pt.point[1]);
    });
    var triangleIndices = earcut(vertices);
    var p1, p2, p3;
    for (var i = 0; i < triangleIndices.length; i = i + 3) {
      p1 = [
        vertices[triangleIndices[i] * 2],
        vertices[triangleIndices[i] * 2 + 1],
      ];
      p2 = [
        vertices[triangleIndices[i + 1] * 2],
        vertices[triangleIndices[i + 1] * 2 + 1],
      ];
      p3 = [
        vertices[triangleIndices[i + 2] * 2],
        vertices[triangleIndices[i + 2] * 2 + 1],
      ];
      triangle(
        p1,
        p2,
        p3,
        this.set.bind(this),
        [0, 0, this.width, this.height],
      );
    }
  }
  toString() {
    return this.frame();
  }
  moveTo(x: number, y: number) {
    addPoint(this._matrix, this._currentPath, x, y, false);
  }
}

function addPoint(m: number, p: Path[], x: number, y: number, s: boolean) {
  var v = vec2.transformMat2d(vec2.create(), vec2.fromValues(x, y), m);
  p.push({
    point: [Math.floor(v[0]), Math.floor(v[1])],
    stroke: s,
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.round(Math.min(Math.max(value, min), max));
}/**
* Returns a Point type
**/

function br(p1: number[], p2: number[]) {
  return bresenham(
    Math.floor(p1[0]),
    Math.floor(p1[1]),
    Math.floor(p2[0]),
    Math.floor(p2[1]),
  );
}

/**
* Triangle
**/
function triangle(
  pointB: number[],
  pointA: number[],
  pointC: number[],
  f: any,
  clip: number[],
) {
  var a = br(pointB, pointC);
  var b = br(pointA, pointC);
  var c = br(pointA, pointB);

  var s = a.concat(b).concat(c)
    .filter(function (point) {
      return point.y < clip[3] && point.y > clip[1];
    })
    .sort(function (a, b) {
      if (a.y == b.y) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

  for (var i = 0; i < s.length - 1; i++) {
    var cur = s[i];
    var nex = s[i + 1];
    var left = Math.max(clip[0], cur.x);
    var right = Math.min(clip[2], nex.x);
    if (cur.y == nex.y) {
      for (var j = left; j <= right; j++) {
        f(j, cur.y);
      }
    } else {
      f(cur.x, cur.y);
    }
  }
}

/**
* Quadrilateral
**/
function quad(
  m: number,
  x: number,
  y: number,
  w: number,
  h: number,
  f: any,
  clip: number[],
) {
  var p1 = vec2.transformMat2d(vec2.create(), vec2.fromValues(x, y), m);
  var p2 = vec2.transformMat2d(vec2.create(), vec2.fromValues(x + w, y), m);
  var p3 = vec2.transformMat2d(vec2.create(), vec2.fromValues(x, y + h), m);
  var p4 = vec2.transformMat2d(vec2.create(), vec2.fromValues(x + w, y + h), m);
  triangle(p1, p2, p3, f, clip);
  triangle(p3, p2, p4, f, clip);
}