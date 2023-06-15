const puppeteer = require("puppeteer");
const fs = require("fs");
const API = require("./api");

module.exports = {
  fromCookies(cookies) {
    return new API(cookies);
  },
  fromFile(file) {
    return new API(JSON.parse(fs.readFileSync(file)));
  },
  async fromCredentials(username, password) {
    let browser = await puppeteer.launch({headless: "new"});
    try {
      const page = await browser.newPage();
      await page.goto("https://www.reddit.com/account/login/");
      await page.type('#loginUsername', username);
      await page.type('#loginPassword', password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation({'waitUntil': 'networkidle0'});
      return new API(await page.cookies());
    } finally {
      await browser.close();
    }
  },
  T1: require("./t1"),
  T2: require("./t2"),
  T3: require("./t3"),
  T4: require("./t4"),
  T5: require("./t5"),
  Listing: require("./listing")
};
