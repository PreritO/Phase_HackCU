// Run this like:
// node audioserver.js
//
// Requires wav https://github.com/TooTallNate/node-wav
// npm install wav 

var fs = require('fs');
var path = require('path');
var net = require('net');
var wav = require('wav');
var DeepAffects = require('deep-affects');
var play = require('play');
var Speaker = require('speaker');
var LowPass = require('lowpass').LowPass;
var pzsound = require('pizzicato');

var http = require("http"),
    url = require("url"),
    path = require("path"),
    fs = require("fs"),
    port = process.argv[2] || 8080;

// For this simple test, just create wav files in the "out" directory in the directory
// where audioserver.js lives.
var outputDir = path.join(__dirname, "out");  

var dataPort = 7123; // this is the port to listen on for data from the Photon

// If changing the sample frequency in the Particle code, make sure you change this!
var wavOpts = {
	'channels':1,
	'sampleRate':20000,
	'bitDepth':16
};

var defaultClient = DeepAffects.ApiClient.instance;

// Configure API key authorization: UserSecurity
var UserSecurity = defaultClient.authentications['UserSecurity'];

UserSecurity.apiKey = "yIT2SfQci7UJxKdCfboUsSzuhH9nWjEh";

//var api = new DeepAffects.DenoiseApi();
var api = new DeepAffects.EmotionApi();

var body; 
// Output files in the out directory are of the form 00001.wav. lastNum is used 
// to speed up scanning for the next unique file.
var lastNum = 0;

var globalData;
var globalPath;

// Create the out directory if it does not exist
try {
	fs.mkdirSync(outputDir);
}
catch(e) {
}

// Start a TCP Server. This is what receives data from the Particle Photon
// https://gist.github.com/creationix/707146
net.createServer(function (socket) {
	console.log('data connection started from ' + socket.remoteAddress);
	
	// The server sends a 8-bit byte value for each sample. Javascript doesn't really like
	// binary values, so we use setEncoding to read each byte of a data as 2 hex digits instead.
	socket.setEncoding('hex');
	
	var outPath = getUniqueOutputPath();
	
	var writer = new wav.FileWriter(outPath, wavOpts);
	
	socket.on('data', function (data) {
		// We received data on this connection.
		// var buf = Buffer.from(data, 'hex');
		var buf = new Buffer(data, 'hex');
		
		if (wavOpts.bitDepth == 16) {
			// The Photon sends up unsigned data for both 8 and 16 bit
			// The wav file format is unsigned for 8 bit and signed two-complement for 16-bit. Go figure.
			for(var ii = 0; ii < buf.length; ii += 2) {
				var unsigned = buf.readUInt16LE(ii);
				var signed = unsigned - 32768;
				buf.writeInt16LE(signed, ii);
			}
		}
		
		// console.log("got data " + (data.length / 2));
		writer.write(buf);
	});
	socket.on('end', function () {
		console.log('transmission complete, saved to ' + outPath);
		writer.end();

		// var filteredFile = fs.createReadStream(outPath);
		// var speaker, lowpass;
		// var reader = new wav.Reader();
		// // the "format" event gets emitted at the end of the WAVE header
		// reader.on('format', function (format) {
		//   speaker = new Speaker(format);
		//   lowPass = new LowPass({format : format});

		//   // the lowpass is piped between file reader and speaker
		//   reader.pipe(lowPass);
		//   lowPass.pipe(speaker);
		// });

		// //filteredFile.pipe();
		// console.log(filteredFile);


		// // pipe the WAVE file to the Reader instance
		// filteredFile.pipe(reader);

		body = DeepAffects.Audio.fromFile(outPath); // {Audio} Audio object that needs to be denoised.
		webhook = "localhost:8888"
		//api.syncDenoiseAudio(body, deepAffectscallback);
		//api.asyncDenoiseAudio(body, webhook, deepAffectscallback);
		api.syncRecogniseEmotion(body, deepAffectscallback);
		globalPath = outPath;
	});
}).listen(dataPort);

// var deepAffectscallback = function(error, data, response) {
// 		  if (error) {
// 		    console.error(error);
// 		  } else {
// 		    console.log('Deep Affects API called successfully. Returned data: ' + data);
// 			//var str = JSON.stringify(data);
// 			//str = JSON.stringify(data, null, 4); // (Optional) beautiful indented output.
// 			console.log(data.encoding); // Logs output to dev tools console.
// 			var outPathDenoised = getUniqueOutputPath();
// 			var writerDenoise = new wav.FileWriter("output.mp3", wavOpts);
// 			writerDenoise.write(data.content);
// 			console.log('Donce...');
// 		  }
// 		};

var deepAffectscallback = function(error, data, response) {
	if (error) {
		console.error(error);
	} else {
		console.log('Deep Affects API called successfully. Returned data: ' + data);
		console.log(JSON.stringify(data));
		console.log('DONE...');
		globalData = JSON.stringify(data, null, 4);

	}
}

function formatName(num) {
	var s = num.toString();
	
	while(s.length < 5) {
		s = '0' + s;
	}
	return s + '.wav';
}

function getUniqueOutputPath() {
	for(var ii = lastNum + 1; ii < 99999; ii++) {
		var outPath = path.join(outputDir, formatName(ii));
		try {
			fs.statSync(outPath);
		}
		catch(e) {
			// File does not exist, use this one
			lastNum = ii;
			return outPath;
		}
	}
	lastNum = 0;
	return "00000.wav";
}

http.createServer(function(request, response) {

  var uri = url.parse(request.url).pathname
    , filename = path.join(process.cwd(), uri);

  fs.exists(filename, function(exists) {
    if(!exists) {
      response.writeHead(404, {"Content-Type": "text/plain"});
      response.write("404 Not Found\n");
      response.end();
      return;
    }

    if (fs.statSync(filename).isDirectory()) filename += '/index.html';

    fs.readFile(filename, "binary", function(err, file) {
      if(err) {        
        response.writeHead(500, {"Content-Type": "text/plain"});
        response.write(err + "\n");
        response.end();
        return;
      }

      response.writeHead(200);
      //response.write(file, "binary");
      response.write('<!DOCTYPE html><html lang="en"><head>');
    response.write('<meta charset="utf-8">');
    response.write('<title>HELLO WORLD</title>');
    response.write('<script src="https://unpkg.com/wavesurfer.js"></script>')
    response.write('</head><body>');
    response.write('<p><tt><pre><code>' + globalData + '</code></pre></tt></p>');
    response.write('<audio id="myAudio"> \
    				  <source src="out/'+ 'song.ogg'+'" type="audio/ogg"> \
					  <source src="out/'+ 'song.mp3'+'" type="audio/mpeg"> \
					  Your browser does not support the audio element. \
					</audio>');
    response.write('<p>Click the buttons to play or pause the audio.</p>');
    response.write('<button onclick="'+playAudio()+'" type="button">Play Audio</button>');
    response.write('<div id="waveform"></div>');
    response.write('</body></html>');
    response.write('<script> \
						var wavesurfer = WaveSurfer.create({ \
						    container: \'#waveform\', \
						    waveColor: \'violet\', \
						    progressColor: \'purple\' \
						}); \
						// wavesurfer.load(\'out/' + globalPath.replace(/^.*[\\\/]/, "") + '\'); \
						</script>');
    response.end();
      response.end(globalData);
    });
  });
  //document.getElementById("Emotions").innerHTML = globalData;
}).listen(parseInt(port, 10));

function playAudio() {
	console.log("IN PLAY AUDIO");
	//If you want to know when the player has defintely started playing
  //play.sound('out/song.mp3');
  if(globalPath != null) {
  	play.sound('out/' + globalPath.replace(/^.*[\\\/]/, ''));
  }
}

console.log("Static file server running at\n  => http://localhost:" + port + "/\nCTRL + C to shutdown");


