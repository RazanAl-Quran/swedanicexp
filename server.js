'use strict';

const express = require('express');
require('dotenv').config();
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

const PORT = process.env.PORT;

const app = express();
const client = new pg.Client(process.env.DATABASE_URL);
// console.log(app);
app.use(cors());

app.get('/', (req, res) => {
    res.status(200).send('you did great!!');
});


////////////////////////Location//////////////////////////
// http://localhost:3000/location?data=amman
// https://eu1.locationiq.com/v1/search.php?key=f7076ae695ed67&q=amman&format=json
app.get('/location', locationHandler);

function locationHandler(request, response) {

    let city = request.query.city;
    // let locationData = getLocation(city);
    // console.log('11111111111111111111111111111111',locationData);
    // response.status(200).json(locationData);
    getLocation(city)
        .then(locationData => {
            // console.log('hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',locationData);
            response.status(200).json(locationData);
        });
}


function getLocation(city) {

    let SQL = 'SELECT * FROM locations WHERE search_query=$1';
    console.log('dddddddddddddddddddddddddddddddddddddddd', SQL);
    let values = [city];
    return client.query(SQL, values) //will return promise
        .then(results => {
            //results.count -> it will NOT work
            //results.rowCount -> it will work
            
            if (results.rows.length) { 
                console.log('already exist');
                return results.rows[0]; }
            else {
                // console.log('eeeeeeeeeeeeeeeeeeeeee');
                let key = process.env.GEOCODE_API_KEY;
                const url = `https://eu1.locationiq.com/v1/search.php?key=${key}&q=${city}&format=json&limit=1`;
                return superagent.get(url)
                    .then(data => {
                        // console.log('22222222222222222222222222222222',data);
                        // console.log('33333333333333333333333333333333',data.body[0]);
                        return cachedLocation(city, data.body[0]);
                    });
            }
        })
}

function cachedLocation(city, info) {
    // console.log('eeeeeeeeeeeeeeeeeeeeee',info);
    var newLocation = new Location(city, info);
    let SQL = 'INSERT INTO locations (search_query, formatted_query,latitude,longitude) VALUES ($1, $2, $3, $4) RETURNING *';
    let safeValues = [city, newLocation.formatted_query, newLocation.latitude, newLocation.longitude];
    return client.query(SQL, safeValues)
        .then(results => results.rows[0]);
}

function Location(city, geoData) {
    // console.log('ccccccccccccccccc/ccccccccccccc',geoData);
    this.search_query = city;
    this.formatted_query = geoData.display_name;
    this.latitude = geoData.lat;
    this.longitude = geoData.lon;
}


///////////////////////////Weather//////////////////////////////
// http://localhost:3000/weather?latitude=31.9515694&longitude=35.9239625
// https://api.darksky.net/forecast/d530359b605f76279985a735c3832fcd/31.9515694,35.9239625
app.get('/weather', weatherHandler);

function weatherHandler(request, response) {
    const latitude = request.query.latitude;
    const longitude = request.query.longitude;
    getWeather(latitude, longitude)
        .then(weatherData => response.status(200).json(weatherData));
}

function getWeather(latitude, longitude) {
    const key = process.env.WEATHER_API_KEY;
    const url = `https://api.darksky.net/forecast/${key}/${latitude},${longitude}`;
    var weatherDaily = [];

    return superagent(url)
        .then(geoData => {
            geoData.body.daily.data.forEach(val => {
                var weatherData = new Weather(val);
                weatherDaily.push(weatherData);
            });
            return weatherDaily;
        })

}

function Weather(day) {
    this.forecast = day.summary;
    this.time = new Date(day.time * 1000).toString().slice(0, 15);
    // this.time = new Date(day.time*1000).toDateString();

}


////////////////////Trail////////////////////
// from here https://www.hikingproject.com/data
// http://localhost:3000/trails?latitude=31.9515694&longitude=35.9239625
// https://www.hikingproject.com/data/get-trails?lat=40.0274&lon=-105.2519&maxDistance=10&key=200713907-ad9541d779b6bd8ec1279919d09c6ad2
app.get('/trails', trailsHandler);

function trailsHandler(request, response) {
    let city = request.query.city;
    let latitude = request.query.latitude;
    let longitude = request.query.longitude;
    getTrails(latitude, longitude)
        .then(trailsData => {
            response.status(200).json(trailsData);
        });
}

function getTrails(latitude, longitude) {
    let key = process.env.TRAILS_API_KEY;
    const url = `https://www.hikingproject.com/data/get-trails?lat=${latitude}&lon=${longitude}&maxDistance=10&key=${key}`;
    var trialDaily = [];
    return superagent.get(url)
        .then(trailsVal => {
            console.log('ffffffffffffffffffffffff', trailsVal.body);
            // trailsVal.body.trails.map(trail => {
            //     return new Trail(trail);
            // })
            trailsVal.body.trails.forEach(val => {
                var trialData = new Trail(val);
                trialDaily.push(trialData);
            });
            return trialDaily;
        })
}

function Trail(trail) {
    this.tableName = 'trails';
    this.name = trail.name;
    this.location = trail.location;
    this.length = trail.length;
    this.stars = trail.stars;
    this.star_votes = trail.starVotes;
    this.summary = trail.summary;
    this.trail_url = trail.url;
    this.conditions = trail.conditionDetails;
    this.condition_date = trail.conditionDate.slice(0, 10);
    this.condition_time = trail.conditionDate.slice(12);
    this.created_at = Date.now();
}



////////////////////Movie////////////////////
app.get('/movies', moviesHandler);


function moviesHandler(request, response) {
    let city = request.query.search_query;
    getMovies(city)
        .then(moviesData => {
            response.status(200).json(moviesData);
        });
}

function getMovies(city) {
    let key = process.env.MOVIES_API_KEY;
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${city}&language=de-DE&region=DE`;
    return superagent.get(url)
        .then(moviesVal => {
            let movieDaily= moviesVal.body.results.map(val => {
                return new Movie(val);
            });
            return movieDaily;
        })
}

function Movie(val) {
    this.title = val.title;
    this.overview = val.overview;
    this.average_votes = val.vote_average;
    this.total_votes = this.vote_count;
    this.image_url = val.poster_path;
    // this.image_url =`https://image.tmdb.org/t/p/w500/${val.poster_path}`;
    this.popularity = val.popularity;
    this.released_on = val.release_date;
}


////////////////////YELP////////////////////
app.get('/yelp', yelpHandler);


function yelpHandler(request, response) {
    let city = request.query.search_query;
    getYelp(city)
        .then(yelpData => {
            response.status(200).json(yelpData);
        });
}

function getYelp(city) {
    let key = process.env.YELP_API_KEY;
    const url = `https://api.yelp.com/v3/businesses/search?location=${city}`;
    return superagent.get(url)
        .set('Authorization', `Bearer ${key}`)
        .then(yelpVal => {
            let yelpDaily= yelpVal.body.businesses.map(val => {
                return new Yelp(val);
            });
            return yelpDaily;
        })
}

function Yelp(val) {
    this.name = val.name;
    this.image_url = val.image_url;
    this.price = val.price;
    this.rating = val.rating;
    this.url= val.url;
}




// app.get('/weather', (req,res)=> {
//     const geoData = require('./data/darksky.json');
//     console.log(geoData);
//     var weatherDaily =[];
//     geoData.daily.data.forEach(val =>{
//         var weatherData = new Weather(val);
//         weatherDaily.push(weatherData);
//     });
//     res.send(weatherDaily);
// });

// function Weather(day) {
//     this.forecast = day.summary;
//     this.time = new Date(day.time).toString().slice(0,15);
// }


// http://localhost:3000/location?data=amman
/////////////////geo.json//////////////////////
// app.get('/location',(req,res)=> {
//     const geoData = require('./data/geo.json');
//     const city = req.query.data;
//     // console.log(city);
//     // console.log(geoData)
//     let locationData = new Location (city,geoData);
//     res.send(locationData);

// });
// function Location(city,geoData) {
//     this.search_query = city;
//     this.formatted_query = geoData[0].display_name;
//     this.latitude = geoData[0].lat;
//     this.longitude = geoData[0].lon;
// }




/////////////////geo2.json//////////////////////
// app.get('/location',(req,res)=> {
//     const geoData = require('./data/geo2.json');
//     const city = req.query.data;
//     // console.log(city);
//     console.log(geoData.results[0])
//     let locationData = new Location (city,geoData);
//     res.send(locationData);

// });

// function Location(city,geoData) {
//     this.search_query = city;
//     this.formatted_query = geoData.results[0].formatted_address;
//     this.latitude = geoData.results[0].geometry.location.lat;
//     this.longitude = geoData.results[0].geometry.location.lng;
// }


app.use('*', (req, res) => {
    res.status(404).send('Not Found');
});

app.use((error, req, res) => {
    res.status(500).send(error);
});

client.connect()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Listening to port ${PORT}`);
        })
    })