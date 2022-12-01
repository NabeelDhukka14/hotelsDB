const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require('uuid');
const app = express();
const { Client } = require("pg")

let loggedInUsers = new Map();
let validRoles = ['USER', 'HOST'];
let idType = new Map();
idType.set("LISTING","6");
idType.set("USER","7");
idType.set("RESERVATION","9");


port = 5000;

app.use(bodyParser.json());

app.listen(port);

console.log('Hotel RestWrapper API started on port:  ' + port);

const isLoggedIn = (userId, sessionGUID) => {
  if(!loggedInUsers.has(userId) && loggedInUsers.get(userId)===sessionGUID){
    return false;
  }else{
    return true;
  }

}

const makeNum = (digits) =>{

  let id = '';
  let isFirst = true;

  while(digits > 0){
    let rand = Math.floor((Math.random()*10));
    id = id + (rand === 0 && isFirst ? rand+1:rand);
    digits -= 1;
    isFirst = false;
  }

  return id; 
}

//db connection must be active to use this method 
const genId = async (dbClient,type) => {

  let digits =7;
  if(idType.has(type)){
    digits = idType.get(type.toUpperCase());
  }


  let idQuery = new Map();
  idQuery.set("LISTING",'SELECT * FROM properties WHERE listingid=$1');
  idQuery.set("USER",'SELECT * FROM users WHERE userid=$1');
  idQuery.set("RESERVATION",'SELECT * FROM reservations WHERE reservationid=$1');

  const queryByIdType = idQuery.get(type.toUpperCase());

  let id = makeNum(digits);

  let isMatchingID = true;
  while(isMatchingID){
    let idLookup = await dbClient.query(queryByIdType,[id]);
    if(idLookup.rowCount === 0){
      isMatchingID = false;
    }else{
      id = makeNum(digits);
    }

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

 let userType = req.body.userType.toUpperCase();
 let name = req.body.name;
 let pass = req.body.password;
 

  console.log("USER TYPE: ", userType);
  if(!validRoles.includes(userType.toUpperCase())){
    res.status(400).send("The 'role' you've provided is invalid. Please select either 'user' or 'host' as a role");
    return;
  }

  
  const client = await connectToDb();
  console.log("connected to db");
  let userId = await genId(client,'USER');
 

  console.log("UUID MADE: ",userId);
  let query = 'INSERT INTO users(userid, usertype, name, password) VALUES($1,$2,$3,$4);';
  let values = [userId, userType, name, pass];
  await client.query(query,values);  

  await client.end();
  console.log("done removing connection");
  res.status(200).send("succesfully signed you up.Your userId is "+userId+". Use this Id when loggin in.");
  return;
});


app.post("/loginUser/:userId", async function(req, res){
  let userId = req.params.userId;
  let pass = req.body.password;

  const client = await connectToDb();
  let userLookup = await client.query('SELECT * FROM users WHERE userId=$1',[userId]);
  console.log("userLookup: ", userLookup);

  if(userLookup.rowCount > 0 && userLookup.rows[0].password === pass){
    let sessionid = uuidv4();
    loggedInUsers.set(userId, sessionid);
    await client.end();

    res.status(200).send({"msg":"Successfully logged in","sessionGUID":sessionid});
    return;
  }else if(userLookup.rowCount === 0){
    await client.end();

    res.status(401).send("UserId does not exist. Please sign up for an account");
    return;
  }
  else{
    await client.end();
    res.status(401).send("Unable to log you in. UserID and pass do not match");
    return;
  }

});

app.get("/getallusers/:userId/:sessionGuid", async function(req,res){
    
    const userId = req.params.userId;
    console.log("USER: ",userId);
    console.log("sessionGuid: ",req.params.sessionGuid);

    if(!isLoggedIn(userId,req.params.sessionGuid)){
      res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
      return;
    }

    const con = await connectToDb();

    const currUser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
    if(currUser.rowCount === 0){
      await con.end();
      res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
      return;
    }
    if(currUser.rows[0].usertype !== 'ADMIN'){
      await con.end();
      res.status(400).send("Only database Admins can view all users.");
      return; 
    }

    const resp = await con.query('SELECT * FROM users;');
    await con.end();
    res.status(200).send(resp.rows);
    return;

});

app.delete("/deleteUser/:userId/:sessionGuid", async function(req, res) {

  const userId = req.params.userId;
  const userToBeDeleted = req.body.userToDelete;

  if(!isLoggedIn(userId)){
    res.status(401).send("user " + userId + " is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  const isAdmin = await con.query('SELECT * FROM users WHERE userid=$1 AND usertype=$2',[userId,'ADMIN']);
  if(isAdmin.rowCount === 0){
    await con.end();
    res.status(401).send({"msg":"Only database admins can perform this action"});
    return;
  }else if(userToBeDeleted === undefined){
    await con.end();
    res.status(401).send({"msg":"As an database admin you must provide which user is to be updated via sending a userToDelete property with the individual\'s userid"});
    return;
  }

  const existingUser = await con.query('SELECT * FROM users WHERE userid=$1', [userToBeDeleted]);

  if(existingUser.rows.length === 0) {
    await con.end();
    res.status(404).send("There is no user found by the userId "+userToBeDeleted+". Please submit a different userId");
    return;
  }

  const deletedUser = await con.query('DELETE FROM users WHERE userid = $1', [userToBeDeleted]);
  await con.end();
  res.status(200).send({"msg": "Successfully deleted user "+userToBeDeleted});
  return;
});


app.post("/updateUser/:userId/:sessionGuid/", async function(req, res){

  const userId = req.params.userId;
  const userToBeUpdated = req.body.userToUpdate;

  if(!isLoggedIn(userId)){
    res.status(401).send("user " + userId + " is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  const isAdmin = await con.query('SELECT * FROM users WHERE userid = $1 AND usertype=$2',[userId,'ADMIN']);

  if(isAdmin.rowCount === 0){
    await con.end();
    res.status(401).send({"msg":"Only database admins can perform this action"});
    return;
  }else if(userToBeUpdated === undefined){
    await con.end();
    res.status(401).send({"msg":"As an database admin you must provide which user is to be updated via sending a userToUpdate property with the individual\'s userid"});
    return;
  }

  const existingUser = await con.query('SELECT * FROM users WHERE userid=$1', [userToBeUpdated]);

  if(existingUser.rows.length === 0) {
    await con.end();
    res.status(404).send("There is no user found by the userId "+userToBeUpdated+". Please submit or login as a different userId");
    return;
  }

  const useridnum = req.body.userid;
  const usertype = req.body.usertype.toUpperCase();
  const name = req.body.name; 
  const password = req.body.password;

  if(useridnum != undefined){
    await con.end();
    res.status(400).send("The userid field cannot be updated. Please resubmit your updates without this field provided in the body of your request");
    return;
  }
  let updatemap = new Map();
  updatemap.set('usertype', usertype === undefined ? existingUser.rows[0].usertype : usertype);
  updatemap.set('name', name === undefined ? existingUser.rows[0].name : name);
  updatemap.set('password', password === undefined ? existingUser.rows[0].password : password);

  if(!validRoles.includes(updatemap.get('usertype'))){
    res.status(400).send("The 'role' you've provided is invalid. Please select either 'user' or 'host' as a role");
    return;
  }

  await con.query('UPDATE users SET usertype=$1, name=$2 , password=$3 WHERE userid=$4',[updatemap.get("usertype"),updatemap.get("name"),updatemap.get("password"),userToBeUpdated]);
  await con.end();
  res.status(200).send({"msg": "Successfully made your updates for user "+userToBeUpdated});
  return;

});

app.get("/getTotalBookedDays/:userId/:sessionGuid/:listingId", async function(req, res) {
  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }
  const con = await connectToDb();
  const reservations = await con.query('SELECT * FROM reservations WHERE listingId = $1;', [req.params.listingId]);
  if (reservations.rows.length == 0) {
    await con.end();
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


app.post('/filterProperties/:userId/:sessionGuid', async function(req,res){
  const userId = req.params.userId;
  if(!isLoggedIn(userId, req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const start = req.body.startDate;
  const end = req.body.endDate; 

  if( start === undefined || end === undefined){
    res.status(400).send("startDate and endDate are required fields, in order for us to show you all availble listings during your trip time range. Please re-submit with these values included");
    return;
  }


  let availPropQuery = "Select * from properties where listingid NOT IN(Select listingid from reservations where status=$1 AND endDate>$2 AND startDate<$3)"
  let query = "SELECT * FROM ("+availPropQuery+") as foo WHERE";
 
  
  let propMap = new Map();
  propMap.set("listingid", req.body.listingid);
  propMap.set("listingname" ,req.body.listingname); 
  propMap.set("hostname", req.body.hostname);
  propMap.set("hostid", req.body.hostid);
  propMap.set("city", req.body.city);
  propMap.set("state", req.body.state);
  propMap.set("price", req.body.price);
  propMap.set("numbeds", req.body.numbeds);
  propMap.set("minimumnights", req.body.minimumnights); 
  propMap.set("maxpeople", req.body.maxpeople );
  propMap.set("roomsize", req.body.roomsize);

  const con = await connectToDb();

  for(let [key, value] of propMap){
    if(value !=undefined){
      if (key === "price") {
        query += " foo."+key+ " <= '"+value+"' AND";
      }else{
        query += " foo."+key+ " = '"+value+"' AND";
      }
    }    
  } 
  const pattern = /AND$/
  if(pattern.test(query)){
    query = query.slice(0, -4);
  }else{
    query = query.slice(0, -6);
  }
  
  query += ";"
  console.log('QUERY -----> ', query);

  const filterProperties = await con.query(query,['BOOKED',start,end]);
  if(filterProperties.rowCount === 0){
    await con.end();
    res.status(404).send("No properties found");
    return;
  }  
  await con.end();
  res.status(200).send(filterProperties.rows);
  return;
});


app.post('/updateReservation/:userId/:sessionGuid', async function(req,res){
  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const resId = req.body.reservationid;
  const start = req.body.start; 
  const end = req.body.end; 
  const status = req.body.status; 
  const numGuests = req.body.numguests;
  let listing = req.body.listingid;
  const con = await connectToDb();
  if(listing != undefined && status != 'CANCELED'){
    await con.end();
    res.status(400).send("sorry cannot update the property listing for this reservation. To do this, please cancel this reservation and create a new reservation for the new desired property listing.");
    return;
  }

  const reservation = await con.query('SELECT * FROM reservations WHERE reservationid=$1;',[resId]);
  if(reservation.rowCount === 0){
    await con.end();
    res.status(404).send("Could not find reservation with the provided reservation Id. Please provide a different resrvation Id");
    return;
  }

  const resProps = new Map();
  resProps.set("start", start === undefined ? reservation.rows[0].startdate : start)
  resProps.set("end", end === undefined ? reservation.rows[0].enddate : end)
  resProps.set("status", status === undefined ? reservation.rows[0].status : status)
  resProps.set("numGuests", numGuests === undefined ? reservation.rows[0].numguests : numGuests)
  resProps.set("listingid", reservation.rows[0].listingid)
  
  console.log("RES START: ", resProps.get('start'));
  console.log("RES END: ", resProps.get('end'));
  console.log("RES numGuests: ", resProps.get('numGuests'));

  console.log("BODY START: ", start);
  console.log("BODY END: ", end);
  console.log("BODY numGuests: ", numGuests);


  if(numGuests != undefined){
    const listingRow = await con.query('SELECT * FROM properties WHERE listingid=$1',[resProps.get("listingid")]);
    if(listingRow.rowCount > 0 && listingRow.rows[0].maxPeople < numGuests){
      await con.end();
      res.status(400).send("The number of Guests you have requested exeeds the amount of guests this property listing can host. Cannot update this reservation to these specifications");
      return;
    }
    
    let date1 = new Date(resProps.get('start'));
    let date2 = new Date(resProps.get('end'));
  
    var timeDiff = date2.getTime() - date1.getTime();
    var dayDiff = timeDiff / (1000 * 3600 * 24);
  
    if( dayDiff < listingRow.rows[0].minimumnights){
      await con.end();
      res.status(400).send("The selected listing requires a minimum stay of "+listingRow.rows[0].minimumnights+" nights . Please update the start and/or end of your stay to accomodate the minimum required nights");
      return;
    }
  }


  if(start != undefined || end != undefined){
    //TODO 
    let d1 = new Date(resProps.get('start'));
    let d2 = new Date(resProps.get('end'));
    if(d1.getTime() > d2.getTime()){
      await con.end();
      res.status(400).send("Your Start date cannot be after your End Date");
      return;
    }
    else{
        const unavail = await con.query('SELECT startDate, endDate FROM reservations WHERE status=$1 AND listingid=$2 AND endDate>$3 AND startDate<$4',['BOOKED',resProps.get("listingid"),resProps.get("start"),resProps.get("end")]);
        if(unavail.rowCount > 0 ){
          await con.end();
          res.status(400).send({"msg":"Sorry the listing you've requested is already booked for your specified start time. Please update your start date or select a different property","unavailableDates":unavail.rows});
          return;

        }
      }
    


  } 
  
  try{
    await con.query('BEGIN');
    await con.query('UPDATE reservations SET status=$1, numGuests=$2 , startDate=$3, endDate=$4 WHERE reservationid=$5',[resProps.get("status"),resProps.get("numGuests"),resProps.get("start"), resProps.get("end"),resId]);
    await con.query('COMMIT');

  }catch(e){
    await con.query('ROLLBACK')
  }finally{
    await con.end();
  }

  res.status(200).send("Successfully updated your reservation. Your reservationId is "+resId);
  return;
  
});

app.post('/makeReservation/:userId/:sessionGuid', async function(req,res){
  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  let start = req.body.startDate;
  let end = req.body.endDate; 
  let listing = req.body.listingId;
  let numGuests = req.body.numGuests;

  

  if(start === undefined || end === undefined){
    res.status(400).send("Start and End Date of your reservation are required. Please re-submit request by adding a startDate and endDate in the format yyyy-mm-dd");
    return;

  }

  let d1 = new Date(start);
  let d2 = new Date(end);



  const con = await connectToDb();
  let resId = await genId(con, 'RESERVATION');
  const checkListing = await con.query('SELECT * FROM properties WHERE ListingId=$1;',[listing])
  if(checkListing.rowCount === 0){
    await con.end();
    res.status(404).send("The listing Id you have provided is invalid. No such listing could be found");
    return;
  }
  
  if(numGuests > checkListing.rows[0].maxPeople){
    await con.end();
    res.status(400).send("The selected listing can hold a maximum of "+checkListing.rows[0].maxPeople+" guests. Please update your number of guests");
    return;

  }

    var timeDiff = d2.getTime() - d1.getTime();
    var dayDiff = timeDiff / (1000 * 3600 * 24);
  console.log("DAY DIFF IS: ", dayDiff);
  if( dayDiff < checkListing.rows[0].minimumnights){
    await con.end();
    res.status(400).send("The selected listing requires a minimum stay of "+checkListing.rows[0].minimumnights+" nights . Please update the start and/or end of your stay to accomodate the minimum required nights");
    return;
  }



  const unavail = await con.query('SELECT startDate, endDate FROM reservations WHERE status=$1 AND listingid=$2 AND endDate>$3 AND startDate<$4',['BOOKED',listing,start,end]);
  if(unavail.rowCount > 0 ){
    await con.end();
    res.status(400).send({"msg":"Sorry the listing you've requested is already booked for your specified start time. Please update your start date or select a different property","unavailableDates":unavail.rows});
    return;

  }
  console.log("START IS: ",start);
  console.log("END IS: ", end);
  try{
  await con.query('BEGIN');
  await con.query('INSERT INTO reservations(reservationId, startDate, endDate, status, listingId, userid, numGuests) VALUES($1,$2,$3,$4,$5,$6,$7)',[resId,start,end,"BOOKED",listing,userId, numGuests]);
  await con.query('COMMIT');
  
  }catch(e){
    await client.query('ROLLBACK')
    throw e
  }finally{
    await con.end();
  }
  
  res.status(200).send("Successfully created your reservation. Your reservationId is "+resId);
  return;  

});

app.post("/getreservations/:userId/:sessionGuid", async function(req,res){
  const userId = req.params.userId;
  const start = req.body.startDate;
  const end = req.body.endDate;
  const host = req.body.hostId;

  if(userId === undefined && host === undefined){
    res.status(400).send("Did not recieve a userId. Please submit a userId if you would like to view all your reservations");
    return;
  }

  if(host != undefined && !isLoggedIn(host,req.params.sessionGuid)){
    res.status(401).send("user "+hostId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }else if(!isLoggedIn(userId,req.params.sessionGuid)){
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
      await con.end();
      return;
    }else if(host != undefined && userId ===undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE hostid=$1 AND startDate>=$2 AND endDate<=$3',[host,start,end]);
      const resText = "As a property host, here are the reservations for your properties between "+start+" and "+end;
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties between "+start+" and "+end) : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      await con.end();
      return;
    }else{
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1 AND startDate>=$2 AND endDate<=$3',[userId,start,end]);
      const resText = "reservations between "+start+" and "+end;
      reservations.rowCount === 0 ? res.status(200).send("You do not have any reservations between "+start+" and "+end) : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      await con.end();
      return;
    }
  }else{
    if(host != undefined && userId != undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1 AND hostid=$2',[userId,host]);
      const resText = "As a property host here are all the reservations for your properties made by user "+userId;
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties made by user "+userId) : res.status(200).send({"msg":resText,"reservations":reservations.rows});  
      await con.end();
      return;
    }else if(host != undefined && userId === undefined){
      const reservations = await con.query('SELECT * FROM reservations WHERE hostid=$1',[host]);
      const resText = "As a property host, here are all the reservations for your properties";
      reservations.rowCount === 0 ? res.status(200).send("As a property host, you do not have any reservations for your properties") : res.status(200).send({"msg":resText,"reservations":reservations.rows});
      await con.end();
      return;
    }else{
      const reservations = await con.query('SELECT * FROM reservations WHERE userid=$1',[userId]);
      reservations.rowCount === 0 ? res.status(200).send("You do not have any reservations") :res.status(200).send({"msg": "Here are all of your reservations. To view reservations within a certain date range please provide a Start and End Date"
      ,"allReservations": reservations.rows});  
      await con.end();
      return;
    }
  }
});

app.post("/updateListing/:userId/:sessionGuid", async function(req,res){

  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }
  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    await con.end();
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }

  const listid = req.body.listingid;
  if(listid === undefined){
    await con.end();
    res.status(400).send("You must provide the listingid for the property listing you wish to update");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    await con.end();
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }

  const availForUpdate = ['listingname','city','numbeds','price','minimumnights','maxpeople','state','roomsize'];
  const currListing = await con.query("SELECT * FROM properties WHERE listingId=$1 ",[listid]);
  
  if(currListing.rowCount === 0){
    await con.end();
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

  let updatedLocation = (currListing.rows[0].city != propMap.get('city')) || (currListing.rows[0].state != propMap.get('state'));
  
  let existingReservations;
  if(updatedLocation){
     existingReservations = await con.query("SELECT reservationid FROM reservations WHERE listingid=$1", [listid])
  }

  try{
    await con.query('BEGIN');
    
    if(updatedLocation){
      await con.query("UPDATE reservations SET status=$1 WHERE listingid=$2", ['CANCELLED',listid])
    }

    await con.query('UPDATE properties SET listingname=$1, city=$2 , numbeds=$3, price=$4 , minimumnights=$5, maxpeople=$6, state=$7, roomsize=$8 WHERE listingid=$9',[propMap.get("listingname"),propMap.get("city"),propMap.get("numbeds"), propMap.get("price"),propMap.get('minimumnights'), propMap.get('maxpeople'), propMap.get('state'), propMap.get('roomsize'), listid]);
    await con.query('COMMIT');
  }catch(e){
    await client.query('ROLLBACK')
    throw e
  }finally{
    await con.end();
  }
  
  updatedLocation ? res.status(200).send({"msg":"Your updates have been made successfully for  listingid: "+listid}) : res.status(200).send({"msg":"Your updates have been made successfully for  listingid: "+listid+" Due to your changes to city and/or state, we have cancelled any active reservations to ensure our customers to not lodge in an unanticipated location. affected reservations are listed below", "cancelledReservations": existingReservations.rows});
  return; 
  

});

app.post("/createListing/:userId/:sessionGuid", async function(req,res){

  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    await con.end();
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    await con.end();
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }

  let listingid = await genId(con,"LISTING");

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
    await con.end();
    res.status(400).send({"msg":"The following fields are required to perform this action. Please re-submit and provide these values for creating a new listing", "missingValues" : missinVals});
    return;
  }
  try{
    await con.query('BEGIN');
    await con.query('INSERT into properties(hostname,hostid, listingid,listingname, city, numbeds,price, minimumnights, maxpeople,state, roomsize) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);',[propMap.get('hostname'),propMap.get('hostid'),propMap.get('listingid'),propMap.get('listingname'),propMap.get('city'),propMap.get('numbeds'),propMap.get('price'),propMap.get('minimumnights'),propMap.get('maxpeople'),propMap.get('state'),propMap.get('roomsize')] );
    await con.query('COMMIT');
  }catch(e){
    await client.query('ROLLBACK')
    throw e
  }finally{
    await con.end();
  }
  res.status(200).send("Your new listing has been created with the listing id "+propMap.get('listingid'));
  return;
});

app.delete("/deleteListing/:userId/:sessionGuid", async function(req,res){
  const userId = req.params.userId;
  if(!isLoggedIn(userId,req.params.sessionGuid)){
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
    await con.end();
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }

  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    await con.end();
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }

  const foundListing = await con.query("SELECT * FROM properties WHERE listingid=$1",[listid]);
  if(foundListing.rowCount === 0){
    await con.end();
    res.status(404).send("Could not find any listing with the provided listingid. Please re-submit with a new listingid");
    return; 
  }


  if(founduser.rows[0].usertype != "ADMIN" && foundListing.rows[0].hostid != userId){
    await con.end();
    res.status(401).send("Property listing "+listid+" does not belong to property host ");
    return; 
  }


  await con.query("DELETE FROM properties WHERE listingid=$1 ",[listid])
  await con.end();
  res.status(200).send("Listing with listing id "+listid+" has been successfully deleted");
  return;
});

app.post("/propertyHostStats/:userId/:sessionGuid",async function(req,res){

  const userId = req.params.userId;
  const hostid = req.body.hostid;
  if(!isLoggedIn(userId,req.params.sessionGuid)){  
    res.status(401).send("user "+userId+" is not logged in. Please login before attempting to perform any actions");
    return;
  }

  const con = await connectToDb();
  //get user type
  const founduser = await con.query('SELECT * FROM users WHERE userid=$1',[userId]);
  if(founduser.rowCount === 0){
    await con.end();
    res.status(404).send("There is no user found by the userId "+userId+". Please submit a different userId");
    return;
  }


  if(founduser.rows[0].usertype !== 'HOST' && founduser.rows[0].usertype !== 'ADMIN'){
    await con.end();
    res.status(400).send("Only property hosts and database Admins can create new listings. Either login as a user of one of those userTypes, or update your account to a HOST userType to perform this action");
    return; 
  }else if(founduser.rows[0].usertype === 'ADMIN' && hostid === undefined){
    await con.end();
    res.status(400).send("The logged in user is a data base admin, and therefore a hostid must also be provided to find the average nights per reservation for that property host");
    return; 
  }else if(founduser.rows[0].usertype === 'ADMIN' && hostid != undefined){
    const founduser = await con.query('SELECT * FROM users WHERE userid=$1 AND userType=$2',[hostid,'HOST']);
    if(founduser.rowCount === 0){
      await con.end();
      res.status(404).send("There is no host found by the hostId "+hostid+". Please submit a different hostId");
      return;
    }

  }


  const reshost = hostid != undefined ? hostid : userId;
  console.log("HOST ID: ", reshost);
  const allres = await con.query("select * from (select hostid, userid, price, startDate, endDate, reservationid, status, r.listingid, numguests FROM properties p INNER JOIN reservations r ON p.listingid=r.listingid) as resjoin WHERE hostid=$1;",[reshost]);
  const totalRes = allres.rowCount;
  const totalrows = allres.rows;

  if(totalRes === 0){
    await con.end();
    res.status(404).send("There are no reservations for this host, and therefore not stats to provide");
    return;
  }

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
  return;


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

