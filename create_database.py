#!/usr/bin/env python
# coding: utf-8

# In[1]:


import pandas as pd
import random as rand
import datetime
import shortuuid


df_location = pd.read_csv('csv_files/us_cities_states_counties.csv',delimiter='|')
df = pd.read_csv('csv_files/AB_US_2020.csv')
TOTAL_DB_SIZE = 800


# In[2]:


### Users
# ---------
# user_id - host_id
# user_type - random (USER, ADMIN)
# name - host_name
# password - random

def randomizer(size, values):
    r = []
    for i in range(size):
        r.append(values[rand.randint(0, len(values) - 1)])
    return r

def randomize_passowrds(size):
    p = []
    su = shortuuid.ShortUUID(alphabet="aAbBdefghijklmnopqrstuvwxyz1234567890")
    for i in range(size):
        l = rand.randint(5, 12)
        p.append(su.random(length=l))
    return p

def randomize_types(size):
    t = ['USERS', 'HOST']
    types = randomizer(size, t)
    for i in range(4):
        index = rand.randint(0, len(types) - 1)
        types[index] = 'ADMIN'
    return types

def randomize_ids(size, id_len):
    ids = []
    su = shortuuid.ShortUUID(alphabet="1234567890")
    for i in range(size):
        ids.append(su.random(length=id_len))
    return ids

user_id = randomize_ids(TOTAL_DB_SIZE, 7)
types = randomize_types(TOTAL_DB_SIZE)
passwords = randomize_passowrds(TOTAL_DB_SIZE)
users_dict= {
    'userId': user_id,
    'userType': types,
    'name': df['host_name'][:TOTAL_DB_SIZE].values,
    'password': passwords
}

df_users = pd.DataFrame(users_dict)
print(df_users[:10])
print(df_users.loc[(df_users['userType'] == 'ADMIN')])
print(len(df_users))
df_users.to_csv('csv_files/USERS.csv', index=False)


# In[3]:


### Properties
# ---------
# host_name - host_name
# host_id - host_id
# listing_id - id
# listing_name - name
# city - random
# state - random
# price - price
# num_beds - random (1 - 4)
# min_nights - random (1-5)
# max_people - random (0-8)
# room_size - random (SMALL, MEDIUM, LARGE)

def get_host_info(df_users):
    df_hosts = df_users.loc[(df_users['userType'] == 'HOST')]
    return df_hosts

def get_random_cities_states(size, df_cities_states, city_key, state_key):
    c_all = df_cities_states[city_key]
    s_all = df_cities_states[state_key]
    
    cities = []
    states = []
    
    for i in range(size):
        index = rand.randint(0, len(df_cities_states) - 1)
        cities.append(c_all[index])
        states.append(s_all[index])
    
    return cities, states

def randomize_hosts(size, df_hosts, id_col, name_col):
    host_id = []
    host_name = []
    for i in range(size):
        d = rand.randint(1, 5)
        index = rand.randint(0, len(df_hosts) - 1)
        while d > 0 and len(host_id) < size:
            host_id.append(df_hosts[id_col].iloc[index])
            host_name.append(df_hosts[name_col].iloc[index])
            d -= 1
    return host_id, host_name

            

def get_random_nums_list(size, num_min, num_max):
    num_list = []
    for i in range(size):
        x = rand.randint(num_min, num_max)
        num_list.append(x)
    return num_list

def randomize_rooms_list(size):
    r = ['SMALL', 'MEDIUM', 'LARGE']
    return randomizer(size, r)

def get_random_money_list(size, min_amount, max_amount):
    amount_list = []
    for i in range(size):
        x = round(rand.uniform(min_amount, max_amount), 2)
        amount_list.append('$'+ str(x))
    return amount_list
    
df_hosts = get_host_info(df_users)

host_id, host_name = randomize_hosts(len(df_users), df_hosts, 'userId', 'name')
cities, states = get_random_cities_states(len(df_users), df_location, 'City', 'State short')
num_beds = get_random_nums_list(len(df_users), 1, 4)
min_nights = get_random_nums_list(len(df_users), 1, 5)
max_people = get_random_nums_list(len(df_users), 4, 8)
prices = get_random_money_list(len(df_users), 1.00, 5000.00)
rooms = randomize_rooms_list(len(df_users))


properties_dict= {
    'listingId': df['id'][:len(df_users)].values,
    'listingName': df['name'][:len(df_users)].values,
    'hostName': host_name,
    'hostId': host_id,
    'city': cities,
    'state': states,
    'price': prices,
    'numBeds': num_beds,
    'minimumNights': min_nights,
    'maxPeople': max_people,
    'roomSize': rooms
}


df_props = pd.DataFrame(properties_dict)
print(df_props[:10])
print(len(df_props))
df_props.to_csv('csv_files/PROPERTIES.csv', index=False)


# In[4]:


### Reservations 
# --------
# reserve_id - random
# start_date - random
# end_date - random
# status - random (BOOKED, CANCELLED, OPEN)
# listing_id - properties.listing_id
# listing_name - properties.listing_name

def get_user_info(df_users):
    df_u = df_users.loc[(df_users['userType'] == 'USERS')]
    return df_u

def randomize_status_list(end_dates):
    s = ['BOOKED', 'CANCELLED', 'COMPLETED']
    statuses = []
    for i in range(len(start_dates)):
        now = datetime.datetime.now().date()
        end = datetime.datetime.strptime(end_dates[i], '%x').date()
        delta = end - now
        if delta.days < 0:
            statuses.append(s[rand.randint(1,2)])
        else:
            statuses.append(s[rand.randint(0,1)])
    return statuses
            
        
        

def randomize_start_end_list(min_nights):
    start = []
    end = []
    for n in min_nights:
        start_delta = rand.randint(-30, 30)
        end_delta = rand.randint(n, 21)
        date_now = datetime.datetime.now()
        start_date = date_now + datetime.timedelta(weeks=start_delta)
        end_date = start_date + datetime.timedelta(days=end_delta)
        start.append(start_date.strftime("%x"))
        end.append(end_date.strftime("%x"))
        
    return start, end

        
def randomize_reserveid_list(size):
    ri = []
    su = shortuuid.ShortUUID(alphabet="1234567890")
    for i in range(size):
        ri.append(su.random(length=9))
    return ri

def randomize_user_id(size, df_u, id_col):
    uids = []
    for i in range(size):
        index = rand.randint(0, len(df_u) - 1)
        uids.append(df_u[id_col].iloc[index])
    return uids

def randomize_listings(size, df_props, id_col):
    listing_id = []
    for i in range(size):
        d = rand.randint(1, 5)
        index = rand.randint(0, len(df_props) - 1)
        while d > 0 and len(listing_id) < size:
            listing_id.append(df_props[id_col].iloc[index])
            d -= 1
    return listing_id

def randomize_num_guests(listings, df_props):
    num_guests = []
    for l in listings:
        max_people = df_props.loc[df_props['listingId'] == l]['maxPeople'].values[0]
        num_guests.append(rand.randint(1, max_people))
    return num_guests
        

df_u = get_user_info(df_users)
reserve_id = randomize_reserveid_list(len(df_props))
listing_id = randomize_listings(len(df_props), df_props, 'listingId')
start_dates, end_dates = randomize_start_end_list(min_nights)
statuses = randomize_status_list(end_dates)
user_id = randomize_user_id(len(df_props), df_u, 'userId')
num_guests = randomize_num_guests(listing_id, df_props)

res_dict = {
    'reservationId': reserve_id,
    'startDate': start_dates,
    'endDate': end_dates,
    'status': statuses,
    'listingId': listing_id,
    'userId': user_id,
    'numGuests': num_guests
}

df_res = pd.DataFrame(res_dict)
print(df_res)

print(df_res.loc[df_res['status'] == 'CANCELLED'])
# temp_df = df_res.join(df_props.set_index('listingId'), how='inner', on='listingId')
# temp_df = temp_df.loc[temp_df['maxPeople'] < temp_df['numGuests']]
# print(temp_df[['listingId', 'maxPeople', 'numGuests']])

df_res.to_csv('csv_files/RESERVATIONS.csv', index=False)

