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

app.post('/updateReservation', async function(req,res){
  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
  }

  const resId = req.body.reservationId;
  const start = req.body.start; 
  const end = req.body.end; 
  const status = req.body.status; 
  const numGuests = req.body.numGuests;
  let listing = req.body.listingId;

  if(listing != undefined && status != 'CANCELED'){
    res.status(400).send("sorry cannot update the property listing for this reservation. To do this, please cancel this reservation and create a new reservation for the new desired property listing.");
  }

  if(numGuests != undefined){
    const listingRow = await con.query('SELECT * FROM properties WHERE listingid=$1',[resProps.get("listingid")]);
    if(listingRow.rowCount > 0 && listingRow.rows[0].maxPeople < numGuests){
      res.status(400).send("The number of Guests you have requested exeeds the amount of guests this property listing can host. Cannot update this reservation to these specifications");
    }
  }

  const con = await connectToDb();
  const reservation = await con.query('SELECT * FROM reservations WHERE reservationid=$1;',[resId]);
  if(reservation.rowCount === 0){res.status(404).send("Could not find reservation with the provided reservation Id. Please provide a different resrvation Id");}

  const resProps = new Map();
  resProps.set("start", start === undefined ? reservation[0].startDate : start)
  resProps.set("end", end === undefined ? reservation[0].endDate : end)
  resProps.set("status", status === undefined ? reservation[0].status : status)
  resProps.set("numGuests", numGuests === undefined ? reservation[0].numGuests : numGuests)
  resProps.set("listingid", reservation[0].listingid)
  
  if(start != undefined || end != undefined){
    //TODO 
    let d1 = new Date(resProps.get('start'));
    let d2 = new Date(resProps.get('end'));
    if(d1.getTime() > d2.getTime()){
      res.status(400).send("Your Start date cannot be after your End Date");
    }
    else{
      const startandEnd = await con.query('SELECT startDate, endDate FROM reservations WHERE reservationid=$1 AND startDate>=$2 AND endDate<=$3', [resId,start,end]);
      if(startandEnd.rowCount > 0){
        await con.end();
        res.status(400).send({
          "msg":"You cannot update your reservation for this startDate - endDate range, because of conflicts with existing resrvations. Please select a date range that does not conflict with the ones provided below",
          "unavailableDates": startandEnd.rows
        });
      }
    }


  } 
  
  await con.query('UPDATE reservations SET status=$1, numGuests=$2 , startDate=$3, endDate=$4 WHERE reservationid=$5',[resProps.get("status"),resProps.get("numGuests"),resProps.get("start"), resProps.get("end"),resId]);
  

  await con.end();
  res.status(200).send("Successfully updated your reservation. Your reservationId is "+resId);

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
    res.status(400).send("Sorry the listing you've requested is already booked for your specified start time. Please update your start date or select a different property");
  }
  await con.query('INSERT INTO reservations(reservationId, startDate, endDate, status, listingId, userid, numGuests) VALUES($1,$2,$3,$4,$5,$6,$7)',[resId,start,end,"BOOKED",listing,userId, numGuests]);
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


