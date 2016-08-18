var unirest = require('unirest');
var express = require('express');
var events = require('events');


var getFromApi = function(endpoint, args) {
	var emitter = new events.EventEmitter();
	unirest.get('https://api.spotify.com/v1/' + endpoint)
		   .qs(args)
		   .end(function(response) {
		   		if (response.ok) {
		   			emitter.emit('end', response.body);
		   		}
		   		else {
		   			emitter.emit('error', response.code);
		   		}
		   });
	return emitter;
};

var getRelated = function(artistId) {
	return new Promise(function(resolve, reject) {
		var searchRelated = getFromApi('artists/' + artistId + '/related-artists');

		searchRelated.on('end', function(item) {
			resolve(item);
		});

		searchRelated.on('error', function(code) {
			reject(code);
		});
	});
};

var getTracks = function(relatedArtists) {
	return new Promise(function(resolve, reject) {
		var completed = 0;

		var checkComplete = function() {
			if (completed === relatedArtists.length) {
				resolve(relatedArtists);
			}
		};

		relatedArtists.forEach(function(artist) {

			var searchTopTrack = getFromApi('artists/' + artist.id + '/top-tracks', {country: 'US'});

			searchTopTrack.on('end', function(item) {
				artist.tracks = item.tracks;
				completed += 1;
				checkComplete();
			});

			searchTopTrack.on('error', function(code) {
				console.log(code);
				reject(code);
			});
		});
	});
};

var app = express();
app.use(express.static('public'));

app.get('/search/:name', function(req, res) {
	var searchReq = getFromApi('search', {
		q: req.params.name,
		limit: 1,
		type: 'artist'
	});

	searchReq.on('end', function(item) {
		if (item.artists.items.length !== 0) {
			var artist = item.artists.items[0];
			getRelated(artist.id)
				.then(function(item) {
				artist.related = item.artists;
				getTracks(artist.related)
					.then(function(relatedArtists) {
						artist.related = relatedArtists;
						res.json(artist);
					})
					.catch(function(code) {
						res.sendStatus(code);
					});
				})
				.catch(function(code) {
					res.sendStatus(code);
				});
		}
		else {
			res.sendStatus(404);
		}
	});

	searchReq.on('error', function(code) {
		res.sendStatus(code);
	});
});

app.listen(8080);