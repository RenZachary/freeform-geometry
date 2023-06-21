class Base {
  _map = null;
  _options = null;
  /**
   * 所有工具类的基类
   * @param {object} map ol.Map
   * @param {object} options objects
   */
  constructor(map, options) {
    this._map = map;
    this.defaultOptions(options);
  }
  defaultOptions(options){
    this._options = options || {};
  }
  /**
   * 当前地图的坐标系
   */
  get EPSG(){
    return this._map.getView().getProjection().getCode();
  }
}
