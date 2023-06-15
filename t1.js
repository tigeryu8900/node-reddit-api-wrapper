const assert = require("assert");
const Listing = require("./listing");
module.exports = class T1 {
  #api;
  data;

  constructor(api, data) {
    assert.equal(data.kind, "t1", "Wrong kind.");
    this.#api = api;
    this.data = data.data;
  }

  body() {
    return this.data.body();
  }

  isComplete() {
    return this.data.hasOwnProperty("permalink");
  }

  async getComplete() {
    return this.isComplete() ? this : new T1(this.#api, await this.#api.get(this.#api,
        this.data.context.slice(0, this.data.context.indexOf('?')) + ".json"));
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

  async vote(dir) {
    return this.#api.vote(this.data.name, dir);
  }

  async reply(text, options = {}) {
    return this.#api.comment(this.data.name, text, options);
  }

  async replies() {
    let data = await this.getComplete().data;
    if (!data.replies) {
      return null;
    }
    return new Listing(data.replies, data.link_id);
  }

  async del() {
    return this.#api.del(this.data.name);
  }
}