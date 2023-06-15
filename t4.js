const assert = require("assert");

module.exports = class T4 {
  #api;
  data;

  constructor(api, data) {
    assert.equal(data.kind, "t4", "Wrong kind.");
    this.#api = api;
    this.data = data.data;
  }

  body() {
    return this.data.body();
  }

  async read() {
    return this.#api.readMessage(this.data.name);
  }

  async unread() {
    return this.#api.unreadMessage(this.data.name);
  }

  async collapse() {
    return this.#api.collapseMessage(this.data.name);
  }

  async uncollapse() {
    return this.#api.uncollapseMessage(this.data.name);
  }

  async del() {
    return this.#api.del(this.data.name);
  }
}
