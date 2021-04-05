'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');
const { query } = require('express');


const PORT = process.env.PORT;
const ENV = process.env.ENV || 'DEP';
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const PARK_API_KEY = process.env.PARK_API_KEY;
const DATABASE_URL = process.env.DATABASE_URL;


const app = express();
app.use(cors());


let client = '';
if (ENV === 'DEV') {
  client = new pg.Client({
    connectionString: DATABASE_URL
  });
} else {
  client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized : false
    }
  });
}

app.get('/location', handleLocationRequest);
app.get('/weather', handleWeatherRequest);
app.get('/park', handleParkRequest);
app.use('*', (req, res) => {
  res.send('All Good!!')
});

function handleLocationRequest(req, res) {

  const query = req.query.city;

  if (!query) {
    res.status(404).send('Sorry , No city was found !!');
  }

  // retrieve from DB to check
  const selectValue = [query];
  const selectQ = `select * from locations where search_query=$1;`

  client.query(selectQ, selectValue).then(selectResult => {
    if (selectResult.rows.length === 0) {
      throw error;
    }
    res.status(200).send(selectResult.rows[0]);
  }).catch(() => {
    getFromAPI(query).then(apiResult => {
      const insertValues = [apiResult.search_query, apiResult.formatted_query, apiResult.latitude, apiResult.longitude];
      const insertQ = `insert into locations (search_query, formatted_query, latitude, longitude) values ($1 ,$2, $3, $4);`;

      client.query(insertQ, insertValues);
      res.status(200).send(apiResult);
    }).catch(error => {
      console.error('ERROR IN API', error);
    });
  });
}

function getFromAPI(city) {

  const queryObject = {
    key: GEOCODE_API_KEY,
    q: city,
    format: 'json'
  }
  const url = `https://us1.locationiq.com/v1/search.php`;

  return superagent.get(url).query(queryObject).then(resData => {
    const locationInfo = new Location(resData.body[0], city);
    return locationInfo;
  });
}

function Location(data, query) {
  this.search_query = query;
  this.formatted_query = data.display_name;
  this.latitude = data.lat;
  this.longitude = data.lon;
}
function handleWeatherRequest(req, res) {

  const url = `https://api.weatherbit.io/v2.0/forecast/daily?limit=8`;
  const queryObject = {
    key: WEATHER_API_KEY,
    lat: req.query.latitude,
    lon: req.query.longitude
  }

  let i = 0;
  superagent.get(url).query(queryObject).then(resData => {
    const weatherData = resData.body.data.slice(0, 8).map((weather) => {
      return new Weather(weather);

    });
    res.status(200).send(weatherData);
  }).catch(error => {
    console.error('ERROR', error);
    res.status(500).send('Sorry , Something went wrong');
  });
}

function Weather(weatherData) {
  this.forecast = weatherData.weather.description;
  this.time = weatherData.datetime;
}

function handleParkRequest(req, res) {

  const queryObject = {
    api_key: PARK_API_KEY,
    q: req.query.q
  }
  const url = `https://developer.nps.gov/api/v1/parks?limit=10`;

  superagent.get(url).query(queryObject).then(resData => {
    const parks = resData.body.data.map(park => {
      return new Park(park);
    });
    res.status(200).send(parks);
  }).catch(error => {
    console.error('ERROR', error);
    res.status(404).send('Sorry , Something went wrong');
  });
}
function Park(park) {
  this.name = park.fullName;
  this.address = park.addresses[0].line1 + ', ' + park.addresses[0].city + ', ' + park.addresses[0].stateCode + ' ' + park.addresses[0].postalCode;
  //this.address = `${park.addresses[0].line3}, ${park.addresses[0].city}, ${park.addresses[0].stateCode} ${park.adresses[0].postalCode}`;
  this.description = park.description;
  this.fee = park.entranceFees[0].cost || 0.00;
  this.url = park.url;

}

client.connect().then(() => {
  app.listen(PORT, () => {
    console.log('Connected to database', client.connectionParameters.database);
    console.log(`Listening to Port ${PORT}`);
  });
});