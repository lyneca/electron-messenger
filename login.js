var fs = require('fs');
var ini = require('ini');
var login = require('facebook-chat-api');
var moment = require('moment')
var $ = require('jquery')

var config = ini.parse(fs.readFileSync('./config.ini', 'utf-8'));
var api;
var currentThreadID;
var currentUserID;
var idMappings = {};

console.log('logging in')

login({email: config.user.email, password: config.user.password}, function(err, fbapi) {
	if (err) return console.error(err);
	console.log('logged in successfully')
	api = fbapi;
	currentUserID = api.getCurrentUserID();
	setCurrentThread(1074099266051901);
})

function loadCurrentThread() {
	console.log('getting thread info')
	api.getThreadInfo(currentThreadID, function(err, info) {
		if (err) return console.error(err);
		console.log('getting user info for ' + info.participantIDs.length + ' participants')
		api.getUserInfo(info.participantIDs, function(err, obj) {
			if (err) return console.error(err);
			for (var prop in obj) {
				if (obj.hasOwnProperty(prop)) idMappings[prop] = obj[prop];
			}
			console.log('getting thread history');
			api.getThreadHistory(currentThreadID, 0, 100, null, function(err, history) {
				if (err) return console.error(err);
				console.log('got ' + history.length + ' messages')
				for (var i = 0; i < history.length; i++) {
					addMessageDiv(history[i]);
				}
				scrollToBottom();
			})
		})
	}) 
}



function addMessageDiv(message) {
	var isCurrentUser = (message.senderID.split(':')[1] == currentUserID);
	$('#messages').append(
		'<div class="message' + ((isCurrentUser) ? ' self' : '') + '">' +
			'<div class="sender">' +
				((isCurrentUser) ? 'You' : message.threadName) +
			'</div>' +
			'<div class="body">' +
				message.body + 
			'</div>' +
			// '<div class="timestamp">' +
			// 	moment(message.timestamp).calendar() +
			// '</div>' + 
		'</div>'
	)
}

function scrollToBottom() {
	$('#messages').scrollTop($('#messages')[0].scrollHeight)
}

function clearMessages() {
	console.log('clearing messages')
	$('#messages').empty()
}

function setCurrentThread(threadID) {
	console.log('setting thread to ' + threadID)
	currentThreadID = threadID;
	clearMessages();
	return loadCurrentThread();
}
