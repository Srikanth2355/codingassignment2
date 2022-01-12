const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const path = require("path");
const dbpath = path.join(__dirname, "twitterClone.db");

let db = null;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const connectdnandstartserver = async () => {
  try {
    db = await open({ filename: dbpath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server started at port 3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
connectdnandstartserver();

//register
app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const query = `select * from user where username='${username}';`;
  const responsedb = await db.get(query);
  if (responsedb !== undefined) {
    res.status(400);
    res.send("User already exists");
  } else {
    if (password.length < 6) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const hashedpassword = await bcrypt.hash(password, 10);
      const createdquery = `INSERT INTO user(name,username,password,gender) 
        VALUES(
            '${name}',
            '${username}',
            '${hashedpassword}',
            '${gender}');`;
      const dbresponse = await db.run(createdquery);
      res.status(200);
      res.send("User created successfully");
    }
  }
});

//login
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const query = `select * from user where username='${username}';`;
  const responsedb = await db.get(query);
  if (responsedb === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const checkpassword = await bcrypt.compare(password, responsedb.password);
    if (checkpassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "srikanth");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});
//authenticate token
const authenticate = (req, res, next) => {
  let jwtToken;
  const authheaders = req.headers["authorization"];
  if (authheaders !== undefined) {
    jwtToken = authheaders.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "srikanth", (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        req.username = payload.username;
        next();
      }
    });
  }
};

const feed = (obj) => {
  return {
    username: obj.username,
    tweet: obj.tweet,
    dateTime: obj.date_time,
  };
};
app.get("/user/tweets/feed/", authenticate, async (req, res) => {
  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const dbuser = await db.get(query);
  const id = dbuser.user_id;
  //user.username,tweet.tweet,tweet.date_time
  //left join tweet on  T.following_user_id =user.user_id
  //   order by date_time
  //  limit 20
  //   following_user_id in (select user_id from user left join follower on user_id=following_user_id
  // where follower_user_id=3)
  const updatedquery = `select
   username,tweet,date_time
   from
     (user left join follower on user_id = follower_user_id) AS T
     left join tweet on T.user_id = tweet.user_id
     
     where 
  following_user_id =5
      AND tweet.user_id in (select user_id from user left join follower on 
        user_id=following_user_id where follower_user_id=5)
     order by date_time DESC
     limit 4;`;
  const responsedb = await db.all(updatedquery);
  res.send(responsedb.map((obj) => feed(obj)));
});

//names of ppl whom the user follows
app.get("/user/following/", authenticate, async (req, res) => {
  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const dbuser = await db.get(query);
  const id = dbuser.user_id;
  const followquery = `select name from user left join follower on user_id = following_user_id
    where follower_user_id = ${id};`;
  const responsedb = await db.all(followquery);
  res.send(responsedb);
});

//names of ppl whom the user follows
app.get("/user/followers/", authenticate, async (req, res) => {
  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const dbuser = await db.get(query);
  const id = dbuser.user_id;
  const followquery = `select name from user left join follower on user_id = follower_user_id
    where following_user_id = ${id};`;
  const responsedb = await db.all(followquery);
  res.send(responsedb);
});

//tweets
app.get("/tweets/:tweetId", authenticate, async (req, res) => {
  const { tweetId } = req.params; // 1

  //id of tweeted person
  const findidoftweetperson = `select * from tweet where tweet_id=${tweetId};`;
  const gettweetpersonid = await db.get(findidoftweetperson);
  const Idoftweetedperson = gettweetpersonid.user_id; //1
  const tweet = gettweetpersonid.tweet;
  //   console.log(tweet);
  const datetime = gettweetpersonid.date_time;
  //   console.log(datetime);
  //   console.log(Idoftweetedperson);

  //id of tweet requested person
  const { username } = req;
  const findidoftweetrequestedperson = `select * from user where username='${username}';`;
  const gettweetrequestedpersonid = await db.get(findidoftweetrequestedperson);
  const idoftweetrequestedperson = gettweetrequestedpersonid.user_id;
  //   console.log(idoftweetrequestedperson); //2

  //check loggedin person follows the person whose id is requested
  const checkfollowpersonquery = `select * from user left join follower on user_id = following_user_id where
  follower_user_id=${idoftweetrequestedperson} AND following_user_id=${Idoftweetedperson}`;
  const checkedstatus = await db.get(checkfollowpersonquery);
  //   console.log(checkedstatus);

  //   if (checkedstatus.follower_user_id == idoftweetrequestedperson)
  if (checkedstatus !== undefined) {
    // res.send("following");
    const replies = `select count(DISTINCT reply_id) as replies from reply where tweet_id=${tweetId};`;
    const repliesresult = await db.get(replies);
    const result = repliesresult.replies; //3
    // console.log(result);
    const likes = `select count(DISTINCT like_id) as likes from like where tweet_id=${tweetId};`;
    const likescount = await db.get(likes);
    const likesresult = likescount.likes;
    // console.log(likescount.likes);
    res.send(`{
    "tweet": "${tweet}",
    "likes": ${likesresult},
    "replies": ${result},
    "dateTime": ${datetime}
    }`);
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

//likes
app.get("/tweets/:tweetId/likes", authenticate, async (req, res) => {
  const { tweetId } = req.params;
  //id of tweeted person
  const findidoftweetperson = `select * from tweet where tweet_id=${tweetId};`;
  const gettweetpersonid = await db.get(findidoftweetperson);
  const Idoftweetedperson = gettweetpersonid.user_id; //1

  //id of tweet requested person
  const { username } = req;
  const findidoftweetrequestedperson = `select * from user where username='${username}';`;
  const gettweetrequestedpersonid = await db.get(findidoftweetrequestedperson);
  const idoftweetrequestedperson = gettweetrequestedpersonid.user_id;

  //check whether the person is following
  const query = `select * from user left join follower on user_id = following_user_id where
  follower_user_id =${idoftweetrequestedperson}  AND following_user_id = ${Idoftweetedperson};`;

  const responsedb = await db.all(query);
  //   res.send(responsedb);
  if (responsedb.length == 0) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    const successquery = `select username from user natural join like where tweet_id = ${tweetId};`;
    const result = await db.all(successquery);
    const empty = result.map((obj) => obj.username);
    // console.log(result);
    // console.log(username);
    // console.log(empty);
    res.send(`{"likes": [${empty}]}`);
  }
});

//replies
app.get("/tweets/:tweetId/replies/", authenticate, async (req, res) => {
  const { tweetId } = req.params;
  //id of tweeted person
  const findidoftweetperson = `select * from tweet where tweet_id=${tweetId};`;
  const gettweetpersonid = await db.get(findidoftweetperson);
  const Idoftweetedperson = gettweetpersonid.user_id; //1

  //id of tweet requested person
  const { username } = req;
  const findidoftweetrequestedperson = `select * from user where username='${username}';`;
  const gettweetrequestedpersonid = await db.get(findidoftweetrequestedperson);
  const idoftweetrequestedperson = gettweetrequestedpersonid.user_id;

  //check whether the person is following
  const query = `select * from user left join follower on user_id = follower_user_id where
  follower_user_id =${idoftweetrequestedperson}  AND following_user_id = ${Idoftweetedperson};`;

  const responsedb = await db.all(query);
  //   res.send(responsedb);
  if (responsedb.length == 0) {
    res.status(401);
    res.send("Invalid Request");
  } else {
    const successquery = `select name,reply from user natural join reply where tweet_id = ${tweetId};`;
    const result = await db.all(successquery);
    // res.send(result);
    res.send(`{"replies": [${result}]}`);
  }
});

const usertweets = (obj) => {
  return {
    tweet: obj.tweet,
    likes: obj.likes,
    replies: obj.replies,
    dateTime: obj.date_time,
  };
};

//user tweets
app.get("/user/tweets", authenticate, async (req, res) => {
  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const queryresult = await db.get(query);
  const loggedinuserid = queryresult.user_id;
  //   console.log(loggedinuserid);
  const query1 = `select tweet,count(DISTINCT like_id) as likes,count(DISTINCT reply_id) as replies,tweet.date_time from (
        tweet left join like on tweet.tweet_id=like.tweet_id) as T left join reply on T.tweet_id=reply.tweet_id 
        where tweet.tweet_id in (select tweet_id from tweet where user_id = ${loggedinuserid}) 
        group by tweet.tweet_id;`;
  const resultquery1 = await db.all(query1);
  res.send(resultquery1.map((obj) => usertweets(obj)));
});

//create tweets
app.post("/user/tweets", authenticate, async (req, res) => {
  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const responsedb = await db.get(query);
  const user_id = responsedb.user_id;
  const { tweet } = req.body;
  const insertquery = `insert into tweet(tweet,user_id) values('${tweet}',${user_id})`;
  const result = await db.run(insertquery);
  res.send("Created a Tweet");
});

//delete tweet
app.delete("/tweets/:tweetId/", authenticate, async (req, res) => {
  const { tweetId } = req.params;
  const getuserid = `select * from tweet where tweet_id=${tweetId};`;
  const responsedb = await db.get(getuserid);
  const user_id = responsedb.user_id;

  const { username } = req;
  const query = `select * from user where username='${username}';`;
  const queryresult = await db.get(query);
  const loggedinuserid = queryresult.user_id;
  if (user_id == loggedinuserid) {
    const deletequery = `delete from tweet where tweet_id=${tweetId};`;
    const responseresult = await db.run(deletequery);
    // res.send(responseresult.map((obj) => obj.tweet_id));
    res.send("Tweet Removed");
  } else {
    res.status(401);
    res.send("Invalid Request");
  }
});

module.exports = app;
