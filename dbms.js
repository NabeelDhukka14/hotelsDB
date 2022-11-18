const express = require("express");
const bodyParser = require("body-parser");
const sql = require('mysql2');
const { v4: uuidv4 } = require('uuid');
const app = express();
const { Client } = require("pg")

port = 8080;

app.use(bodyParser.json());

app.listen(port);

console.log('Hotel RestWrapper API started on port:  ' + port);

// function connectToDb(){
//     const connection = sql.createConnection({
//         host: 'myDB',
//         port: '5432',
//         user: 'hello',
//         password: 'world',
//         database: 'hotelsDb'});
//         return connection;

// }

 
const connectDb = async () => {
    try {
        const client = new Client({
            user: 'hello',
            host: 'myDB',
            database: 'hotelsDb',
            password: 'world',
            port: 5432
        })
        return client;
    } catch (error) {
        console.log(error)
    }
}
 


// Define GET endpoint for basic hello world output
app.get("/getallusers", async function(req,res){
    // const con = connectToDb();
    // con.connect();
    // const x =  con.query(
    //     'select * from users;',
    //     function(err, results, fields) {
    //       console.log("Errr are: ", err);
    //       console.log("Results are: ",results); // results contains rows returned by server
    //       console.log("Fields are: ", fields); // fields contains extra meta data about results, if available
    //     }
    //   );

    // console.log("RES IS ::::::::::::::::::::::: ", x);
    const client = await connectDb();
    await client.connect();
    const resp = await client.query('SELECT * FROM users;');
    // console.log("RES IS",res)
    await client.end();
    console.log("ROWS: ", resp.rows);
    res.status(200).send(resp.rows);
});
