'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const { query } = require('express');


const PORT = process.env.PORT;
const GEOCODE_API_KEY = process.env.GEOCODE_API_KEY;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const PARK_API_KEY = process.env.PARK_API_KEY;
const app = express();
app.use(cors());


app.get('/location', handleLocationRequest);
app.get('/weather', handleWeatherRequest);
app.get('/park', handleParkRequest);
app.use('*', (req, res) => {
  res.send('All Good!!')
});

function handleLocationRequest(req, res) {
  const query = req.query.city;
  const url = `https://us1.locationiq.com/v1/search.php`;
  const queryObject = {
    key: GEOCODE_API_KEY,
    q: query,
    format: 'json'
  }
  if (!query) {
    res.status(404).send('Sorry , No city was found !!');
  }

  superagent.get(url).query(queryObject).then(resData => {
    const locationInfo = new Location(resData.body[0], query);
    res.status(200).send(locationInfo);
  }).catch(error => {
    console.error('Error', error);
    res.status(404).send('Sorry , something went wrong');
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
    console.error('ERROR',error);
    res.status(404).send('Sorry , Something went wrong');
  });
}
function Park(park){
  this.name=park.fullName;
  this.address = park.addresses[0].line1 +', '+park.addresses[0].city+', ' +park.addresses[0].stateCode+' '+ park.addresses[0].postalCode;
  //this.address = `${park.addresses[0].line3}, ${park.addresses[0].city}, ${park.addresses[0].stateCode} ${park.adresses[0].postalCode}`;
  this.description = park.description;
  this.fee = park.entranceFees[0].cost || 0.00;
  this.url = park.url;
  
}

app.listen(PORT, () => {
  console.log(`Listening to Port ${PORT}`);
})