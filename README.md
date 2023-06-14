# node-redd-api-wrapper

This is an API wrapper for Reddit written in JavaScript.

## Initialization

```javascript
const NRAW = require("node-reddit-api-wrapper");

(async () => {
  // We can initialize the API using a JSON file.
  let api1 = NRAW.fromFile("./cookie-file.json");
  let cookies = [
    {
      "name": "someName",
      "value": "This is some cookie you've retrieved from puppeteer"
    }
  ];
  
  // We could also use cookies retrieved directly from Puppeteer.
  let api2 = NRAW.fromCookies(cookies);
  
  // Finally, we could use username and password to initialize the API.
  // Please don't hard code the credentials in your code
  // Remember to use await since this launches Puppeteer to authenticate.
  // This is the only time Puppeteer will be used.
  let api3 = await NRAW.fromCredentials("fake-roboragi", "very-secure-password");
  
  // We can also save the cookies for future use. Just use NRAW.fromFile() to load the cookies.
  api3.saveCookies("./cookies.json");
})().then(() => process.exit());
```

## Usage

```javascript
let api = NRAW.fromFile("./cookie-file.json");

// Other than message_unread(), there are message_inbox(), message_messages(), message_comments(),
// message_selfreply(), and message_mention(). Each of them retrieves messages based on their
// naming. For example, message_unread() retrieves unread messages.
for await (message of api.message_unread()) {
  // message here has the same structure as you would get from
  // https://www.reddit.com/message/unread.json, but with a few extra methods
  
  // mark as read
  await message.read();
  
  // mark as unread
  await message.unread();
  
  // collapse
  await message.collapse();
  
  // uncollapse
  await message.uncollapse();

  // upvote
  await message.vote(1);

  // downvote
  await message.vote(-1);

  // unvote
  await message.vote(0);
  
  // reply
  await message.reply("markdown text");
  
  // delete (only works if user is OP)
  await message.del();
}

// Each of the methods demonstrated above has a corresponding method in api.
// For example, to read a message given an id,
await api.readMessage("t1_000000");

// or leave a comment
await api.comment("t3_000000", "markdown text");

// There's also a method for submitting posts
await api.submit("subreddit_without_the_r_slash", "title", "some text", "self");
await api.submit("subreddit_without_the_r_slash", "title", "https://www.example.com", "link");
```
