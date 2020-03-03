// Library
const jwt = require('jsonwebtoken');
const request = require("request-promise");
const ssm = new (require('aws-sdk/clients/ssm'))();

exports.handler = async (message, context) => {

console.log(message);

  //パラメータ取得
  const PS = await getParameters();

  const PEM=PS.get(process.env["PSKEY_PEM"]);
  const API_ID=PS.get(process.env["PSKEY_API_ID"]);
  const SERVER_ID=PS.get(process.env["PSKEY_SERVER_ID"]);
  const SERVER_CONSUMER_KEY=PS.get(process.env["PSKEY_SERVER_CONSUMER_KEY"]);

  const BOT_NO=PS.get(process.env["PSKEY_BOT_NO"]);
  const ROOM_ID=PS.get(process.env["PSKEY_ROOM_ID"]);
  const ACCOUNT_ID=PS.get(process.env["PSKEY_ACCOUNT_ID"]);

  const TOKEN_URL=`https://auth.worksmobile.com/b/${API_ID}/server/token`;
  const SEND_URL=`https://apis.worksmobile.com/r/${API_ID}/message/v1/bot/${BOT_NO}/message/push`;
  const BOTINFO_URL=`https://apis.worksmobile.com/r/${API_ID}/message/v1/bot/${BOT_NO}`;

  // メッセージ送信
  const serverToken = await getServerToken(SERVER_ID,PEM,TOKEN_URL);
  return await sendMessage(SEND_URL, BOTINFO_URL, SERVER_CONSUMER_KEY, serverToken, BOT_NO, ROOM_ID, ACCOUNT_ID, message.message.text);
  
};

async function getParameters(){

  const params = await ssm.getParameters({
        "Names": [
            process.env["PSKEY_PEM"]
          , process.env["PSKEY_API_ID"]
          , process.env["PSKEY_SERVER_ID"]
          , process.env["PSKEY_SERVER_CONSUMER_KEY"]
          , process.env["PSKEY_BOT_NO"]
          , process.env["PSKEY_ROOM_ID"]
          , process.env["PSKEY_ACCOUNT_ID"]
        ],
        "WithDecryption": true
      }).promise();

  let ps = new Map();
  for (let v of params.Parameters){
    ps.set(v.Name, v.Value);
  }

  return ps;
}
 
 
async function getJwt(iss, private_key) {

    const iat = Math.floor(Date.now() / 1000); // msec-> sec
    const exp = iat + (60 * 30); // 30分後
    let token = jwt.sign({
        iss: iss,
        iat: iat,
        exp: exp
    }, private_key, {algorithm: 'RS256'});
    return token;
}

async function getServerToken(iss, private_key, token_url) {
  const jwtoken = await getJwt(iss, private_key);
  console.log("jwtoken: " + jwtoken);
  console.log("TOKEN_URL: " + token_url);

  const headers = {
      "Content-type": "application/x-www-form-uelencoded; charset=UTF-8"
  };
  const options = {
      url : token_url,
      method : "POST",
      headers : headers,
      form : {
          "grant_type": encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer"),
          "assertion" : jwtoken
      },
      json : true
  };

  return request(options)
      .then((body) => {
          console.log("getServerToken:" + JSON.stringify(body));
          return body.access_token;
  });
}

async function sendMessage(sendUrl, botinfoUrl, consumerKey, serverToken, bot_no, room_id, account_id, org_msg) {

  const headers = {
      "Content-type": "application/json; charset=UTF-8",
      "consumerKey": consumerKey,
      "Authorization": "Bearer " + serverToken
  };

  //get Account IDS
  const options1 = {
    url : botinfoUrl,
    method : "GET",
    headers : headers,
  };
  const result = await request(options1);
  const accountIds = JSON.parse(result).domainInfos[0].accountIds;

  for (let id of accountIds){
  //push Messages
    let options2 = {
    url : sendUrl,
    method : "POST",
    headers : headers,
    json : {
        "botNo": Number(bot_no),
  //      "roomId": room_id,
        "accountId": id,
        "content": {
            "type": "text",
            "text": org_msg
        }
      }
    };
    
    await request(options2).then((body) => {
  //      if (body.code != 200) {
  //          console.error("sendMessage error: " + JSON.stringify(body));
  //          throw new Error(body.errorMessage);
  //      }
        console.log("sendMessage success: " + JSON.stringify(body));
    }).catch((err) => {
        switch(err.statusCode){
        case 404:
            console.error("sendMessage error: 404 Not Found");
            break;
        default:
            console.error("sendMessage error: " + JSON.stringify(err));
            break;
        }    
    });
      
  }
  
  return "finish";

}