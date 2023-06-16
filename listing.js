const assert = require("assert");
module.exports = class Listing {
  #api;
  #path;
  #options;
  #data;
  #linkId;

  constructor(obj, linkId) {
    assert.equal(obj.kind, "Listing", "Wrong kind.");
    this.#data = obj.data;
    this.#linkId = linkId;
  }

  static async fromPath(api, path, options={}) {
    let params = new URLSearchParams(options);
    let obj = await api.get(path, params, "json");
    let listing = new Listing(obj);
    listing.#api = api;
    listing.#path = path;
    listing.#options = options;
    return listing;
  }

  async *more(obj) {
    assert.equal(obj.kind, "more", "Wrong kind.");
    if (!this.#linkId) {
      return;
    }
    for (let thing of await this.#api.moreChildren(this.#data.children, this.#linkId)) {
      if (thing.kind === "more") {
        yield *this.more(thing);
      } else {
        yield require("./item").createItem(this.#api, thing);
      }
    }
  }

  *[Symbol.iterator](index=0) {
    for (let child of this.#data.children.slice(index)) {
      yield require("./item").createItem(this.#api, child);
    }
  }

  startAt(index, async=true) {
    return async ? this[Symbol.asyncIterator](index) : this[Symbol.iterator](index);
  }

  first() {
    return require("./item").createItem(this.#api, this.#data.children[0]);
  }

  async *[Symbol.asyncIterator](index=0) {
    let params = new URLSearchParams(this.#options);
    while (true) {
      try {
        if (index === this.#data?.children?.length) {
          if (!this.#data?.after) {
            return;
          } else {
            params.set("after", this.#data?.after);
            this.#data = (await this.#api.get(this.#path, params, "json")).data;
            index = 1;
          }
        }
        let child = this.#data?.children[index++];
        if (child.kind === "more") {
          yield* this.more(child);
        } else {
          yield require("./item").createItem(this.#api, child);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
}
