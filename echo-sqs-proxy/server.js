
require('console-stamp')(console, '[ddd mmm dd yyyy HH:MM:ss.l]');
const Consumer = require('sqs-consumer');
const request = require('request');
const AWS = require('aws-sdk');
const async = require('async');
const path = require('path');
const settings = require(path.resolve(__dirname, 'settings.json'));

var prevId = '';
var clientUrl = '';
var serverUrl = '';
console.log("Starting...")
try {
	AWS.config.loadFromPath(path.resolve(__dirname, 'settings.json'));

	var sqsClient = new AWS.SQS();

	sqsClient.createQueue({QueueName: "SQS-Proxy-Client"}, function(err, data) {
   		if (err) console.log(err, err.stack); // an error occurred
   		else {
			clientUrl= data.QueueUrl;           // successful response

			var sqsServer = new AWS.SQS();

			sqsServer.createQueue({QueueName: "SQS-Proxy-Server"}, function(err, data) {
   				if (err) console.log(err, err.stack); // an error occurred
   				else {
					serverUrl= data.QueueUrl;           // successful response

					var app = Consumer.create({
  						region:   settings.region,
  						queueUrl: clientUrl,
  						handleMessage: function (message, done) {
    						if (message.MessageId != prevId) {
    							console.log(message.Body)
    							var messageJson
    							try {
    								messageJson = JSON.parse(message.Body);
    							} catch (err) {
    								console.log('Invalid message ' + message.Body);
    								done();
    								return;
    							}
    							var messageType = messageJson['type'];
    							var messagePayload = messageJson['payload'];
    							if (messageType === 'sonos') {
									var url = "http://" + settings.host + ":" + settings.port + messagePayload;
									console.log("=>" + url);
									prevId = message.MessageId;
									request(url, function (error, response, body) {
	  									if (!error) {
	    									console.log(body) // Show the HTML for the Google homepage.
			    							sqsServer.sendMessage(
			    								{
		  											MessageBody: body,
	  												QueueUrl: serverUrl
			    								}, 
			    								function(err, data) {
	  												if (err) {
	    												console.log('ERR1 ', err);
	  												}
	  											}
											);
	  									} else {
	  										console.log("ERR2 " + error); 
	  									}
									});
    							} else if (messageType === 'ping') {
	    							sqsServer.sendMessage(
	    								{
  											MessageBody: 'pong',
											QueueUrl: serverUrl
	    								},
	    								function(err, data) {
											if (err) {
												console.log('ERR1 ', err);
											}
										}
									);
    							}
							}
    						done();
  						},
  						sqs: new AWS.SQS()
					});

					app.on('error', function (err) {
  						console.log('APP Error: ' + err.message);
					});

					app.start();
   				}
			});
  		 }
	});


} catch(err) {
	console.log(err.message);
}