# Hotels DMBS Project

## How to run the project
- To run the postgres db instance simply run the command `docker-compose up --build -d` 
- To close the running docker container run the command `docker-compose down -v` 
- to open the postgres interactive terminal run the command `docker exec -it hotel-myDB-1 psql -U hello -w hotelsDb`
- To hit the rest api locally use the following host name: `http://localhost:6565/`

## Testing 

To test on your own, you must first import our Postman collection json file into your Postman application on your desktop. Next you can select any of the available requests, and hit “send” on them. For Delete requests its recommended that you first create your own property,user,etc via the exposed “create” requests, and use the returned ids for those artifacts to populate the delete request, so it knows what artifact to delete, without you needing to login to the db manually to pull an artifact. 

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
