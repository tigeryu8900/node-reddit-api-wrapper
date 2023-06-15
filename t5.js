const assert = require("assert");

module.exports = class T5 {
  #api;
  data;

  constructor(api, data) {
    assert.equal(data.kind, "t5", "Wrong kind.");
    this.#api = api;
    this.data = data.data;
  }
}
