const assert = require("assert");

module.exports = class T2 {
  #api;
  data;

  constructor(api, data) {
    assert.equal(data.kind, "t2", "Wrong kind.");
    this.#api = api;
    this.data = data.data;
  }
}
