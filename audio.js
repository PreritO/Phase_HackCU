var player = require('play-sound')(opts = {});

function playAudio(filePath) { 
    player.play(filePath, function(err){
  		if (err) throw err
	});
} 

function pauseAudio(filePath) { 
    x.pause(filePath); 
} 