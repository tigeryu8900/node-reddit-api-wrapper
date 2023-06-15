const fs = require("fs");
const {JSDOM} = require("jsdom");
const Listing = require("./listing");

module.exports = class API {
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

  async get(path, params, parser=null) {
    let res = await fetch("https://www.reddit.com" + path + '?' + params, {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "*/*",
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
    return parser ? res[parser]() : res.ok;
  }

  async post(path, body, parser=null) {
    if (!(body instanceof URLSearchParams)) {
      body = new URLSearchParams(body);
    }
    let now = Date.now();
    let res0 = await fetch("https://www.reddit.com", {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "text/html",
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
    let res = await fetch("https://oauth.reddit.com" + path, {
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
    return parser ? res[parser]() : res.ok;
  }

  async post2(path, body, parser=null) {
    if (!(body instanceof URLSearchParams)) {
      body = new URLSearchParams(body);
    }
    let res0 = await fetch("https://www.reddit.com/api/me.json", {
      method: "get",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "application/json",
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
    body.set("uh", (await res0.json())?.data?.modhash);
    let res = await fetch("https://www.reddit.com" + path, {
      method: "post",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
        "Accept": "*/*",
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
    return parser ? res[parser]() : res.ok;
  }

  // async gql(id, input, parser=null) {
  //   let now = Date.now();
  //   let res0 = await fetch("https://www.reddit.com", {
  //     method: "get",
  //     headers: {
  //       "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
  //       "Accept": "text/html",
  //       "Accept-Language": "en-US,en;q=0.5",
  //       "Upgrade-Insecure-Requests": "1",
  //       "Sec-Fetch-Dest": "document",
  //       "Sec-Fetch-Mode": "navigate",
  //       "Sec-Fetch-Site": "none",
  //       "Sec-Fetch-User": "?1",
  //       "Cookie": this.#prepareCookies()
  //     }
  //   });
  //   this.#setCookies(res0.headers.getSetCookie());
  //   let dom = new JSDOM(await res0.text()).window.document;
  //   let user = JSON.parse(dom.querySelector('#data').textContent.slice(14,-1)).user;
  //   let xRedditLoid = `${user.loid.loid}.${user.loid.version}.${user.loid.created}.${user.loid.blob}`;
  //   this.#setCookie({
  //     name: "loid",
  //     value: xRedditLoid,
  //     expires: now / 1000 + 34560000
  //   });
  //   this.#setCookie({
  //     name: "session_tracker",
  //     value: user.sessionTracker,
  //     expires: now / 1000 + 34560000
  //   });
  //   let res = await fetch("https://gql.reddit.com", {
  //     method: "post",
  //     headers: {
  //       "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/114.0",
  //       "Accept": "*/*",
  //       "Accept-Language": "en-US,en;q=0.5",
  //       "Content-Type": "application/json",
  //       "x-reddit-loid": xRedditLoid,
  //       "x-reddit-session": user.sessionTracker,
  //       "Sec-Fetch-Dest": "empty",
  //       "Sec-Fetch-Mode": "cors",
  //       "Sec-Fetch-Site": "same-site",
  //       "Authorization": `Bearer ${user.session.accessToken}`,
  //       "Cookie": this.#prepareCookies()
  //     },
  //     body: JSON.stringify({
  //       id,
  //       variables: {
  //         input
  //       }
  //     })
  //   });
  //   this.#setCookies(res.headers.getSetCookie());
  //   return parser ? res[parser]() : res.ok;
  // }

  async messages_inbox(options={}) {
    return Listing.fromPath(this, "/message/inbox.json", options);
  }

  async message_messages(options={}) {
    return Listing.fromPath(this, "/message/messages.json", options);
  }

  async message_comments(options={}) {
    return Listing.fromPath(this, "/message/comments.json", options);
  }

  async message_selfreply(options={}) {
    return Listing.fromPath(this, "/message/selfreply.json", options);
  }

  async message_unread(options={}) {
    return Listing.fromPath(this, "/message/unread.json", options);
  }

  async message_mention(options={}) {
    return Listing.fromPath(this, "/message/mention.json", options);
  }

  async comment(thing_id, text, options) {
    return this.post("/api/comment?" + new URLSearchParams({
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
    return this.post("/api/editusertext?" + new URLSearchParams({
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
    return this.post("/api/submit?" + new URLSearchParams({
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
    return this.post("/api/del?" + new URLSearchParams({
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
    return this.post("/api/vote?" + new URLSearchParams({
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

  async readMessage(id, options={}) {
    return this.post2("/api/read_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "read",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async readAllMessages(options={}) {
    return this.post2("/api/read_all_messages?embedded=true", new URLSearchParams({
      ...options
    }));
  }

  async unreadMessage(id, options={}) {
    return this.post2("/api/unread_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "unread",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async collapseMessage(id, options={}) {
    return this.post2("/api/collapse_message?embedded=true", new URLSearchParams({
      "id": id,
      "executed": "collapse",
      "embedded": "web2x",
      "renderstyle": "html",
      ...options
    }));
  }

  async uncollapseMessage(id, options={}) {
    return this.post2("/api/uncollapse_message?embedded=true",
        new URLSearchParams({
          "id": id,
          "executed": "uncollapse",
          "embedded": "web2x",
          "renderstyle": "html",
          ...options
        }));
  }

  async moreChildren(link_id, children) {
    return this.get("/api/morechildren", {
      "api_type": "json",
      "link_id": link_id,
      "children": children
    }, "json")?.json?.data?.things ?? [];
  }

  // async acceptModeratorInvite(subreddit) {
  //   return this.post(`/r/${subreddit}/accept_moderator_invite`, {});
  // }
  //
  // async approve(id) {
  //   return this.gql("660e0733e963", {id});
  // }
  //
  // async stickyComment(commentId, sticky) {
  //   return this.gql("236938d65d55", {commentId, sticky});
  // }
  //
  // async undistinguishComment(commentId, sticky) {
  //   return this.gql("e1f407c8ceba", {
  //     commentId,
  //     "distinguishState": "DISTINGUISHED",
  //     "distinguishType": "MOD_DISTINGUISHED"
  //   });
  // }
  //
  // async stickyPost(postId, sticky, toProfile=false) {
  //   return this.gql("13de9d1fcbe3", {postId, sticky, toProfile});
  // }
  //
  // async undistinguishComment(commentId, sticky) {
  //   return this.gql("e1f407c8ceba", {
  //     commentId,
  //     "distinguishState": "NONE",
  //     "distinguishType": "NONE"
  //   });
  // }
  //
  // async distinguishPost(postId) {
  //   return this.gql("e869489c84a4", {
  //     postId,
  //     "distinguishState": "DISTINGUISHED",
  //     "distinguishType": "MOD_DISTINGUISHED"
  //   });
  // }
  //
  // async undistinguishPost(postId) {
  //   return this.gql("e869489c84a4", {
  //     "input": {
  //       postId,
  //       "distinguishState": "NONE",
  //       "distinguishType": "NONE"
  //     }
  //   });
  // }
  //
  // async ignoreReports(id) {
  //   return this.post("/api/ignore_reports", {id});
  // }
  //
  // async remove(id) {
  //   return this.post("/api/remove", {id});
  // }
}
