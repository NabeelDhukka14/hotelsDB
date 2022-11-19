CREATE TABLE IF NOT EXISTS Users (
  userId TEXT NOT NULL,
  userType TEXT NOT NULL,
  name TEXT NOT NULL, 
  password TEXT NOT NULL,
  PRIMARY KEY (userId)
);

copy Users(
  userId,
  userType,
  name,
  password
) FROM '/csv_files/USERS.csv'
DELIMITER ','
CSV HEADER;

CREATE TABLE IF NOT EXISTS Properties (
  listingId TEXT NOT NULL, 
  listingName TEXT NOT NULL,
  hostname TEXT NOT NULL,
  hostid TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT, 
  price MONEY NOT NULL ,
  numBeds INT,
  minimumNights INT NOT NULL,
  maxPeople INT, 
  roomSize TEXT,
  PRIMARY KEY (ListingId)
);

copy PROPERTIES(
  listingId, 
  listingName,
  hostname,
  hostid,
  city,
  state, 
  price,
  numBeds,
  minimumNights,
  maxPeople, 
  roomSize
) FROM '/csv_files/PROPERTIES.csv'
DELIMITER ','
CSV HEADER;


CREATE TABLE IF NOT EXISTS Reservations(
  reservationId TEXT NOT NULL,
  startDate DATE NOT NULL, 
  endDate DATE NOT NULL, 
  status TEXT NOT NULL,
  listingId TEXT NOT NULL, 
  userId TEXT NOT NULL, 
  numGuests INT NOT NULL, 
  PRIMARY KEY(reservationId)
);
copy RESERVATIONS(
  reservationId,
  startDate, 
  endDate, 
  status,
  listingId, 
  userId, 
  numGuests
) FROM '/csv_files/RESERVATIONS.csv'
DELIMITER ','
CSV HEADER;