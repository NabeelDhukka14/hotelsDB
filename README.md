# Hotels DMBS Project

## How to run the project
- To run the postgres db instance simply run the command `docker-compose up -d` 
- To close the running docker container run the command `docker-compose down` 
- to open the postgres interactive terminal run the command `docker exec -it myDB-1 psql -U hello -w hotelsDb`

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
