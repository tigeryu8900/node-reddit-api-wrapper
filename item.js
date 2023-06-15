const T1 = require("./t1");
const T2 = require("./t2");
const T3 = require("./t3");
const T4 = require("./t4");
const T5 = require("./t5");

module.exports = {
  createItem(api, data) {
    switch (data.kind) {
      case "t1":
        return new T1(api, data);
      case "t2":
        return new T2(api, data);
      case "t3":
        return new T3(api, data);
      case "t4":
        return new T4(api, data);
      case "t5":
        return new T5(api, data);
      default:
        return data;
    }
  }
};
