/**
 * @file 动态拟合两个多边形
 */
class DynamicFit extends Base {
  /**
   * @description 动态拟合两个多边形
   * @param {object} map ol.Map
   * @param {object} options
   * <pre>
   *  color: "#0000CC66"//开始多边形的填充颜色
   *  endFillColor: 结束多边形的填充颜色
   *  endStrokeColor: 结束多边形的边框颜色
   *  endStrokeWidth: 结束多边形的边框宽度
   * </pre>
   * @author rzc <rzcgis@foxmail.com>
   * @class
   */
  constructor(map, options) {
    super(map, options);
    let color = options?.color ? options.color : "#0000CC66";
    this._vSource = new ol.source.Vector();
    this._vLayer = new ol.layer.Vector({
      source: this._vSource,
      style: new ol.style.Style({
        // 线样式
        stroke: new ol.style.Stroke({
          color: "#00000000",
          width: 0,
        }),
        //填充样式.
        fill: new ol.style.Fill({
          color: color,
        }),
      }),
    });
    this._map.addLayer(this._vLayer);
  }
  #polyStartOrg = null;
  #polyEndOrg = null;
  #polyStart = null;
  #polyEnd = null;
  #totalStepCnt = 200;
  #step = 0;
  #interval = null;
  #showEnd = false;
  #stepXs = [];
  #stepYs = [];
  #paused = false;
  /**
   * 起始点
   * @param {object} point
   */
  set startPoint(point) {
    const coord = point.getCoordinates();
    const coords = [[coord, coord, coord, coord]];
    const poly = new ol.geom.Polygon(coords);
    this.#polyStart = poly.clone();
    this.#polyStartOrg = poly.clone();
  }
  /**
   * 起始线
   * @param {object} line
   */
  set startLine(line) {
    const coords = line.getCoordinates();
    const poly = new ol.geom.Polygon([coords]);
    this.#polyStart = poly.clone();
    this.#polyStartOrg = poly.clone();
  }
  /**
   * 起始多边形
   * @param {object} poly
   */
  set startPolygon(poly) {
    this.#polyStart = poly.clone();
    this.#polyStartOrg = poly.clone();
  }

  /**
   * 起始的几何对象
   * @param {object} geometry
   */
  set startGeometry(geometry) {
    const type = geometry.getType();
    switch (type) {
      case "Point":
        this.startPoint = geometry;
        break;
      case "LineString":
        this.startLine = geometry;
        break;
      case "Polygon":
        this.startPolygon = geometry;
        break;
      default:
        throw "不支持的类型|not support geomtry type";
    }
  }

  /**
   * 最终点
   * @param {object} point
   */
  set endPoint(point) {
    const coord = point.getCoordinates();
    const coords = [[coord, coord, coord, coord]];
    const poly = new ol.geom.Polygon(coords);
    this.#polyEnd = poly.clone();
    this.#polyEndOrg = poly.clone();
  }
  /**
   * 最终线
   * @param {object} line
   */
  set endLine(line) {
    const coords = line.getCoordinates();
    const poly = new ol.geom.Polygon([coords]);
    this.#polyEnd = poly.clone();
    this.#polyEndOrg = poly.clone();
  }
  /**
   * 最终多边形
   * @param {object} poly
   */
  set endPolygon(poly) {
    this.#polyEnd = poly.clone();
    this.#polyEndOrg = poly.clone();
  }

  /**
   * 最终的几何对象
   * @param {object} geometry
   */
  set startGeometry(geometry) {
    const type = geometry.getType();
    switch (type) {
      case "Point":
        this.endPoint = geometry;
        break;
      case "LineString":
        this.endLine = geometry;
        break;
      case "Polygon":
        this.endPolygon = geometry;
        break;
      default:
        throw "不支持的类型|not support geomtry type";
    }
  }
  /**
   * @ignore
   * @param {object} poly
   * @param {Number} newStartIndex
   */
  reCreatePoly(poly, newStartIndex) {
    const coords = poly.getCoordinates()[0];
    for (let i = 0; i < newStartIndex; i++) {
      coords.push(coords[i]);
    }
    for (let i = 0; i < newStartIndex; i++) {
      coords.shift();
    }
    coords.push(coords[0]);
    poly.setCoordinates([coords]);
    const epsg4326 = "EPSG:4326";
    poly.transform(epsg4326, this.EPSG);
  }
  /**
   * @ignore
   */
  createStepRelation() {
    let nearestPointIndexStart = this.findNearestPoint(
      this.#polyStart,
      this.#polyEnd
    );
    let nearestPointIndexEnd = this.findNearestPoint(
      this.#polyEnd,
      this.#polyStart
    );
    this.reCreatePoly(this.#polyStart, nearestPointIndexStart);
    this.reCreatePoly(this.#polyEnd, nearestPointIndexEnd);

    const featEnd = new ol.Feature({
      geometry: this.#polyEnd,
      name: "end",
    });
    let endFillColor = this._options?.endFillColor
      ? this._options.endFillColor
      : "#00ff0066";
    let endStrokeColor = this._options?.endStrokeColor
      ? this._options.endStrokeColor
      : "rgba(13, 86, 252)";
    let endStrokeWidth = this._options?.endStrokeWidth
      ? this._options.endStrokeWidth
      : "rgba(13, 86, 252)";
    featEnd.setStyle(
      new ol.style.Style({
        fill: new ol.style.Fill({
          color: endFillColor,
        }),
        stroke: new ol.style.Stroke({
          color: endStrokeColor,
          width: endStrokeWidth,
        }),
      })
    );
    if (this.#showEnd) {
      this._vSource.addFeatures([featEnd]);
    }
    const featStart = new ol.Feature({
      geometry: this.#polyStart,
      name: "start",
    });
    this._vSource.addFeatures([featStart]);
  }
  /**
   * @ignore
   */
  getTargetIndex(fromIndex, from, to) {
    let res = Math.round((to / from) * fromIndex);
    if (res > to - 1) {
      res = to - 1;
    }
    return res;
  }
  /**
   * @ignore
   */
  dynamic() {
    this.#step++;
    const coordsStart = this.#polyStart.getCoordinates()[0];
    let lenStart = coordsStart.length;
    const coordsEnd = this.#polyEnd.getCoordinates()[0];
    const lenEnd = coordsEnd.length;
    if (lenStart <= lenEnd) {
      for (let i = 0; i < lenStart && lenStart < lenEnd; i++) {
        for (let j = 0; j < lenStart / lenEnd; j++) {
          coordsStart.splice(
            lenStart - 1 - i,
            0,
            coordsStart[lenStart - 1 - i]
          );
        }
      }
    }
    lenStart = coordsStart.length;
    for (let i = 0; i < lenStart; i++) {
      const targetIndex = this.getTargetIndex(i, lenStart, lenEnd);
      const targetCoord = coordsEnd[targetIndex];
      const srouceCoord = coordsStart[i];
      if (!targetCoord) {
        debugger;
      }
      if (this.#stepXs.length < lenStart || this.#stepYs.length < lenStart) {
        this.#stepXs[i] =
          (targetCoord[0] - srouceCoord[0]) / this.#totalStepCnt;
        this.#stepYs[i] =
          (targetCoord[1] - srouceCoord[1]) / this.#totalStepCnt;
      }
      const tmpX = srouceCoord[0] + this.#stepXs[i];
      const tmpY = srouceCoord[1] + this.#stepYs[i];
      const tmpCoord = [tmpX, tmpY];
      coordsStart[i] = tmpCoord;
    }
    this.#polyStart.setCoordinates([coordsStart]);
  }
  /**
   *
   * @param {object} opts 选项
   * <pre>
   *   支持`totalStepCnt`,总共的动画次数。50毫秒执行一次。
   *   支持`callback`,拟合完成的回到函数
   * </pre>
   */
  fit(opts, callback) {
    this.#paused = false;
    if (opts?.totalStepCnt) {
      this.#totalStepCnt = opts?.totalStepCnt;
    }
    if (opts?.showEnd === true) {
      this.#showEnd = true;
    }
    this.createStepRelation();
    const that = this;
    this.#interval = setInterval(() => {
      if (this.#paused) {
        return;
      }
      if (that.#step >= that.#totalStepCnt) {
        that.stopFit();
        for (let i = 0; i < this._vSource.getFeatures().length; i++) {
          const feat = this._vSource.getFeatures()[i];
          if (feat.getProperties().name === "start") {
            this._vSource.removeFeature(feat);
            break;
          }
        }
        if (typeof callback === "function") {
          callback(true);
        }
        return;
      }
      this.dynamic();
    }, 50);
  }
  /**
   * 清除图层
   */
  clear() {
    this._vSource.clear();
  }

  /**
   * 暂停
   */
  pause() {
    this.#paused = true;
  }

  cancelPause() {
    this.#paused = false;
  }
  /**
   * 停止拟合
   */
  stopFit() {
    if (this.#interval) {
      clearInterval(this.#interval);
    }
    this.#paused = false;
    this.#stepXs = [];
    this.#stepYs = [];
    this.#interval = null;
    this.#step = 0;
    this.#polyStart = this.#polyStartOrg.clone();
    this.#polyEnd = this.#polyEndOrg.clone();
  }
  /**
   * 查找第一个多边形中距离第二个多边形最近的点的序号
   * @param {object} polyTarget
   * @param {object} poly
   * @returns 序号
   * @ignore
   */
  findNearestPoint(polyTarget, poly) {
    const coords_Start = polyTarget.getCoordinates()[0];
    const coords_End = poly.getCoordinates()[0];
    let theIndex = -1;
    let tmpDis = Number.MAX_VALUE;
    for (let i = 0; i < coords_Start.length; i++) {
      const p1 = coords_Start[i];
      for (let j = 0; j < coords_End.length; j++) {
        const p2 = coords_End[j];
        const dx = p1[0] - p2[0];
        const dy = p1[1] - p2[1];
        const dis = Math.sqrt(dx * dx + dy * dy);
        if (dis < tmpDis) {
          tmpDis = dis;
          theIndex = i;
        }
      }
    }
    return theIndex;
  }
}
