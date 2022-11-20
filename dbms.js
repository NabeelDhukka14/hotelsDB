const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require('uuid');
const app = express();
const { Client } = require("pg")

let loggedInUsers = new Map();
let validRoles = ['user', 'host', 'admin'];

port = 8080;

app.use(bodyParser.json());

app.listen(port);

console.log('Hotel RestWrapper API started on port:  ' + port);

const genUserId = () => {
  let digits = 7;
  let id = '';
  while(digits > 0){
    let rand = Math.floor((Math.random()*10)+1);
    id = id + (rand === 0 ? rand+1:rand);
    digits -= 1;
  }

  console.log("ID IS : ", id);
  return id;
}

const connectToDb = async () => {
  const client = new Client({
      user: 'hello',
      host: 'myDB',
      database: 'hotelsDb',
      password: 'world',
      port: 5432
  });
  
  await client.connect();

  return client;
}

app.post("/signUpUser", async function(req, res){

 let userType = req.body.userType;
 let name = req.body.name;
 let pass = req.body.password;
 

  console.log("USER TYPE: ", userType);
  if(!validRoles.includes(userType)){
    res.status(400).send("The 'role' you've provided is invalid. Please select either 'user' or 'host' as a role");
  }

  
  const client = await connectToDb();
  console.log("connected to db");
  let userId = genUserId();

  let isMatchingID = true;
  while(isMatchingID){
    let userLookup = await client.query('SELECT * FROM users WHERE name=$1',[userId]);
    if(userLookup.rowCount === 0){
      isMatchingID = false;
    }
    userId = genUserId();

  }

 

  console.log("UUID MADE: ",userId);
  let query = 'INSERT INTO users(userId, userType, name, password) VALUES($1,$2,$3,$4);';
  let values = [userId, userType, name, pass];
  console.log('BEGINNIGN QUERY');
  await client.query(query,values);  

  await client.end();
  console.log("done removing connection");
  res.status(200).send("succesfully signed you up.Your userId is "+userId+". Use this Id when loggin in.");
});


app.post("/loginUser", async function(req, res){
  let userId = req.body.userId;
  let pass = req.body.password;

  const client = await connectToDb();
  let userLookup = await client.query('SELECT * FROM users WHERE userId=$1',[userId]);
  console.log("userLookup: ", userLookup);

  if(userLookup.rows[0].password === pass){
    loggedInUsers.set(userId, true);
    res.status(200).send("Successfully logged in");
  }else{res.status(401).send("Unable to log you in. UserID and pass do not match");}

});

app.get("/getallusers", async function(req,res){
    
    const client = await connectToDb();
    const resp = await client.query('SELECT * FROM users;');
    await client.end();
    console.log("ROWS: ", resp.rows);
    res.status(200).send(resp.rows);
});


