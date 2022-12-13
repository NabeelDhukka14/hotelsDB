# Hotels DMBS Project


## Utilizing Postman to interact with the deployed AWS API. 

### Setting up Postman
1. Download Postman https://www.postman.com/downloads/ 
2. Install it on your device. 
3. Open Postman it should look something like the following:![postman-open](/postman1.png)
4. You don't have to create an account you can press the _Skip and go to the app_ button on the lower left of the application. 

    - _(Note in some past versions of Postman this "skip and go to the app" button was in a similar color scheme to the background color of the postman UI, so take a hard look to find it if need be. If the button cannot be found go ahead and create an account to gain access to the app)_

5. Importing postman
    a. Go to File -> Import ![postman-import-collection](/postman2-import.png) <br>
    b. Select the file `DBMS Hotels DB.postman_collection.json` from the hotelsDB folder <br>
    c. This is what the imported collection should look like.<br> ![postman-collection](/postman-collection.png)

---

### Overview of the collection.

We have an existing suite of user, host and admin credentials contained in the DBMS Hotels DB Collection. 

- _Note: Functions that delete or update the database information, may not be reusable. In these situations we recommend creating a listing/user and then deleting it._

1. Click on the `DBMS Hotels DB Collection`
2. Click on the `Variables` tab  ![postman-variables](/postman-variables.png)
3. These are the pre-set test user, admin, and host members that can be utilized for testing. 

    - _(Note: the Pre-request Script tab shows functions that login each user role and generate a sessionGuid in an automated fashion. This is done in an effort to simplify the testing process, so the tester need not perform the login ceremony themselves when testing the other Project functionality, since those endpoints require users to be logged in. PRE-REQUEST SCRIPTS DO NOT NEED TO BE ADJUSTED AS THEY ALREADY WORK WITH OUR DEFINED TEST MEMBERS.)_


4. Each of the available postman requests from the provided collection use Postman global variables from the `DBMS Hotels DB Collection -> Variables Tab` in order to begin the test. 
    - {{awsHost}} connects the postman request to the remote built instance hosted on our AWS server. 
    - The `Params` tab on each request show two `Path Variables`, `userId`, and `sessionGuid` OR `sessionId` (both represent the same thing). The Values of these Path Variables can be changed to ensure you are making the request with the user you want. By default they are using the Test members we mentioned earlier. You will need to use the `loginUser - Login Fail` request and replace the userId `path variable` and `password` value found in the "body" tab of the request with valid credentials to generate a valid sessionGuid, if you wish to do this step manually. 
        - Do NOT change the key's for these `Path variables` only the values. 
        - ![postman-variables](/pathVariables.png)

    - __For any of the Requests,  Do NOT change the keys or Structure of the payload found in the `<current request> -> body tab`. You may change the values of the keys in the payload but not the name of the key itself, if you wish to see what will occur with different values.__

5. WARNINGS FOR RUNNING TESTS AGAINST LOCALHOST.
    - If running the service locally, make sure to to replace `{{awsHost}}` on each request with `http://localhost:6565` to ensure the requests are hitting your local server. Testing Locally will cause the pre-request scripts not to Work, so you will have to adjust the path variables for `userId`, `sessionGuid` or `sessionId` manually for each request.
    
---

### Testing the provided Postman Requests. 

1. Create a user with the following roles using the `signUpUser` request in postman by going to the `Body` tab of the current request and adjust the `name`, `password` and `userType` property values accordingly. 
    - `USER`
    - `HOST`
    - `ADMIN` (The user cannot create ADMIN through sign up by design. As clients should not be able to make themselves admins)
        - Update the following path variables to test admin accesses. 
            - userId: `{{adminUser}}`
            - sessiongGuid/sessionId : `{{adminSessionGuid}}`
    - Hit Send to generate response
    - Example of request body and response body
     - ![signup-req-res](/signup-req-res.png)

2. Now that you have signed up you should see a `userId` generated. Keep this handy along with the password enterd in the body.
    - This `userId` will be needed for any of the remaining requests if you choose __NOT__ to use our existing test members and pre-request scripts. 
    - Example of the response can be seen in the screenshot above

3. In order to login. Use `loginUser - Login Fail` request to change the userId in the path variable to the user that was just made. Also update the password by going to the `Body` tab. Hit Send.
    - Example of changing the userId and password:
    ![login-request](/login-request.png)
    ![login-request-pass](/login-request-pass.png)

4. The response will generate a `sessionGUID` that will need to be kept handy alongside the `userId` to fulfill the remaining requests.


5. The remaining tests will follow the same pattern to test the remaining endpoints. We will use screenshots of `<createListing>` as an example of how to run any of the remaining Requests that are __NOT__ signup or login. 
    - Click on the Request you wish to test
    - If using our pre-defined test members/scripts, simply hit the blue "Send" button in the top right corner of the request. 
    - If using your own new member, make sure to update the `userId` and `sessionGuid` or `sessionId` path variables with the values you saved from the login/signup steps. 
        - example pics below of the adjusted params, request body and response
        ![create-listing-params](/create-listing-params.png)

    - Feel free to adjust the payload __values__ as you wish, but keep property names and JSON structure as is for smooth testing of the current Request. Also keep value types the same. (E.g do not change a integer value to a String)


6. The `listingId` generated here can be used for the `makeReservations` request as property value. This same variable can be used in the `getTotalBookedDays` request as a `path variable`.

When performing DELETE requests it is recommended to use the associated create/make request to generate the artifiact id (userId, listingId,etc). Use this id when filling out/adjusting the payload for DELETE requests. 

---

## How to run the project locally
- To run the postgres db instance simply run the command `docker-compose up --build -d` 
- To close the running docker container run the command `docker-compose down -v` 
- to open the postgres interactive terminal run the command `docker exec -it hotel-myDB-1 psql -U hello -w hotelsDb`
- To hit the rest api locally use the following host name: `http://localhost:6565/`

- NOTE:// if you experience an error similar to error seen below try the following steps to build the project locally. 
    ```
    ERROR: The Compose file './docker-compose.yml' is invalid because: 'name' does not match any of the regexes: '^x-' 
    ```
    - remove the line `name: hotel` from the `docker-compose.yml` file. 
    - Now proceed to run `docker-compose up --build -d` 
    - to open the postgres interactive terminal run the command `docker exec -it <name of docker image hosting postgres Server> psql -U hello -w hotelsDb`
        - to obtain the name of the docker container hosting postgres Server run `docker ps`. This container will likely have "-myDB-1" in its name. 


## On container start ... 
- When the docker container starts, it will create a postgres instance with default `user=hello` and defualt `password=world`
- All default created database tables are defined in the `init.sql` file. 

---

## How to create the initial CSV Tables: USERS, PROPERTIES, and RESERVATIONS

- First install the dependencies neeeded using pip.
    - `pip install pandas`
    - `pip install shortuuid`
- You can run the jupyter notebook by pressing each cell in order OR do the following:
    1. `jupyter nbconvert --to script *.ipynb`
    2. `python create_database.py`
- This should generate the tables in a CSV format under the csv_files directory
