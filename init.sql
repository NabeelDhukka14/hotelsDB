CREATE TABLE IF NOT EXISTS Users (
  userId TEXT NOT NULL,
  userType TEXT NOT NULL,
  name TEXT NOT NULL, 
  password TEXT NOT NULL,
  PRIMARY KEY (userId)
);

CREATE TABLE IF NOT EXISTS Properties (
  hostname TEXT NOT NULL,
  hostid TEXT NOT NULL,
  listingId TEXT NOT NULL, 
  listingName TEXT NOT NULL,
  city TEXT NOT NULL,
  numBeds INT,
  price MONEY NOT NULL ,
  minimumNights INT NOT NULL,
  maxPeople INT, 
  state TEXT, 
  roomSize TEXT,
  PRIMARY KEY (ListingId)
);


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

