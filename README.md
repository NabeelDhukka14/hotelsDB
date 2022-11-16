# Hotels DMBS Project

## How to run the project
- To run the postgres db instance simply run the command `docker-compose up -d` 
- To close the running docker container run the command `docker-compose down` 

## On container start ... 
- When the docker container starts, it will create a postgres instance with default `user=hello` and defualt `password=world`
- All default created database tables are defined in the `init.sql` file. 


