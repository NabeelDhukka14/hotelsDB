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

const isLoggedIn = (userId) => {
  if(!loggedInUsers.has(userId)){
    return false;
  }else{
    return true;
  }

}


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

  if(userLookup.rowCount > 0 && userLookup.rows[0].password === pass){
    loggedInUsers.set(userId, true);
    res.status(200).send("Successfully logged in");
  }else if(userLookup.rowCount === 0){
    res.status(401).send("UserId does not exist. Please sign up for an account");
  }
  else{res.status(401).send("Unable to log you in. UserID and pass do not match");}

});

app.get("/getallusers", async function(req,res){
    
    const con = await connectToDb();
    const resp = await con.query('SELECT * FROM users;');
    await con.end();
    console.log("ROWS: ", resp.rows);
    await con.end();
    res.status(200).send(resp.rows);
});

//THIS ENDPOINT IS WORK IN PROGRESS
app.post('/checkavailability', async function(req, res){
  const userId = req.body.userId;
  // if(!isLoggedIn(userId)){
  //   res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
  // }

  let start = req.body.startDate;
  let end = req.body.endDate; 

  const con = await connectToDb();
  const avail = await con.query('SELECT * FROM (SELECT p.hostname, p.hostid, p.listingid, p.listingname, p.city, p.numbeds, p.price, p.minimumnights,p.maxpeople,p.roomsize,p.state, r.startDate,r.endDate FROM properties p LEFT OUTER JOIN reservations r ON p.listingid = r.listingid WHERE status=$1 AND endDate>=$2) AS existingRes WHERE listingid=$3;',['BOOKED',start,listingId]);
  // p LEFT OUTER JOIN reservations r ON p.listingid = r.listingid
  // const avail = await con.query('SELECT * FROM properties;');
  await con.end();
  res.status(200).send(avail.rows);
});


app.post('/makeReservation', async function(req,res){
  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
  }

  let start = req.body.startDate;
  let end = req.body.endDate; 
  let listing = req.body.listingId;
  let resId = uuidv4();
  let numGuests = req.body.numGuests;


  const con = connectToDb();
  const checkListing = await con.query('SELECT * FROM properties WHERE ListingId=$1;',[listing])
  if(checkListing.rowCount === 0){app.status(404).send("The listing Id you have provided is invalid. No such listing could be found");}
  else if(numGuests > checkListing.rows[0].maxPeople){
    res.status(400).send("The selected listing can hold a maximum of "+checkListing.rows[0].maxPeople+" guests. Please update your number of guests");
  }

  //TODO: compare against existing reservations to see if this one is valid. Start vs End date. 
  // const avail = await con.query('SELECT * FROM (SELECT p.hostname, p.hostid, p.listingid, p.listingname, p.city, p.numbeds, p.price, p.minimumnights,p.maxpeople,p.roomsize,p.state, r.startDate,r.endDate FROM properties p LEFT OUTER JOIN reservations r ON p.listingid = r.listingid WHERE status=$1 AND endDate>=$2) AS existingRes WHERE listingid=$3;',['BOOKED',start,listing]);
  const avail = await con.query('SELECT * FROM reservations WHERE status=$1 AND listingid=$2 AND endDate<=$3',['BOOKED',listing,start]);
  if(avail.rowCount >0 ){
    res.status(400).send("Sorry the listing you've requested is already booked for your specified start time.");
  }
  await con.query('INSERT INTO reservations(reservationId, startDate, endDate, status, listingId, userid, numGuests) VALUES($1,$2,$3,$4,$5,$6,$7)',[resId,start,end,"Booked",listing,userId, numGuests]);
  await con.end();
  res.status(200).send("Successfully created your reservation. Your reservationId is "+resId);
});



//Properties 

// hostname 
// hostid 
// ListingId 
// listingname/hotel 
// city 
// numBeds 
// price 
// Minimum_nights 
// maxPeople 
//  state 
// roomSize 



// Reservations  
// ReservationId 
// startDate 
// endDate 
// Status 
// listingId 
// userId 
// numGuests


