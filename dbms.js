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
    return;
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
  return;
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
    return;
  }else if(userLookup.rowCount === 0){
    res.status(401).send("UserId does not exist. Please sign up for an account");
    return;
  }
  else{
    res.status(401).send("Unable to log you in. UserID and pass do not match");
    return;
  }

});

app.get("/getallusers", async function(req,res){
    
    const con = await connectToDb();
    const resp = await con.query('SELECT * FROM users;');
    await con.end();
    console.log("ROWS: ", resp.rows);
    await con.end();
    res.status(200).send(resp.rows);
    return;
});

app.get("/getTotalBookedDays/:listingId", async function(req, res) {
  const con = await connectToDb();
  const reservations = await con.query('SELECT * FROM reservations WHERE listingId = $1;', [req.params.listingId]);
  if (reservations.rows.length == 0) {
    res.status(404).send('listingId: ' + req.params.listingId + ' does not have a reservation.')
  }

  var totalBookedDays = 0
  for (let i = 0; i < reservations.rows.length; i++) {
    let startDate = new Date(reservations.rows[i].startdate);
    let endDate = new Date(reservations.rows[i].enddate);
    console.log("Start Date: " + reservations.rows[i].startdate);
    console.log("End Date: " + endDate);
    var timeDiff = endDate.getTime() - startDate.getTime();
    totalBookedDays += timeDiff / (1000 * 3600 * 24);

    console.log("Days: ", totalBookedDays);
  }  


  console.log("ROWS: ", reservations.rows);
  await con.end();
  res.status(200).send(totalBookedDays.toString());
});

//THIS ENDPOINT IS WORK IN PROGRESS
app.get('/checkAvailability', async function(req,res){

  let start = req.body.startDate;
  let end = req.body.endDate; 

  const con = await connectToDb();
  const avail = await con.query("Select * from properties where listingid IN (SELECT properties.listingid FROM properties WHERE listingid NOT IN(SELECT listingid FROM reservations) Union Select listingid from reservations where status!=$1 AND endDate<=$2)",['BOOKED',start]);
  if(avail.rowCount === 0){app.status(404).send("No properties available for the selected period");}
  await con.end();
  res.status(200).send(avail.rows);
  return;
});


app.post('/updateReservation', async function(req,res){
  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const resId = req.body.reservationId;
  const start = req.body.start; 
  const end = req.body.end; 
  const status = req.body.status; 
  const numGuests = req.body.numGuests;
  let listing = req.body.listingId;
  const con = await connectToDb();
  if(listing != undefined && status != 'CANCELED'){
    res.status(400).send("sorry cannot update the property listing for this reservation. To do this, please cancel this reservation and create a new reservation for the new desired property listing.");
    return;
  }

  const reservation = await con.query('SELECT * FROM reservations WHERE reservationid=$1;',[resId]);
  if(reservation.rowCount === 0){
    res.status(404).send("Could not find reservation with the provided reservation Id. Please provide a different resrvation Id");
    return;
  }

  const resProps = new Map();
  resProps.set("start", start === undefined ? reservation[0].startDate : start)
  resProps.set("end", end === undefined ? reservation[0].endDate : end)
  resProps.set("status", status === undefined ? reservation[0].status : status)
  resProps.set("numGuests", numGuests === undefined ? reservation[0].numGuests : numGuests)
  resProps.set("listingid", reservation[0].listingid)
  
  if(numGuests != undefined){
    const listingRow = await con.query('SELECT * FROM properties WHERE listingid=$1',[resProps.get("listingid")]);
    if(listingRow.rowCount > 0 && listingRow.rows[0].maxPeople < numGuests){
      res.status(400).send("The number of Guests you have requested exeeds the amount of guests this property listing can host. Cannot update this reservation to these specifications");
      return;
    }
  }

  let date1 = new Date(resProps.get('start'));
  let date2 = new Date(resProps.get('end'));

  var timeDiff = date2.getTime() - date1.getTime();
  var dayDiff = timeDiff / (1000 * 3600 * 24);

  if( dayDiff < checkListing[0].minimumnights){
    res.status(400).send("The selected listing requires a minimum stay of "+checkListing.rows[0].minimumnights+" nights . Please update the start and/or end of your stay to accomodate the minimum required nights");
    return;
  }

  if(start != undefined || end != undefined){
    //TODO 
    let d1 = new Date(resProps.get('start'));
    let d2 = new Date(resProps.get('end'));
    if(d1.getTime() > d2.getTime()){
      res.status(400).send("Your Start date cannot be after your End Date");
      return;
    }
    else{
      const startandEnd = await con.query('SELECT startDate, endDate FROM reservations WHERE reservationid=$1 AND startDate>=$2 AND endDate<=$3', [resId,start,end]);
      if(startandEnd.rowCount > 0){
        await con.end();
        res.status(400).send({
          "msg":"You cannot update your reservation for this startDate - endDate range, because of conflicts with existing resrvations. Please select a date range that does not conflict with the ones provided below",
          "unavailableDates": startandEnd.rows
        });
        return;
      }
    }


  } 
  
  await con.query('UPDATE reservations SET status=$1, numGuests=$2 , startDate=$3, endDate=$4 WHERE reservationid=$5',[resProps.get("status"),resProps.get("numGuests"),resProps.get("start"), resProps.get("end"),resId]);
  

  await con.end();
  res.status(200).send("Successfully updated your reservation. Your reservationId is "+resId);
  return;
});

app.post('/makeReservation', async function(req,res){
  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  let start = req.body.startDate;
  let end = req.body.endDate; 
  let listing = req.body.listingId;
  let resId = uuidv4();
  let numGuests = req.body.numGuests;

  if(start === undefined || end === undefined){
    res.status(400).send("Start and End Date of your reservation are required. Please re-submit request by adding a startDate and endDate in the format yyyy-mm-dd");
    return;

  }

  let d1 = new Date(start);
  let d2 = new Date(end);



  const con = await connectToDb();
  const checkListing = await con.query('SELECT * FROM properties WHERE ListingId=$1;',[listing])
  if(checkListing.rowCount === 0){app.status(404).send("The listing Id you have provided is invalid. No such listing could be found");}
  
  if(numGuests > checkListing.rows[0].maxPeople){
    res.status(400).send("The selected listing can hold a maximum of "+checkListing.rows[0].maxPeople+" guests. Please update your number of guests");
    return;

  }

    var timeDiff = d2.getTime() - d1.getTime();
    var dayDiff = timeDiff / (1000 * 3600 * 24);
  console.log("DAY DIFF IS: ", dayDiff);
  if( dayDiff < checkListing.rows[0].minimumnights){
    res.status(400).send("The selected listing requires a minimum stay of "+checkListing.rows[0].minimumnights+" nights . Please update the start and/or end of your stay to accomodate the minimum required nights");
    return;
  }



  //TODO: compare against existing reservations to see if this one is valid. Start vs End date. 
  // const avail = await con.query('SELECT * FROM (SELECT p.hostname, p.hostid, p.listingid, p.listingname, p.city, p.numbeds, p.price, p.minimumnights,p.maxpeople,p.roomsize,p.state, r.startDate,r.endDate FROM properties p LEFT OUTER JOIN reservations r ON p.listingid = r.listingid WHERE status=$1 AND endDate>=$2) AS existingRes WHERE listingid=$3;',['BOOKED',start,listing]);
  const avail = await con.query('SELECT * FROM reservations WHERE status=$1 AND listingid=$2 AND startDate>=$3 AND endDate<=$4',['BOOKED',listing,start,start]);
  if(avail.rowCount > 0 ){
    res.status(400).send("Sorry the listing you've requested is already booked for your specified start time. Please update your start date or select a different property");
    return;

  }
  console.log("START IS: ",start);
  console.log("END IS: ", end);

  await con.query('INSERT INTO reservations(reservationId, startDate, endDate, status, listingId, userid, numGuests) VALUES($1,$2,$3,$4,$5,$6,$7)',[resId,start,end,"BOOKED",listing,userId, numGuests]);
  await con.end();
  res.status(200).send("Successfully created your reservation. Your reservationId is "+resId);
  return;

});

app.post("/getreservations", async function(req,res){
  const userId = req.body.userId;
  const start = req.body.startDate;
  const end = req.body.endDate;
  const host = req.body.hostId;
  // let start = req.body.startDate;
  // let end = req.body.endDate; 
  // let listing = req.body.listingId;
  // let resId = uuidv4();
  // let numGuests = req.body.numGuests;
  if(userId === undefined && host === undefined){
    res.status(400).send("Did not recieve a userId. Please submit a userId if you would like to view all your reservations");
    return;
  }

  if(host != undefined && !isLoggedIn(host)){
    res.status(401).send("user "+hostId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }else if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  //user and host are both defined 
  
  const con = await connectToDb();
  if(end != undefined && start !=undefined){
    if(host != undefined && userId != undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1 AND hostId=$2 AND startDate>=$3 AND endDate<=$4',[userId,host,start,end]);
      const resText = "As a property host here are all the reservations between "+start+" and "+end+" made by user "+userId;
      reservations.rowCount === 0 ? res.status(200).send("You do not have any reservations between "+start+" and "+end+" made by user "+userId) : res.status(200).send({"msg":resText,"reservations":reservations.rows});  
      return;
    }else if(host != undefined && userId ===undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE hostid=$1 AND startDate>=$2 AND endDate<=$3',[host,start,end]);
      const resText = "As a property host, here are the reservations for your properties between "+start+" and "+end;
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties between "+start+" and "+end) : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      return;
    }else{
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1 AND startDate>=$2 AND endDate<=$3',[userId,start,end]);
      const resText = "reservations between "+start+" and "+end;
      reservations.rowCount === 0 ? res.status(200).send("You do not have any reservations between "+start+" and "+end) : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      return;
    }
  }else{
    if(host != undefined && userId != undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1 AND hostid=$2',[userId,host]);
      const resText = "As a property host here are all the reservations for your properties made by user "+userId;
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties made by user "+userId) : res.status(200).send({"msg":resText,"reservations":reservations.rows});  
      return;
    }else if(host != undefined && userId === undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE hostid=$1',[host]);
      const resText = "As a property host, here are all the reservations for your properties";
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties") : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      return;
    }else{
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1',[userId]);
      reservations.rowCount === 0 ? res.status(200).send("You do not have any reservations") :res.status(200).send({"msg": "Here are all of your reservations. To view reservations within a certain date range please provide a Start and End Date"
      ,"allReservations": reservations.rows});  
      return;
    }
  }
});

app.post("/updateListing", async function(req,res){

  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }
  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }
  const listid = req.body.listingid;
  if(listid === undefined){
    res.status(400).send("You must provide the listingid for the property listing you wish to update");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }

  const availForUpdate = ['listingname','city','numbeds','price','minimumnights','maxpeople','state','roomsize'];
  const currListing = await con.query("SELECT * FROM properties WHERE listingId=$1 ",[listid]);
  
  if(currListing.rowCount === 0){
    res.status(404).send("Could not find any property listings with the provided listingid: "+listid+". Please try again by submitting a new listingid");
    return; 
  }

  let propMap = new Map();
  propMap.set("listingname" ,req.body.listingname === undefined ? currListing.rows[0].listingname : req.body.listingname); 
  propMap.set("city", req.body.city === undefined ? currListing.rows[0].city :  req.body.city);
  propMap.set("numbeds", req.body.numbeds === undefined ? currListing.rows[0].numbeds :  req.body.numbeds);
  propMap.set("price", req.body.price === undefined ? currListing.rows[0].price :  req.body.price);
  propMap.set("minimumnights", req.body.minimumnights === undefined ? currListing.rows[0].minimumnights :  req.body.minimumnights); 
  propMap.set("maxpeople", req.body.maxpeople === undefined ? currListing.rows[0].maxpeople :  req.body.maxpeople);
  propMap.set("state", req.body.state === undefined ? currListing.rows[0].state :  req.body.state);
  propMap.set("roomsize", req.body.roomsize === undefined ? currListing.rows[0].roomsize :  req.body.roomsize);

  await con.query('UPDATE properties SET listingname=$1, city=$2 , numbeds=$3, price=$4 , minimumnights=$5, maxpeople=$6, state=$7, roomsize=$8 WHERE listingid=$9',[propMap.get("listingname"),propMap.get("city"),propMap.get("numbeds"), propMap.get("price"),propMap.get('minimumnights'), propMap.get('maxpeople'), propMap.get('state'), propMap.get('roomsize'), listid]);
  await con.end();
  res.status(200).send("Your updates have been made successfully for  listingid: "+listid);
  return; 

});

app.post("/createListing", async function(req,res){

  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }
  let listingid = uuidv4();
  let propMap = new Map();
  console.log("HOSTNAME : ",  founduser.rows[0].name);
  console.log("hostid: ", founduser.rows[0].userid);
  console.log("listingid: ",listingid );

  propMap.set("hostname" , founduser.rows[0].name);
  propMap.set("hostid", founduser.rows[0].userid);
  propMap.set("listingid", listingid);
  propMap.set("listingname" ,req.body.listingname); 
  propMap.set("city", req.body.city);
  propMap.set("numbeds", req.body.numbeds);
  propMap.set("price", req.body.price);
  propMap.set("minimumnights", req.body.minimumnights); 
  propMap.set("maxpeople", req.body.maxpeople );
  propMap.set("state", req.body.state);
  propMap.set("roomsize", req.body.roomsize);

  const missinVals = [];
  for(let [key, value] of propMap){
    console.log("KEY "+key+" VALUE "+value);
    if(value === undefined){
      missinVals.push(key);
    }
  }

  if(missinVals.length > 0){
    res.status(400).send({"msg":"The following fields are required to perform this action. Please re-submit and provide these values for creating a new listing", "missingValues" : missinVals});
    return;
  }

  await con.query('INSERT into properties(hostname,hostid, listingid,listingname, city, numbeds,price, minimumnights, maxpeople,state, roomsize) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);',[propMap.get('hostname'),propMap.get('hostid'),propMap.get('listingid'),propMap.get('listingname'),propMap.get('city'),propMap.get('numbeds'),propMap.get('price'),propMap.get('minimumnights'),propMap.get('maxpeople'),propMap.get('state'),propMap.get('roomsize')] );
  res.status(200).send("Your new listing has been created with the listing id "+propMap.get('listingid'));
  return;
});

app.delete("/deleteListing", async function(req,res){
  const userId = req.body.userId;
  if(!isLoggedIn(userId)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const listid = req.body.listingid;
  if(listid === undefined){
    res.status(400).send("It is required to submit a listingid, in order to delete that specific listing.");
    return;
  }

  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }

  const foundListing = await con.query("SELECT * FROM properties WHERE listingid=$1",[listid]);
  if(foundListing.rowCount === 0){
    res.status(404).send("Could not find any listing with the provided listingid. Please re-submit with a new listingid");
    return; 
  }


  if(founduser.rows[0].usertype != "ADMIN" && foundListing.rows[0].hostid != userId){
    res.status(401).send("Property listing "+listid+" does not belong to property host ");
    return; 
  }


  await con.query("DELETE FROM properties WHERE listingid=$1 ",[listid])
  await con.end();
  res.status(200).send("Listing with listing id "+listid+" has been successfully deleted");
  return;
});

app.post("/propertyHostStats",async function(req,res){

  const userId = req.body.userId;
  const hostid = req.body.hostid;

  if(!isLoggedIn(userId)){  
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }


  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }else if(founduser.rows[0].usertype === 'ADMIN' && hostid === undefined){
    res.status(400).send("The logged in user is a data base admin, and therefore a hostid must also be provided to find the average nights per reservation for that property host");
    return; 
  }

  const reshost = hostid != undefined ? hostid : userId;
  const allres = await con.query("select * from (select hostid, userid, price, startDate, endDate, reservationid, status, r.listingid, numguests FROM properties p INNER JOIN reservations r ON p.listingid=r.listingid) as resjoin WHERE hostid=$1;",[reshost]);
  const totalRes = allres.rowCount;
  const totalrows = allres.rows;
  let totalnights = 0;
  let i = 0;
  let totalPrice = 0.0;
  let totalGuests = 0;
  const statusMap = new Map();
  statusMap.set("BOOKED",0);
  statusMap.set("CLOSED",0);
  statusMap.set("CANCELLED",0);

  for(i; i < totalRes; i++){
    //DAYS STAYED
    let date1 = new Date(totalrows[i].startdate);
    let date2 = new Date(totalrows[i].enddate);

    var timeDiff = date2.getTime() - date1.getTime();
    var dayDiff = timeDiff / (1000 * 3600 * 24);

    totalnights+=dayDiff;

    //Percent Cancelled
    const statCount = statusMap.get(totalrows[i].status);
    statusMap.set(totalrows[i].status, statCount+1);
    
    //Total Earned
    console.log("PRICE: ", Number(totalrows[i].price.replace(/[^0-9.-]+/g,"")));
    let earnedForRes =parseFloat((Number(totalrows[i].price.replace(/[^0-9.-]+/g,"")) * dayDiff).toFixed(2));
    console.log("RES PRICE: ", typeof(earnedForRes));
    totalPrice += earnedForRes;
    console.log("TOTAL PRICE: ", typeof(totalPrice));

    //Avg guests
    totalGuests+= totalrows[i].numguests;
  };
  console.log("MAP: ", statusMap);
  let avgnights = (totalnights/totalRes).toFixed(2);
  let percentCancelled = (statusMap.get("CANCELLED")/totalRes).toFixed(2);
  let avgGuests = (totalGuests/totalRes).toFixed(2);
  let avgPrice = parseFloat((totalPrice/totalRes).toFixed(2));
  await con.end();
  res.status(200).send({
    "msg":"The average nights reserved for all properties owned by property host "+reshost+" are given below",
    "avgDaysStayed": avgnights,
    "cancelledReservationPercentage": percentCancelled,
    "totalPriceEarned": totalPrice,
    "avgPricePerReservation": avgPrice,
    "avgGuests": avgGuests, 
    
  });
  return


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
// state  
// roomSize 



// Reservations  
// ReservationId 
// startDate 
// endDate 
// Status 
// listingId 
// userId 
// numGuests


//Avg Days, %Cancelled, Total Price Earned, Avg Guests

