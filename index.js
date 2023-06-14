const puppeteer = require("puppeteer");
const { JSDOM } = require("jsdom");
const fs = require("fs");

module.exports = class API {
  static #browser;
  #cookies;

  constructor(cookies) {
    this.#cookies = cookies;
  }

  #prepareCookies() {
    let now = Date.now() / 1000;
    this.#cookies = this.#cookies.filter(cookie => cookie.expires === -1 || cookie.expires > now);
    return this.#cookies.map(({name, value}) => `${name}=${value}`).join("; ");
  }

  #getCookie(name) {
    return this.#cookies.find(cookie => cookie.name === name);
  }

  #setCookie(cookie) {
    if (typeof cookie == "string" || cookie instanceof String) {
      let attributes = cookie.split(/\s*;\s*/);
      let first = attributes.shift();
      let [_, name, value] = first.match(/([^=]*)=(.*)/);
      cookie = {
        "name": name,
        "value": value,
        "domain": ".reddit.com",
        "path": "/",
        "expires": -1,
        "size": name.length + value.length,
        "httpOnly": null,
        "secure": /^__(?:Secure|Host)-/.test(name),
        "session": true,
        "sameParty": false,
        "sourceScheme": "Secure",
        "sourcePort": 443
      };
      cookie = attributes.reduce((acc, str) => {
        let [_, k, v] = str.match(/([^=]*)(?:=(.*))?/)
        switch (k.toLowerCase()) {
          case "domain": return {...acc, "domain": v};
          case "expires": return {...acc, "expires": new Date(v).valueOf() / 1000};
          case "max-age": return {...acc, "expires": Date.now() / 1000 + parseFloat(v)};
          case "partitioned": return {...acc, "partitioned": true};
          case "path": return {...acc, "path": v};
          case "secure": return {...acc, "Secure": true};
          case "samesite": return {...acc, "sameParty": v};
          default: return {...acc, k: v};
        }
      });
    }
    let oldCookie = this.#getCookie(cookie.name);
    if (oldCookie) {
      if (cookie.value) {
        Object.assign(oldCookie, cookie);
      } else {
        this.#cookies.splice(this.#cookies.indexOf(oldCookie), 1);
      }
    } else {
      this.#cookies.push(cookie);
    }
  }

  #setCookies(cookies) {
    for (let cookie of cookies) {
      this.#setCookie(cookie);
    }
  }

  saveCookies(file) {
    fs.writeFileSync(file, JSON.stringify(this.#cookies));
  }

  async #get(path, params, parser="json") {
    let res = await fetch("https://www.reddit.com" + path + '?' + params, {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cookie": this.#prepareCookies()
      },
    });
    this.#setCookies(res.headers.getSetCookie());
    return res[parser]();
  }

  static Item = class Item {
    #api;

    constructor(api, data) {
      this.#api = api;
      Object.assign(this, data);
    }

    async read() {
      return this.#api.readMessage(this?.data?.name);
    }

    async unread() {
      return this.#api.unreadMessage(this?.data?.name);
    }

    async collapse() {
      return this.#api.collapseMessage(this?.data?.name);
    }

    async uncollapse() {
      return this.#api.uncollapseMessage(this?.data?.name);
    }

    async vote(dir) {
      return this.#api.vote(this?.data?.name, dir);
    }

    async reply(text, options={}) {
      return this.#api.comment(this?.data?.name, text, options);
    }

    async del() {
      return this.#api.del(this?.data?.name);
    }
  };

  static Listing = class Listing {
    #api;
    #path;
    #options;

    constructor(api, path, options) {
      this.#api = api;
      this.#path = path;
      this.#options = options;
    }

    async *[Symbol.asyncIterator]() {
      let params = new URLSearchParams(this.#options);
      let data = await this.#api.#get(this.#path, params);
      let index = 0;
      while (true) {
        if (index === data?.data?.children?.length) {
          if (data?.data?.after === null) {
            return;
          } else {
            params.set("after", data?.data?.after);
            data = await this.#api.#get(this.#path, params);
            index = 1;
          }
        }
        yield new API.Item(this.#api, data?.data?.children[index++]);
      }
    }
  }

  messages_inbox(options={}) {
    return new API.Listing(this, "/message/inbox.json", options);
  }

  message_messages(options={}) {
    return new API.Listing(this, "/message/messages.json", options);
  }

  message_comments(options={}) {
    return new API.Listing(this, "/message/comments.json", options);
  }

  message_selfreply(options={}) {
    return new API.Listing(this, "/message/selfreply.json", options);
  }

  message_unread(options={}) {
    return new API.Listing(this, "/message/unread.json", options);
  }

  message_mention(options={}) {
    return new API.Listing(this, "/message/mention.json", options);
  }

  async #post(path, body, ctx="/", parser="json") {
    let now = Date.now();
    let res0 = await fetch("https://www.reddit.com" + ctx, {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cookie": this.#prepareCookies()
      }
    });
    this.#setCookies(res0.headers.getSetCookie());
    let dom = new JSDOM(await res0.text()).window.document;
    let user = JSON.parse(dom.querySelector('#data').textContent.slice(14,-1)).user;
    let xRedditLoid = `${user.loid.loid}.${user.loid.version}.${user.loid.created}.${user.loid.blob}`;
    this.#setCookie({
      name: "loid",
      value: xRedditLoid,
      expires: now / 1000 + 34560000
    });
    this.#setCookie({
      name: "session_tracker",
      value: user.sessionTracker,
      expires: now / 1000 + 34560000
    });
    let res = await fetch("https://oauth.reddit.com/api" + path, {
      method: "post",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-reddit-loid": xRedditLoid,
        "x-reddit-session": user.sessionTracker,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Authorization": `Bearer ${user.session.accessToken}`,
        "Cookie": this.#prepareCookies()
      },
      body: body
    });
    this.#setCookies(res.headers.getSetCookie());
    return res[parser]();
  }

  async comment(thing_id, text, options) {
    return this.#post("/comment?" + new URLSearchParams({
      "rtj": "only",
      "emotes_as_images": true,
      "redditWebClient": "desktop2x",
      "app": "desktop2x-client-production",
      "raw_json": 1,
      "gilding_detail": 1
    }), new URLSearchParams({
      "api_type": "json",
      "return_rtjson": true,
      "thing_id": thing_id,
      "text": text,
      ...options
    }));
  }

  async editusertext(thing_id, text, options={}) {
    return this.#post("/editusertext?" + new URLSearchParams({
      "rtj": "only",
      "emotes_as_images": true,
      "redditWebClient": "desktop2x",
      "app": "desktop2x-client-production",
      "raw_json": 1,
      "gilding_detail": 1
    }), new URLSearchParams({
      "api_type": "json",
      "return_rtjson": true,
      "thing_id": thing_id,
      "text": text,
      ...options
    }));
  }

  async submit(sr, title, body, kind="self", options={}) {
    return this.#post("/submit?" + new URLSearchParams({
      "resubmit": true,
      "redditWebClient": "desktop2x",
      "app": "desktop2x-client-production",
      "raw_json": 1,
      "gilding_detail": 1
    }), new URLSearchParams({
      "sr": sr,
      "submit_type": "subreddit",
      "api_type": "json",
      "show_error_list": true,
      "title": title,
      "spoiler": false,
      "nsfw": false,
      "kind": kind,
      "original_content": false,
      "post_to_twitter": false,
      "sendreplies": true,
      ...({
        link: { "url": body }
      })[kind] ?? { "text": body },
      "text": body,
      "url": body,
      "validate_on_submit": true,
      ...options
    }));
  }

  async del(id, options={}) {
    return this.#post("/del?" + new URLSearchParams({
      "rtj": "only",
      "emotes_as_images": true,
      "redditWebClient": "desktop2x",
      "app": "desktop2x-client-production",
      "raw_json": 1,
      "gilding_detail": 1
    }), new URLSearchParams({
      "id": id,
      ...options
    }));
  }

  async vote(id, dir, options={}) {
    return this.#post("/del?" + new URLSearchParams({
      "rtj": "only",
      "emotes_as_images": true,
      "redditWebClient": "desktop2x",
      "app": "desktop2x-client-production",
      "raw_json": 1,
      "gilding_detail": 1
    }), new URLSearchParams({
      "id": id,
      "dir": dir,
      ...options
    }));
  }

  async #post2(path, body, parser="json") {
    let res0 = await fetch("https://www.reddit.com/api/me.json", {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cookie": this.#prepareCookies()
      }
    });
    this.#setCookies(res0.headers.getSetCookie());
    body.set("uh", JSON.parse(await res0.text())?.data?.modhash);
    let res = await fetch("https://www.reddit.com/api" + path, {
      method: "post",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Cookie": this.#prepareCookies()
      },
      body: body
    });
    this.#setCookies(res.headers.getSetCookie());
    return res[parser]();
  }

  async readMessage(id, options={}) {
    return this.#post2("/read_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "read",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async readAllMessages(options={}) {
    return this.#post2("/read_all_messages?embedded=true", new URLSearchParams({
      ...options
    }), "text");
  }

  async unreadMessage(id, options={}) {
    return this.#post2("/unread_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "unread",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async collapseMessage(id, options={}) {
    return this.#post2("/collapse_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "collapse",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async uncollapseMessage(id, options={}) {
    return this.#post2("/uncollapse_message?embedded=true",
      new URLSearchParams({
        "id": id,
        "executed": "uncollapse",
        "embedded": "web2x",
        "renderstyle": "html",
        ...options
      }));
  }

  static fromCookies(cookies) {
    return new API(cookies);
  }

  static fromFile(file) {
    return new API(JSON.parse(fs.readFileSync(file)));
  }

  static async fromCredentials(username, password, keepalive=false) {
    this.#browser ??= await puppeteer.launch({headless: "new"});
    const page = await this.#browser.newPage();
    try {
      await page.goto("https://www.reddit.com/account/login/");
      await page.type('#loginUsername', username);
      await page.type('#loginPassword', password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({'waitUntil': 'networkidle0'});
      return new API(await page.cookies());
    } finally {
      if (!keepalive) {
        await this.#browser.close();
      } else {
        await page.close();
      }
    }
  }
};
